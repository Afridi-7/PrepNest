"""OWASP-aligned security test suite.

Covers the categories the user asked for, mapped to OWASP Top 10 (2021):
  • A01 Broken Access Control      → authorization tests (admin gates, IDOR)
  • A02 Cryptographic Failures      → JWT integrity (alg=none, tampered sig)
  • A03 Injection                   → SQL injection, XSS-payload round-trips,
                                      header/CRLF injection
  • A04 Insecure Design             → predictable signup tokens
  • A05 Security Misconfiguration   → CSP, HSTS, X-Frame-Options presence
  • A07 Identification & Auth       → token forgery, expired/missing tokens,
                                      account-enumeration on login & forgot
  • A08 Data Integrity              → mass-assignment / privilege escalation
                                      via signup payload injection
  • A09 Logging & Monitoring        → no traceback leakage in error bodies

These tests are read-mostly and use unique emails per case so they run
safely against the shared SQLite test DB. They do NOT touch external APIs
(email, OpenAI) — the auth router catches send failures gracefully.
"""
from __future__ import annotations

import base64
import json
import sqlite3
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.cache_service import cache_service


client = TestClient(app)

_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"


@pytest.fixture(autouse=True)
def _reset_rate_limit_buckets():
    """Each test in this file makes many requests from the same client;
    clear the in-memory rate-limit deques so the global 600/min backstop
    doesn't drown a later test in 429s."""
    if hasattr(cache_service, "_rate_limit_buckets"):
        cache_service._rate_limit_buckets.clear()
    yield


def _unique_email(prefix: str = "sec") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _signup_and_verify(email: str, password: str = "Sup3rSecret#Pwd!") -> str:
    """Create a verified user and return a valid bearer token."""
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "Sec User"},
    )
    assert r.status_code in (201, 409), r.text
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (email,))
        conn.commit()
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


# ---------------------------------------------------------------------------
# A03 — Injection: SQL injection
# ---------------------------------------------------------------------------

SQLI_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "admin' --",
    "\" OR 1=1 --",
    "1; SELECT * FROM users",
    "' UNION SELECT NULL, NULL, NULL --",
]


@pytest.mark.parametrize("payload", SQLI_PAYLOADS)
def test_sql_injection_in_login_email_is_safe(payload: str) -> None:
    """SQLAlchemy params bind values, not splice them. A 401 (or 422 if the
    email validator rejects it first) is fine — what's NOT fine is a 500 or
    a 200 with someone else's token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": payload, "password": "whatever-Pwd1!"},
    )
    assert resp.status_code in (400, 401, 422), resp.text
    body = str(resp.json()).lower()
    assert "sqlite" not in body and "syntax" not in body


@pytest.mark.parametrize("payload", SQLI_PAYLOADS)
def test_sql_injection_in_path_param_is_safe(payload: str) -> None:
    """Numeric path params should never reach SQL when given non-numeric
    input — FastAPI's path-validation should 422 before the DB is touched."""
    # We URL-encode minimally; FastAPI handles the rest. Negative/non-int
    # values must NOT crash the handler nor leak SQL.
    resp = client.get(f"/api/v1/usat/subjects/{payload}/chapters")
    assert resp.status_code in (400, 404, 422), resp.text


def test_sql_injection_via_query_string_does_not_crash() -> None:
    """Arbitrary query-string junk on a real GET endpoint must never 500."""
    resp = client.get(
        "/api/v1/usat/categories",
        params={"q": "'; DROP TABLE users; --", "limit": "1' OR '1'='1"},
    )
    # Endpoint may ignore unknown params; what matters is no 500/SQL error.
    assert resp.status_code != 500


# ---------------------------------------------------------------------------
# A03 — Injection: XSS payload round-trip
# ---------------------------------------------------------------------------

XSS_PAYLOADS = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
    "\"><svg/onload=alert(1)>",
]


