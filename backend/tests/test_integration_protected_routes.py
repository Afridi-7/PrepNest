"""Integration tests — authenticated and public read flows hitting the DB.

Covers:
  • Public content endpoints (no auth) → router → DB → JSON shape.
  • Token-protected endpoints reject missing/invalid tokens consistently.
  • A freshly-issued JWT successfully authenticates against /users/me.
"""
from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"


def _signup_and_verify(email: str, password: str = "Sup3rSecret#Pwd!") -> str:
    """Helper: signup → mark verified (sync sqlite UPDATE) → login → return Bearer token."""
    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "I"},
    )
    assert resp.status_code == 201, resp.text

    with sqlite3.connect(_DB_PATH) as conn:
        cur = conn.execute(
            "UPDATE users SET is_verified = 1 WHERE email = ?",
            (email,),
        )
        conn.commit()
        assert cur.rowcount == 1

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


# ---------------------------------------------------------------------------
# Public reads (anonymous → DB)
# ---------------------------------------------------------------------------

def test_public_usat_categories_returns_a_list() -> None:
    resp = client.get("/api/v1/usat/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_public_subjects_returns_a_list() -> None:
    resp = client.get("/api/v1/usat/subjects")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # If there's any subject, it must have the expected shape.
    if data:
        first = data[0]
        assert "id" in first
        assert "name" in first


# ---------------------------------------------------------------------------
# Authenticated reads
# ---------------------------------------------------------------------------

def test_users_me_with_valid_token_returns_profile_shape() -> None:
    email = f"intgme-{uuid.uuid4().hex[:10]}@example.com"
    token = _signup_and_verify(email)

    resp = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    profile = resp.json()
    # Schema-level assertions (no leaking of the password hash).
    assert profile["email"] == email
    assert "id" in profile
    assert profile["is_admin"] is False
    assert "password_hash" not in profile
    assert "password" not in profile


def test_users_me_without_token_returns_401() -> None:
    resp = client.get("/api/v1/users/me")
    assert resp.status_code == 401


def test_users_me_with_malformed_bearer_returns_401() -> None:
    resp = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer xxx.yyy.zzz"},
    )
    assert resp.status_code == 401


def test_users_me_with_swapped_signature_returns_401() -> None:
    """A token whose signature is wrong (e.g. issued by another deployment)
    must be rejected — proves JWT signature verification is wired."""
    email = f"intgsig-{uuid.uuid4().hex[:10]}@example.com"
    token = _signup_and_verify(email)

    # Tamper: replace the last character of the signature segment.
    parts = token.split(".")
    assert len(parts) == 3
    tampered_sig = parts[2][:-1] + ("A" if parts[2][-1] != "A" else "B")
    bad = ".".join([parts[0], parts[1], tampered_sig])

    resp = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {bad}"},
    )
    assert resp.status_code == 401
