"""Tests for the Safepay subscription billing endpoints.

These tests exercise the integration end-to-end against the FastAPI app
using the in-process TestClient and the SQLite test database wired up in
``conftest.py``. We never hit the real Safepay sandbox — the
``SafepayClient.is_live`` toggle returns False whenever API keys are not
configured (which is the case in tests), so ``create_checkout`` returns
a deterministic mock tracker.

Coverage:
    * GET  /payments/plans                  → public list, well-formed
    * POST /payments/checkout (no auth)     → 401
    * POST /payments/checkout (bad plan)    → 400
    * POST /payments/checkout (happy)       → 200, pending Payment row
    * POST /payments/webhook (bad sig)      → 403
    * POST /payments/webhook (happy)        → 200, user becomes Pro
    * POST /payments/webhook (duplicate)    → 200, no double-grant
    * GET  /payments/history                → returns the payment row
    * Renewal stacking                      → expires_at extends, never shrinks
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient


_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"
_WEBHOOK_SECRET = "test-webhook-secret-do-not-use-in-prod"


def _set_webhook_secret() -> None:
    os.environ["SAFEPAY_WEBHOOK_SECRET"] = _WEBHOOK_SECRET
    from app.core.config import get_settings

    get_settings.cache_clear()


def _client() -> TestClient:
    _set_webhook_secret()
    from app.main import app  # imported lazily so env vars are honoured
    return TestClient(app)


def _signup_and_verify(client: TestClient, email: str, password: str = "Sup3rSecret#Pwd!") -> str:
    """Insert a verified user directly into the test SQLite database and
    return a freshly-minted JWT for it. We bypass the HTTP signup/login
    endpoints because the suite-wide signup rate limit (10/min/IP) is
    shared across all test files, and other modules already consume it."""
    # Lazy imports so env vars set above are honoured.
    from app.core.security import create_access_token, hash_password

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            "INSERT INTO users (id, email, password_hash, full_name, is_active, is_admin, is_pro, granted_by_admin, is_verified, preferences) "
            "VALUES (?, ?, ?, ?, 1, 0, 0, 0, 1, '{}')",
            (user_id, email, pw_hash, "Tester"),
        )
        conn.commit()
    return create_access_token(user_id)


def _sign(body: bytes) -> str:
    return hmac.new(_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()


# ── Plan catalogue ────────────────────────────────────────────────────────


def test_plans_endpoint_is_public_and_returns_known_codes() -> None:
    client = _client()
    resp = client.get("/api/v1/payments/plans")
    assert resp.status_code == 200
    plans = resp.json()
    codes = {p["code"] for p in plans}
    assert "pro_monthly" in codes
    for p in plans:
        assert p["price_minor"] > 0
        assert p["currency"]
        assert p["price_display"]
        assert p["interval_days"] > 0


# ── Checkout ──────────────────────────────────────────────────────────────


def test_checkout_requires_authentication() -> None:
    client = _client()
    resp = client.post("/api/v1/payments/checkout", json={"plan_code": "pro_monthly"})
    assert resp.status_code == 401


def test_checkout_rejects_unknown_plan() -> None:
    client = _client()
    token = _signup_and_verify(client, f"chk-{uuid.uuid4().hex[:10]}@example.com")
    resp = client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "lifetime_unicorn"},
    )
    assert resp.status_code == 400


def test_checkout_creates_pending_payment_and_returns_redirect() -> None:
    client = _client()
    token = _signup_and_verify(client, f"chk-{uuid.uuid4().hex[:10]}@example.com")
    resp = client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "pro_monthly"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["plan_code"] == "pro_monthly"
    assert body["tracker"].startswith("mock_")
    assert "embedded" in body["redirect_url"]
    # A pending Payment row should now exist.
    with sqlite3.connect(_DB_PATH) as conn:
        row = conn.execute(
            "SELECT status, plan_code FROM payments WHERE safepay_tracker = ?",
            (body["tracker"],),
        ).fetchone()
    assert row is not None
    assert row[0] == "pending"
    assert row[1] == "pro_monthly"


# ── Webhook ───────────────────────────────────────────────────────────────


def _activate_via_webhook(client: TestClient, tracker: str, *, event_id: str | None = None) -> None:
    payload = {
        "id": event_id or f"evt_{uuid.uuid4().hex[:16]}",
        "type": "payment.captured",
        "data": {"tracker": tracker, "state": "tracker_ended"},
    }
    raw = json.dumps(payload).encode()
    resp = client.post(
        "/api/v1/payments/webhook",
        content=raw,
        headers={
            "x-sfpy-signature": _sign(raw),
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 200, resp.text


def test_webhook_rejects_invalid_signature() -> None:
    client = _client()
    raw = json.dumps({"id": "evt_x", "type": "payment.captured", "data": {"tracker": "t"}}).encode()
    resp = client.post(
        "/api/v1/payments/webhook",
        content=raw,
        headers={"x-sfpy-signature": "deadbeef", "Content-Type": "application/json"},
    )
    assert resp.status_code == 403


def test_webhook_activates_pro_on_success_event() -> None:
    client = _client()
    email = f"wh-{uuid.uuid4().hex[:10]}@example.com"
    token = _signup_and_verify(client, email)
    chk = client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "pro_monthly"},
    ).json()

    _activate_via_webhook(client, chk["tracker"])

    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["is_pro"] is True

    with sqlite3.connect(_DB_PATH) as conn:
        row = conn.execute(
            "SELECT status, expires_at FROM payments WHERE safepay_tracker = ?",
            (chk["tracker"],),
        ).fetchone()
    assert row[0] == "paid"
    assert row[1] is not None


def test_webhook_is_idempotent_on_duplicate_event_id() -> None:
    client = _client()
    token = _signup_and_verify(client, f"dup-{uuid.uuid4().hex[:10]}@example.com")
    chk = client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "pro_monthly"},
    ).json()
    event_id = f"evt_{uuid.uuid4().hex[:16]}"
    _activate_via_webhook(client, chk["tracker"], event_id=event_id)
    # Capture expiry after first activation
    with sqlite3.connect(_DB_PATH) as conn:
        first_exp = conn.execute(
            "SELECT subscription_expires_at FROM users WHERE id = (SELECT user_id FROM payments WHERE safepay_tracker = ?)",
            (chk["tracker"],),
        ).fetchone()[0]

    # Second delivery, same event_id → must be a no-op
    _activate_via_webhook(client, chk["tracker"], event_id=event_id)

    with sqlite3.connect(_DB_PATH) as conn:
        second_exp = conn.execute(
            "SELECT subscription_expires_at FROM users WHERE id = (SELECT user_id FROM payments WHERE safepay_tracker = ?)",
            (chk["tracker"],),
        ).fetchone()[0]
    assert first_exp == second_exp  # no double-grant


def test_history_returns_user_payments() -> None:
    client = _client()
    token = _signup_and_verify(client, f"hist-{uuid.uuid4().hex[:10]}@example.com")
    client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "pro_monthly"},
    )
    resp = client.get("/api/v1/payments/history", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    rows = resp.json()
    assert any(r["plan_code"] == "pro_monthly" for r in rows)


def test_renewal_stacks_expiry() -> None:
    """Paying again while still active must extend the existing expiry,
    not reset it. This protects users from losing remaining time."""
    client = _client()
    email = f"stack-{uuid.uuid4().hex[:10]}@example.com"
    token = _signup_and_verify(client, email)

    chk1 = client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "pro_monthly"},
    ).json()
    _activate_via_webhook(client, chk1["tracker"])

    with sqlite3.connect(_DB_PATH) as conn:
        exp1_str = conn.execute(
            "SELECT subscription_expires_at FROM users WHERE email = ?", (email,)
        ).fetchone()[0]

    chk2 = client.post(
        "/api/v1/payments/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan_code": "pro_monthly"},
    ).json()
    _activate_via_webhook(client, chk2["tracker"])

    with sqlite3.connect(_DB_PATH) as conn:
        exp2_str = conn.execute(
            "SELECT subscription_expires_at FROM users WHERE email = ?", (email,)
        ).fetchone()[0]

    # Stacked expiry must be strictly later than the first one (~+30 days).
    def _parse(s: str) -> datetime:
        s = s.replace("Z", "+00:00") if s.endswith("Z") else s
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            # SQLite stores naive datetimes
            return datetime.fromisoformat(s.split(".")[0])

    e1, e2 = _parse(exp1_str), _parse(exp2_str)
    delta = e2 - e1
    assert delta > timedelta(days=25)
    assert delta < timedelta(days=35)
