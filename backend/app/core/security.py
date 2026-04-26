from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

PASSWORD_MIN_LENGTH = 10
PASSWORD_POLICY_MESSAGE = (
    "Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character."
)


def hash_password(password: str) -> str:
    # Pre-hash to support long passwords safely with bcrypt's 72-byte limit.
    normalized = hashlib.sha256(password.encode("utf-8")).digest()
    return bcrypt.hashpw(normalized, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    normalized = hashlib.sha256(password.encode("utf-8")).digest()
    return bcrypt.checkpw(normalized, password_hash.encode("utf-8"))


def validate_password_strength(password: str) -> list[str]:
    issues: list[str] = []
    if len(password) < PASSWORD_MIN_LENGTH:
        issues.append(f"Be at least {PASSWORD_MIN_LENGTH} characters long")
    if not re.search(r"[A-Z]", password):
        issues.append("Include at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        issues.append("Include at least one lowercase letter")
    if not re.search(r"\d", password):
        issues.append("Include at least one number")
    if not re.search(r"[^A-Za-z0-9]", password):
        issues.append("Include at least one special character")
    return issues


def create_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(subject: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.jwt_exp_minutes)
    # `iat` lets us reject tokens forged with a future-dated issue time and
    # supports future "invalidate-before-X" revocation if ever needed. `exp`
    # is enforced by `jwt.decode` automatically via the `require` option.
    payload = {"sub": subject, "iat": now, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    settings = get_settings()
    if not token or not isinstance(token, str):
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        sub = payload.get("sub")
        return sub if isinstance(sub, str) and sub else None
    except JWTError:
        return None


def create_verification_token(user_id: str) -> str:
    """Create a short-lived JWT for email verification (24 h)."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=24)
    payload = {"sub": user_id, "purpose": "email-verify", "iat": now, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_verification_token(token: str) -> str | None:
    """Decode a verification token and return user_id if valid."""
    settings = get_settings()
    if not token or not isinstance(token, str):
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "purpose"]},
        )
        if payload.get("purpose") != "email-verify":
            return None
        sub = payload.get("sub")
        return sub if isinstance(sub, str) and sub else None
    except JWTError:
        return None
