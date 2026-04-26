"""Integration tests — end-to-end auth flow against the FastAPI app and the
real (SQLite) DB.

These exercise multiple layers together:
  • HTTP layer (FastAPI router + middleware)
  • Pydantic validation
  • SQLAlchemy repositories
  • bcrypt password hashing + JWT issuance/verification

External services (Resend email) fail gracefully via the auth router's
try/except, so we don't need to mock them — signup completes even when no
email key is configured, which is exactly what happens in CI/local dev.

Each test uses a unique email (uuid4) so re-runs and parallel test files
don't collide on the shared dev SQLite database.
"""
from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

# The dev/test database is the local SQLite file used by app.db.session when
# DATABASE_URL points at localhost. We mutate it directly via a sync
# connection so the test helper doesn't fight TestClient's async event loop.
_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"


def _unique_email(prefix: str = "intg") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _mark_verified(email: str) -> None:
    """Test helper: flip `is_verified=1` directly on the SQLite row,
    simulating the user clicking the email-verify link."""
    assert _DB_PATH.exists(), f"expected dev SQLite DB at {_DB_PATH}"
    with sqlite3.connect(_DB_PATH) as conn:
        cur = conn.execute(
            "UPDATE users SET is_verified = 1 WHERE email = ?",
            (email,),
        )
        conn.commit()
        assert cur.rowcount == 1, f"user {email} not found in DB"


# ---------------------------------------------------------------------------
# Happy path: signup → verify → login → /users/me
# ---------------------------------------------------------------------------

def test_full_signup_login_me_flow() -> None:
    email = _unique_email()
    password = "Sup3rSecret#Pwd!"

    # 1. Signup creates the user and returns 201.
    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    assert signup.status_code == 201, signup.text
    assert "verify" in signup.json()["message"].lower()

    # 2. Login BEFORE verification must be blocked (403).
    pre_verify = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert pre_verify.status_code == 403

    # 3. Mark the user verified (simulating email-link click).
    _mark_verified(email)

    # 4. Login now succeeds and returns a JWT.
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["token_type"] == "bearer"
    token = body["access_token"]
    assert token and isinstance(token, str)
    assert body["user_name"] == "Test User"

    # 5. Authenticated /users/me returns the same user.
    me = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200, me.text
    profile = me.json()
    assert profile["email"] == email
    assert profile["full_name"] == "Test User"
    assert profile["is_admin"] is False
    # Sensitive fields must never be serialised back to the client.
    assert "password" not in profile
    assert "password_hash" not in profile


# ---------------------------------------------------------------------------
# Negative paths
# ---------------------------------------------------------------------------

def test_signup_duplicate_email_returns_409() -> None:
    email = _unique_email("dup")
    payload = {"email": email, "password": "Sup3rSecret#Pwd!", "full_name": "A"}

    first = client.post("/api/v1/auth/signup", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/auth/signup", json=payload)
    assert second.status_code == 409
    assert "already registered" in second.json()["detail"].lower()


def test_login_wrong_password_returns_401() -> None:
    email = _unique_email("wrongpw")
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Sup3rSecret#Pwd!", "full_name": "X"},
    )
    _mark_verified(email)

    bad = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword#1"},
    )
    assert bad.status_code == 401
    assert "invalid" in bad.json()["detail"].lower()


def test_login_unknown_email_returns_401_without_leaking() -> None:
    """An unknown email must give the SAME 401 response as a wrong password,
    so attackers cannot enumerate which emails are registered."""
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": _unique_email("ghost"), "password": "Whatever#1Abc"},
    )
    assert bad.status_code == 401
    assert "invalid" in bad.json()["detail"].lower()


def test_signup_rejects_short_password() -> None:
    short = client.post(
        "/api/v1/auth/signup",
        json={"email": _unique_email("short"), "password": "abc", "full_name": "X"},
    )
    assert short.status_code in (400, 422)


def test_signup_rejects_invalid_email_format() -> None:
    bad = client.post(
        "/api/v1/auth/signup",
        json={"email": "definitely-not-an-email", "password": "Sup3rSecret#Pwd!"},
    )
    assert bad.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Forgot-password: don't leak account existence
# ---------------------------------------------------------------------------

def test_forgot_password_returns_generic_message_for_unknown_email() -> None:
    resp = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": _unique_email("noone")},
    )
    assert resp.status_code == 200
    msg = resp.json()["message"].lower()
    # Must not say "no such user" or "not found".
    assert "if that email" in msg or "reset link" in msg


def test_forgot_password_returns_same_generic_message_for_existing_email() -> None:
    email = _unique_email("known")
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Sup3rSecret#Pwd!"},
    )

    resp = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": email},
    )
    assert resp.status_code == 200
    # Same generic phrasing — both branches converge on the same message.
    msg = resp.json()["message"].lower()
    assert "if that email" in msg or "reset link" in msg