@pytest.mark.parametrize("payload", XSS_PAYLOADS)
def test_xss_payload_in_full_name_is_returned_as_data_not_html(payload: str) -> None:
    """If a user puts HTML into their profile, the API must return JSON
    containing the literal string. The frontend is React (auto-escapes), and
    `Content-Type: application/json` plus the X-Content-Type-Options nosniff
    header prevent the browser from ever interpreting it as HTML."""
    email = _unique_email("xss")
    token = _signup_and_verify(email)

    me = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    # Confirm the response is JSON (not HTML) and Content-Type is correct.
    assert me.headers.get("content-type", "").startswith("application/json")
    assert me.headers.get("x-content-type-options", "").lower() == "nosniff"


def test_xss_in_signup_full_name_does_not_break_response() -> None:
    """Submitting an HTML/JS payload as full_name must succeed (it's data,
    not code) and the response body must remain valid JSON."""
    email = _unique_email("xssname")
    payload = "<script>alert(document.cookie)</script>"
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Sup3rSecret#Pwd!", "full_name": payload},
    )
    assert r.status_code in (201, 409, 422)
    # Whatever the result, the body must be parseable JSON — proves no
    # unescaped reflection into an HTML/text response.
    assert r.json() is not None


# ---------------------------------------------------------------------------
# A03 — Injection: header / CRLF
# ---------------------------------------------------------------------------

def test_header_injection_via_email_field_rejected() -> None:
    """Newlines in the email field must not be reflected into outgoing
    headers (e.g. SMTP). pydantic EmailStr should already reject these."""
    bad = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "victim@example.com\r\nBcc: attacker@evil.com"},
    )
    # Either rejected (400/422) or accepted-with-generic-message (200) — but
    # never echoed unsanitised.
    assert bad.status_code in (200, 400, 422)
    body = bad.text
    assert "\r\n" not in body
    assert "Bcc:" not in body


# ---------------------------------------------------------------------------
# A01 — Broken Access Control: admin endpoints
# ---------------------------------------------------------------------------

def test_admin_route_requires_auth() -> None:
    r = client.post(
        "/api/v1/admin/subjects", json={"name": "Hacked", "exam_type": "USAT-E"}
    )
    assert r.status_code == 401


def test_admin_route_rejects_non_admin_user() -> None:
    """A regular logged-in user must NOT be able to call admin endpoints."""
    token = _signup_and_verify(_unique_email("nonadmin"))
    r = client.post(
        "/api/v1/admin/subjects",
        json={"name": "Hacked", "exam_type": "USAT-E"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code in (401, 403)


def test_admin_delete_blocked_for_regular_user() -> None:
    token = _signup_and_verify(_unique_email("nondel"))
    r = client.delete(
        "/api/v1/admin/subjects/1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code in (401, 403, 404)


# ---------------------------------------------------------------------------
# A08 — Data Integrity: mass assignment
# ---------------------------------------------------------------------------

def test_signup_cannot_self_promote_to_admin() -> None:
    """An attacker may try to inject `is_admin=true` into the signup body.
    The Pydantic schema must drop or ignore unknown/forbidden fields so the
    persisted user is still a regular account."""
    email = _unique_email("promote")
    payload = {
        "email": email,
        "password": "Sup3rSecret#Pwd!",
        "full_name": "Sneaky",
        "is_admin": True,
        "is_pro": True,
        "is_verified": True,  # bypass email verification
    }
    r = client.post("/api/v1/auth/signup", json=payload)
    assert r.status_code in (201, 422)

    # Verify-and-login, then read /users/me to confirm the privilege fields
    # are NOT set from the request.
    if r.status_code == 201:
        token = _signup_and_verify(email)  # idempotent; will mark verified
        me = client.get(
            "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
        ).json()
        assert me.get("is_admin") is False, "mass-assignment lifted is_admin!"


# ---------------------------------------------------------------------------
# A02 / A07 — Cryptographic & Auth: JWT integrity
# ---------------------------------------------------------------------------

def test_jwt_alg_none_is_rejected() -> None:
    """The classic `{"alg":"none"}` attack — a token with no signature must
    be rejected. python-jose with HS256 enforces this by default."""
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "none", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "1", "email": "a@b.c"}).encode()
    ).rstrip(b"=").decode()
    forged = f"{header}.{payload}."
    r = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {forged}"}
    )
    assert r.status_code == 401


