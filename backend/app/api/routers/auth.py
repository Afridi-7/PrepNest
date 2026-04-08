from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import PendingSignup
from app.db.repositories.pending_signup_repo import PendingSignupRepository
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.services.email_service import email_service
from app.schemas.user import (
    EmailVerificationRequest,
    ResendVerificationRequest,
    SignupResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    VerificationResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)


def _email_delivery_error_detail() -> str:
    return (
        "Verification email could not be sent right now. "
        "Please try again in a moment."
    )


async def send_verification_email_or_503(email: str, verification_url: str, full_name: str | None = None) -> None:
    try:
        await email_service.send_verification_email(email, verification_url, full_name)
    except Exception as error:
        logger.warning("Verification email delivery failed for %s: %s", email, error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_email_delivery_error_detail(),
        ) from error


def build_verification_url(request: Request, token: str, email: str) -> str:
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/api/v1/auth/verify-email?token={token}&email={email}"


def as_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def create_pending_signup(
    payload: UserRegisterRequest,
    db: AsyncSession,
    request: Request,
) -> SignupResponse:
    user_repo = UserRepository(db)
    existing_user = await user_repo.get_by_email(payload.email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    pending_repo = PendingSignupRepository(db)
    pending = await pending_repo.create_or_refresh(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )

    verification_url = build_verification_url(request, pending.token, pending.email)
    await send_verification_email_or_503(pending.email, verification_url, pending.full_name)

    return SignupResponse(
        message=(
            "Verification email sent. Check inbox, spam, and promotions tabs "
            "to finish creating your account."
        ),
        verification_url=verification_url,
    )


@router.post("/register", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SignupResponse:
    """Register a pending signup and send a verification email."""
    return await create_pending_signup(payload, db, request)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(
    payload: UserRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SignupResponse:
    """Alias for /register endpoint to match frontend expectations."""
    return await create_pending_signup(payload, db, request)


@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLoginRequest, db: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    """Authenticate user and return access token."""
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)
    if not user:
        pending_repo = PendingSignupRepository(db)
        pending = await pending_repo.get_by_email(payload.email)
        if pending and pending.verified_at is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Check your inbox to complete signup.",
            )

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")


@router.post("/verify-email", response_model=VerificationResponse)
async def verify_email(
    payload: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db_session),
) -> VerificationResponse:
    """Verify a pending signup token and create the user account."""
    pending_repo = PendingSignupRepository(db)
    pending = await finalize_verification_token(payload.token, pending_repo, db)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification token not found")

    return VerificationResponse(message="Email verified successfully. Your account is ready.")


@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email_via_link(
    token: str,
    db: AsyncSession = Depends(get_db_session),
) -> HTMLResponse:
    """Verify via the emailed link and show a browser-friendly success page."""
    pending_repo = PendingSignupRepository(db)
    pending = await finalize_verification_token(token, pending_repo, db)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification token not found")

    login_url = settings.frontend_url.rstrip("/") + "/login"
    html = f"""
    <html>
      <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Email verified</title>
        <style>
          body {{ font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; display: grid; place-items: center; min-height: 100vh; margin: 0; }}
          .card {{ max-width: 560px; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08); }}
          a {{ display: inline-block; margin-top: 16px; background: #2563eb; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }}
        </style>
      </head>
      <body>
        <div class=\"card\">
          <h1>Email verified</h1>
          <p>Your PrepNest account is ready. You can now log in with the password you chose during signup.</p>
          <a href=\"{login_url}\">Go to Login</a>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@router.post("/resend-verification", response_model=VerificationResponse)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> VerificationResponse:
    """Resend verification email for a pending signup."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(payload.email)
    if user:
        return VerificationResponse(message="This email is already verified. You can log in now.")

    pending_repo = PendingSignupRepository(db)
    pending = await pending_repo.get_by_email(payload.email)
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending signup found for this email")

    refreshed = await pending_repo.create_or_refresh(
        email=pending.email,
        password_hash=pending.password_hash,
        full_name=pending.full_name,
    )

    verification_url = build_verification_url(request, refreshed.token, refreshed.email)
    await send_verification_email_or_503(refreshed.email, verification_url, refreshed.full_name)

    return VerificationResponse(
        message="Verification email resent. Check inbox, spam, and promotions tabs.",
        verification_url=verification_url,
    )


async def finalize_verification_token(
    token: str,
    pending_repo: PendingSignupRepository,
    db: AsyncSession,
) -> PendingSignup | None:
    pending = await pending_repo.get_by_token(token)
    if not pending:
        return None

    now = datetime.now(timezone.utc)
    if as_utc_datetime(pending.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Verification token has expired")

    user_repo = UserRepository(db)
    existing_user = await user_repo.get_by_email(pending.email)
    if existing_user:
        if pending.verified_at is None:
            await pending_repo.mark_verified(pending)
        return pending

    if pending.verified_at is None:
        await pending_repo.mark_verified(pending)
        await user_repo.create(
            email=pending.email,
            password_hash=pending.password_hash,
            full_name=pending.full_name,
        )

    return pending
