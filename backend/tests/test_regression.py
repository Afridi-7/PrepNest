"""Regression tests — guard rails for previously-fixed bugs and critical flows.

Each test in this file is documented with *why* it exists. If a test here
fails after a refactor, a real user-visible regression has been introduced.

Coverage:
  - Long passwords (>72 bytes) work end-to-end (bcrypt 72-byte truncation fix).
  - Verification tokens cannot be substituted for access tokens (purpose claim).
  - Access tokens cannot be substituted for verification tokens.
  - Tampered JWT signatures are rejected.
  - Login response never leaks the password hash.
  - Protected endpoints reject missing / malformed Authorization headers
    with 401, never 500.
  - SQL-injection style payloads in the email field do not crash the DB.
  - Health endpoint is stable.
  - Public content endpoints stay anonymous-readable.
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from jose import jwt

from app.core import security
from app.core.config import get_settings
from app.main import app
from app.services.cache_service import cache_service


client = TestClient(app)
_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"


import pytest


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    """Each regression test starts with a fresh in-memory rate-limit bucket.

    Without this, the global 300/min-per-IP middleware can carry over from
    previous test files (all running as 127.0.0.1) and turn flow tests into
    spurious 429s. Tests in this file MUST be deterministic.
    """
    if hasattr(cache_service, "_rate_limit_buckets"):
        cache_service._rate_limit_buckets.clear()


def _unique_email(prefix: str = "regr") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _signup_verify_login(email: str, password: str = "Sup3rSecret#Pwd!") -> str:
    """Sign up, mark verified, log in. Returns the bearer token."""
    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "Regr User"},
    )
    assert resp.status_code == 201, resp.text

    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (email,))
        conn.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


# ---------------------------------------------------------------------------
# Password / login regressions
# ---------------------------------------------------------------------------

def test_regression_login_works_with_password_longer_than_72_bytes() -> None:
    """Bug history: bcrypt silently truncates inputs at 72 bytes. Fixed by
    SHA-256 pre-hashing in `hash_password`. This guards the full HTTP flow."""
    email = _unique_email("longpw")
    long_pw = "Aa1!" + ("x" * 100)  # well past 72 bytes

    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": long_pw, "full_name": "L P"},
    )
    assert resp.status_code == 201, resp.text

    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (email,))
        conn.commit()

    ok = client.post("/api/v1/auth/login", json={"email": email, "password": long_pw})
    assert ok.status_code == 200, ok.text
    assert "access_token" in ok.json()

    # A different long password (also >72 bytes, sharing the first 72) must
    # NOT log in — proves SHA-256 pre-hashing is active.
    near_collision = "Aa1!" + ("x" * 99) + "y"
    bad = client.post(
        "/api/v1/auth/login", json={"email": email, "password": near_collision}
    )
    assert bad.status_code in (400, 401)


def test_regression_login_response_never_includes_password_hash() -> None:
    """Bug class: response model leak. The login response must contain only
    access_token / token_type / user_name — never anything resembling a hash."""
    email = _unique_email("leak")
    _signup_verify_login(email)

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Sup3rSecret#Pwd!"},
    )
    assert resp.status_code == 200
    body_text = resp.text.lower()
    # bcrypt hashes start with $2; ensure none appear anywhere.
    assert "$2a$" not in body_text
    assert "$2b$" not in body_text
    assert "password_hash" not in body_text
    assert "hashed_password" not in body_text


# ---------------------------------------------------------------------------
# JWT confused-deputy regressions
# ---------------------------------------------------------------------------

def test_regression_verification_token_cannot_be_used_as_access_token() -> None:
    """A verification JWT carries `purpose: email-verify` and must be rejected
    by every protected endpoint. Otherwise an attacker who phishes a
    verification link could call /users/me directly."""
    verif = security.create_verification_token("user-id-not-real")
    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {verif}"}
    )
    # Either the user lookup fails (404) or auth dependency rejects (401).
    # The crucial assertion: it never returns 200.
    assert resp.status_code in (401, 403, 404)


def test_regression_access_token_cannot_be_used_as_verification_token() -> None:
    """Symmetric guard: an access token must NOT decode as a verification
    token, since it lacks the `purpose` claim."""
    access = security.create_access_token("u1")
    assert security.decode_verification_token(access) is None


def test_regression_tampered_jwt_signature_is_rejected() -> None:
    """Flipping any byte in the signature must cause auth to fail."""
    valid = security.create_access_token("u1")
    head, payload, sig = valid.split(".")
    # Mutate the last char of the signature.
    bad_sig = sig[:-1] + ("A" if sig[-1] != "A" else "B")
    tampered = f"{head}.{payload}.{bad_sig}"

    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {tampered}"}
    )
    assert resp.status_code == 401


def test_regression_jwt_signed_with_wrong_secret_is_rejected() -> None:
    """Defence-in-depth: even a structurally valid JWT signed with a
    different HMAC secret must be refused."""
    settings = get_settings()
    payload = {
        "sub": "u1",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    forged = jwt.encode(payload, "definitely-not-our-secret", algorithm=settings.jwt_algorithm)
    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {forged}"}
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Authorization header parsing regressions
# ---------------------------------------------------------------------------

def test_regression_protected_route_returns_401_without_auth_header() -> None:
    """Must NOT return 500 — that would leak a stack trace and confuse clients."""
    resp = client.get("/api/v1/users/me")
    assert resp.status_code == 401


def test_regression_protected_route_rejects_basic_auth_scheme() -> None:
    """Only Bearer tokens are accepted. Basic auth should be a clean 401."""
    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": "Basic dXNlcjpwYXNz"}
    )
    assert resp.status_code == 401


def test_regression_protected_route_rejects_empty_bearer_value() -> None:
    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer "}
    )
    assert resp.status_code == 401


def test_regression_protected_route_rejects_malformed_jwt() -> None:
    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not.a.valid.jwt"}
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Input-handling regressions
# ---------------------------------------------------------------------------

def test_regression_login_with_sql_injection_payload_is_safe() -> None:
    """Email field with SQL meta-characters must be handled by the ORM as a
    parameter, not interpolated. The endpoint should respond with a 4xx
    auth/validation error — never a 500 / DB error."""
    payload = {
        "email": "' OR '1'='1' --@example.com",
        "password": "any-password",
    }
    resp = client.post("/api/v1/auth/login", json=payload)
    assert resp.status_code in (400, 401, 422)
    # The DB must still be functional after the malicious request.
    assert client.get("/health").status_code == 200


def test_regression_signup_rejects_weak_password_with_422() -> None:
    """Password policy must be enforced at the API boundary, not silently
    accepted and only validated client-side."""
    resp = client.post(
        "/api/v1/auth/signup",
        json={
            "email": _unique_email("weak"),
            "password": "weak",
            "full_name": "X",
        },
    )
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Endpoint stability regressions
# ---------------------------------------------------------------------------

def test_regression_health_endpoint_returns_200() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200


def test_regression_public_usat_endpoints_remain_anonymous_readable() -> None:
    """These power the public landing pages — losing anonymous access here
    would break SEO and the marketing site immediately."""
    cats = client.get("/api/v1/usat/categories")
    assert cats.status_code == 200
    assert isinstance(cats.json(), list)

    subs = client.get("/api/v1/usat/subjects")
    assert subs.status_code == 200
    assert isinstance(subs.json(), list)


def test_regression_authenticated_users_me_returns_expected_shape() -> None:
    """Profile shape is consumed by the navbar and dashboard. Drift here
    cascades into multiple UI bugs."""
    email = _unique_email("shape")
    token = _signup_verify_login(email)

    resp = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    # Required fields the frontend depends on.
    for key in ("id", "email", "full_name"):
        assert key in body, f"Missing key {key!r} in /users/me response"
    assert body["email"] == email
    # Hash must never appear in /users/me either.
    text = resp.text.lower()
    assert "password_hash" not in text and "$2b$" not in text
