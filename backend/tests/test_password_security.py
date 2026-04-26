"""Unit tests for password helpers in app.core.security.

These cover hashing, verification, strength validation, and reset-token
helpers without touching the database or external services.
"""
from __future__ import annotations

import re

from app.core import security


def test_hash_password_returns_bcrypt_hash() -> None:
    h = security.hash_password("CorrectHorse1!")
    assert isinstance(h, str)
    # bcrypt hashes always start with $2 and are 60 chars long
    assert h.startswith("$2")
    assert len(h) == 60


def test_hash_password_produces_unique_hashes_per_call() -> None:
    # bcrypt salts each call → identical input must produce distinct hashes.
    a = security.hash_password("CorrectHorse1!")
    b = security.hash_password("CorrectHorse1!")
    assert a != b


def test_verify_password_accepts_correct_password() -> None:
    h = security.hash_password("Sup3rSecret#")
    assert security.verify_password("Sup3rSecret#", h) is True


def test_verify_password_rejects_wrong_password() -> None:
    h = security.hash_password("Sup3rSecret#")
    assert security.verify_password("Sup3rSecret#WRONG", h) is False


def test_hash_password_handles_passwords_longer_than_72_bytes() -> None:
    """bcrypt truncates at 72 bytes; the SHA-256 pre-hash protects us."""
    very_long = "a" * 200 + "B1!"
    h = security.hash_password(very_long)
    assert security.verify_password(very_long, h) is True
    # Different long password should NOT match.
    assert security.verify_password("a" * 200 + "B2!", h) is False


# ---------------------------------------------------------------------------
# validate_password_strength
# ---------------------------------------------------------------------------

def test_validate_password_strength_returns_no_issues_for_strong_password() -> None:
    assert security.validate_password_strength("StrongPass1!") == []


def test_validate_password_strength_flags_short_password() -> None:
    issues = security.validate_password_strength("Ab1!")
    assert any("at least" in i.lower() for i in issues)


def test_validate_password_strength_flags_missing_uppercase() -> None:
    issues = security.validate_password_strength("alllowercase1!")
    assert any("uppercase" in i.lower() for i in issues)


def test_validate_password_strength_flags_missing_lowercase() -> None:
    issues = security.validate_password_strength("ALLUPPER1!")
    assert any("lowercase" in i.lower() for i in issues)


def test_validate_password_strength_flags_missing_number() -> None:
    issues = security.validate_password_strength("NoNumberHere!")
    assert any("number" in i.lower() for i in issues)


def test_validate_password_strength_flags_missing_special() -> None:
    issues = security.validate_password_strength("NoSpecial1Char")
    assert any("special" in i.lower() for i in issues)


# ---------------------------------------------------------------------------
# Reset token helpers
# ---------------------------------------------------------------------------

def test_create_password_reset_token_is_random_and_url_safe() -> None:
    a = security.create_password_reset_token()
    b = security.create_password_reset_token()
    assert a != b
    # token_urlsafe(32) is at least ~43 chars; pattern must be URL-safe base64.
    assert re.fullmatch(r"[A-Za-z0-9_\-]+", a)
    assert len(a) >= 32


def test_hash_password_reset_token_is_deterministic_sha256_hex() -> None:
    token = "abc123"
    h1 = security.hash_password_reset_token(token)
    h2 = security.hash_password_reset_token(token)
    assert h1 == h2
    # SHA-256 produces a 64-char hex digest.
    assert re.fullmatch(r"[0-9a-f]{64}", h1)