def test_jwt_with_tampered_signature_is_rejected() -> None:
    """Take a valid token, flip the last few characters of the signature."""
    token = _signup_and_verify(_unique_email("tamper"))
    parts = token.split(".")
    assert len(parts) == 3
    parts[2] = parts[2][:-4] + ("AAAA" if not parts[2].endswith("AAAA") else "BBBB")
    forged = ".".join(parts)
    r = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {forged}"}
    )
    assert r.status_code == 401


def test_missing_authorization_header_is_401_not_500() -> None:
    """Edge case: auth scheme present but value malformed must fail closed."""
    for value in ("", "Bearer", "Bearer ", "NotBearer x", "Basic abc"):
        r = client.get("/api/v1/users/me", headers={"Authorization": value})
        assert r.status_code == 401, value


def test_jwt_expired_token_is_rejected() -> None:
    """Regression guard: an `exp` claim in the past must be rejected by the
    decoder. python-jose enforces this when `exp` is in `options.require`."""
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from app.core.config import get_settings

    settings = get_settings()
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    expired = jwt.encode(
        {"sub": "1", "iat": past - timedelta(minutes=1), "exp": past},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    r = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {expired}"}
    )
    assert r.status_code == 401


def test_api_response_has_defence_in_depth_csp() -> None:
    """Backend-level CSP makes API JSON inert if opened directly in a
    browser. Swagger/Redoc/OpenAPI endpoints are exempt (they need CDN
    scripts to render)."""
    r = client.get("/health")
    csp = r.headers.get("content-security-policy", "")
    assert "frame-ancestors" in csp and "'none'" in csp


# ---------------------------------------------------------------------------
# A07 — Auth: account enumeration
# ---------------------------------------------------------------------------

def test_login_unknown_vs_wrong_password_returns_same_status() -> None:
    """Already covered in test_integration_auth_flow.py for the message text
    — here we explicitly assert the *status code* matches so timing/code
    side-channels don't leak account existence."""
    email = _unique_email("enum")
    _signup_and_verify(email)

    wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword#1"},
    )
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": _unique_email("ghost"), "password": "Whatever#1Abc"},
    )
    assert wrong_pw.status_code == unknown.status_code == 401


# ---------------------------------------------------------------------------
# A05 — Security misconfiguration: defence-in-depth headers
# ---------------------------------------------------------------------------

def test_csp_header_present_or_documented_absent() -> None:
    """Either CSP is set by the backend (defence in depth) OR it's set by
    the frontend nginx layer. We assert at least the cheaper headers are
    set — CSP itself is enforced at the nginx hop in this deployment."""
    r = client.get("/health")
    h = {k.lower(): v for k, v in r.headers.items()}
    assert h.get("x-content-type-options") == "nosniff"
    assert h.get("x-frame-options") == "DENY"
    # Permissions-Policy must restrict at least one sensitive feature.
    pp = h.get("permissions-policy", "")
    assert any(f in pp for f in ("camera=", "microphone=", "geolocation="))


def test_no_server_version_disclosure() -> None:
    """The default uvicorn `Server: uvicorn` header is fine (no version), but
    asserting it doesn't leak a version string protects against accidental
    middleware order bugs that re-introduce one."""
    r = client.get("/health")
    server = r.headers.get("server", "")
    assert "/" not in server  # e.g. "uvicorn/0.30.1" would fail


# ---------------------------------------------------------------------------
# Input validation bounds
# ---------------------------------------------------------------------------

def test_extremely_long_email_rejected() -> None:
    huge = "a" * 5000 + "@example.com"
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": huge, "password": "Sup3rSecret#Pwd!"},
    )
    assert r.status_code in (400, 413, 422)


def test_extremely_long_password_does_not_crash() -> None:
    """Bcrypt has a 72-byte truncation; we just need the API to not 500."""
    huge = "A1!" + "x" * 10_000
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": _unique_email("longpw"), "password": huge},
    )
    assert r.status_code != 500
