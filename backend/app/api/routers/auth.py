import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import rate_limit
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_verification_token,
    decode_verification_token,
    hash_password,
    hash_password_reset_token,
    verify_password,
)
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.schemas.user import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    ResetPasswordValidateRequest,
    SignupResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.services.email_service import async_send_password_reset_email, async_send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _mask_email(email: str | None) -> str:
    """Return a privacy-safe form of an email for log lines.

    Avoids leaking full PII into logs (which often ship to third-party log
    aggregators) while keeping enough context for debugging.
    """
    if not email or "@" not in email:
        return "<redacted>"
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked_local = local[:1] + "*"
    else:
        masked_local = f"{local[0]}***{local[-1]}"
    return f"{masked_local}@{domain}"

GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"
PASSWORD_RESET_GENERIC_MESSAGE = "If that email is registered, a password reset link has been sent."
PASSWORD_RESET_SUCCESS_MESSAGE = "Password updated successfully."


def _build_verification_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_url}/verify-email?token={token}"


def _build_password_reset_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_url}/reset-password?token={token}"


async def _send_verification(user, repo: UserRepository) -> None:
    token = create_verification_token(user.id)
    await repo.set_verification_token(user, token)
    try:
        await async_send_verification_email(user.email, _build_verification_url(token))
    except Exception as exc:
        logger.error("Email send failed for %s: %s", _mask_email(user.email), exc)


def _is_reset_token_expired(user) -> bool:
    expires_at = user.reset_password_token_expires_at
    if not expires_at:
        return True
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= datetime.now(timezone.utc)


async def _validate_reset_token_or_raise(token: str, repo: UserRepository):
    token_hash = hash_password_reset_token(token)
    user = await repo.get_by_reset_token_hash(token_hash)
    if not user or not user.reset_password_token_hash:
        logger.warning("Password reset attempted with unknown token hash")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")
    if _is_reset_token_expired(user):
        logger.info("Expired password reset token used for user_id=%s", user.id)
        await repo.clear_password_reset_token(user)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")
    return user


async def _issue_password_reset(user, repo: UserRepository) -> None:
    settings = get_settings()
    token = create_password_reset_token()
    token_hash = hash_password_reset_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_token_exp_minutes)
    await repo.set_password_reset_token(
        user,
        token_hash=token_hash,
        expires_at=expires_at,
        requested_at=datetime.now(timezone.utc),
    )
    try:
        await async_send_password_reset_email(
            user.email,
            _build_password_reset_url(token),
            settings.password_reset_token_exp_minutes,
        )
    except Exception as exc:
        logger.error("Password reset email send failed for %s: %s", _mask_email(user.email), exc)


async def create_user_signup(payload: UserRegisterRequest, db: AsyncSession) -> SignupResponse:
    user_repo = UserRepository(db)
    existing_user = await user_repo.get_by_email(payload.email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await user_repo.create(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )

    await _send_verification(user, user_repo)

    return SignupResponse(
        message="Account created! Your 3-day free Pro trial is active. Please check your email to verify your account.",
    )


@router.post("/register", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_register")),
) -> SignupResponse:
    return await create_user_signup(payload, db)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_register")),
) -> SignupResponse:
    return await create_user_signup(payload, db)


@router.get("/verify-email")
async def verify_email(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_verify")),
):
    user_id = decode_verification_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link")

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification link")

    if user.is_verified:
        return {"message": "Email already verified. You can log in."}

    await repo.set_verified(user)
    return {"message": "Email verified successfully! You can now log in."}


@router.post("/resend-verification", response_model=SignupResponse)
async def resend_verification(
    payload: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(5, "auth_resend")),
) -> SignupResponse:
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)

    if not user:
        return SignupResponse(message="If that email is registered, a verification link has been sent.")

    if user.is_verified:
        return SignupResponse(message="Email is already verified. You can log in.")

    await _send_verification(user, repo)
    return SignupResponse(message="If that email is registered, a verification link has been sent.")


@router.post("/forgot-password", response_model=SignupResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(5, "auth_forgot_password")),
) -> SignupResponse:
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)

    if not user:
        logger.info("Password reset requested for unknown email=%s", _mask_email(payload.email))
        return SignupResponse(message=PASSWORD_RESET_GENERIC_MESSAGE)

    if not user.is_active:
        logger.warning("Password reset requested for inactive user_id=%s", user.id)
        return SignupResponse(message=PASSWORD_RESET_GENERIC_MESSAGE)

    await _issue_password_reset(user, repo)
    return SignupResponse(message=PASSWORD_RESET_GENERIC_MESSAGE)


@router.post("/reset-password/validate", response_model=SignupResponse)
async def validate_reset_password_token(
    payload: ResetPasswordValidateRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(20, "auth_reset_validate")),
) -> SignupResponse:
    repo = UserRepository(db)
    await _validate_reset_token_or_raise(payload.token, repo)
    return SignupResponse(message="Reset token is valid.")


@router.post("/reset-password", response_model=SignupResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_reset_password")),
) -> SignupResponse:
    repo = UserRepository(db)
    user = await _validate_reset_token_or_raise(payload.token, repo)
    await repo.update_password(user, hash_password(payload.new_password))
    logger.info("Password reset completed for user_id=%s", user.id)
    return SignupResponse(message=PASSWORD_RESET_SUCCESS_MESSAGE)


@router.post("/login", response_model=TokenResponse)
async def login_user(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_login")),
) -> TokenResponse:
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)
    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in. Check your inbox for the verification link.",
        )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer", user_name=user.full_name or user.email.split("@")[0])


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_google")),
) -> TokenResponse:
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_TOKEN_INFO_URL, params={"id_token": payload.credential})

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    token_data = resp.json()

    if settings.google_client_id and token_data.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token audience mismatch")

    google_id = token_data.get("sub")
    email = token_data.get("email")
    name = token_data.get("name")

    if not email or not google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not retrieve email from Google")

    repo = UserRepository(db)

    user = await repo.get_by_google_id(google_id)
    if not user:
        user = await repo.get_by_email(email)
        if user:
            await repo.link_google_id(user, google_id)
        else:
            user = await repo.create_google_user(email=email, full_name=name, google_id=google_id)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")
