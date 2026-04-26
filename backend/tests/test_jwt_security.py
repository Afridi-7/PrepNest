"""Unit tests for JWT helpers in app.core.security."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core import security
from app.core.config import get_settings


def _settings():
    return get_settings()


def test_access_token_round_trip() -> None:
    token = security.create_access_token("user-123")
    assert security.decode_access_token(token) == "user-123"


def test_decode_access_token_rejects_garbage() -> None:
    assert security.decode_access_token("not.a.jwt") is None


def test_decode_access_token_rejects_empty_string() -> None:
    assert security.decode_access_token("") is None


def test_decode_access_token_rejects_non_string() -> None:
    # Defensive: callers might accidentally pass None or bytes.
    assert security.decode_access_token(None) is None  # type: ignore[arg-type]
    assert security.decode_access_token(b"abc") is None  # type: ignore[arg-type]


def test_decode_access_token_rejects_token_signed_with_wrong_secret() -> None:
    settings = _settings()
    payload = {
        "sub": "u1",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    bad = jwt.encode(payload, "different-secret", algorithm=settings.jwt_algorithm)
    assert security.decode_access_token(bad) is None


def test_decode_access_token_rejects_expired_token() -> None:
    settings = _settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "u1",
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
    }
    expired = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    assert security.decode_access_token(expired) is None


def test_decode_access_token_rejects_token_missing_sub_claim() -> None:
    settings = _settings()
    payload = {
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    bad = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    assert security.decode_access_token(bad) is None


def test_decode_access_token_rejects_empty_sub() -> None:
    settings = _settings()
    payload = {
        "sub": "",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    bad = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    assert security.decode_access_token(bad) is None


# ---------------------------------------------------------------------------
# Verification tokens
# ---------------------------------------------------------------------------

def test_verification_token_round_trip() -> None:
    token = security.create_verification_token("u-42")
    assert security.decode_verification_token(token) == "u-42"


def test_decode_verification_token_rejects_token_with_wrong_purpose() -> None:
    """A normal access token must NOT validate as a verification token,
    because it lacks `purpose: 'email-verify'`."""
    access = security.create_access_token("u-42")
    assert security.decode_verification_token(access) is None


def test_decode_verification_token_rejects_invalid_purpose_claim() -> None:
    settings = _settings()
    payload = {
        "sub": "u-42",
        "purpose": "password-reset",  # wrong purpose
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    assert security.decode_verification_token(token) is None


def test_decode_verification_token_rejects_expired_token() -> None:
    settings = _settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "u-42",
        "purpose": "email-verify",
        "iat": now - timedelta(hours=48),
        "exp": now - timedelta(hours=24),
    }
    token = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    assert security.decode_verification_token(token) is None


def test_decode_verification_token_rejects_garbage() -> None:
    assert security.decode_verification_token("xxx.yyy.zzz") is None
    assert security.decode_verification_token("") is None
    assert security.decode_verification_token(None) is None  # type: ignore[arg-type]
