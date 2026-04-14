import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.api.deps import rate_limit
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_verification_token,
    decode_verification_token,
    hash_password,
    verify_password,
)
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.schemas.user import (
    GoogleAuthRequest,
    ResendVerificationRequest,
    SignupResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.services.email_service import async_send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def _build_verification_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_url}/verify-email?token={token}"


async def _send_verification(user, repo: UserRepository) -> None:
    """Generate token, persist it, and fire verification email (best-effort)."""
    token = create_verification_token(user.id)
    await repo.set_verification_token(user, token)
    try:
        await async_send_verification_email(user.email, _build_verification_url(token))
    except Exception as exc:
        logger.error("Email send failed for %s: %s", user.email, exc)


# ─── Signup ──────────────────────────────────────────────────────────

async def create_user_signup(
    payload: UserRegisterRequest,
    db: AsyncSession,
) -> SignupResponse:
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
        message="Account created! Please check your email to verify your account.",
    )


@router.post("/register", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_register")),
) -> SignupResponse:
    """Register user account."""
    return await create_user_signup(payload, db)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_register")),
) -> SignupResponse:
    """Alias for /register endpoint to match frontend expectations."""
    return await create_user_signup(payload, db)


# ─── Email Verification ─────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "auth_verify")),
):
    """Verify user email via token from the verification link."""
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
    """Resend verification email."""
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)

    if not user:
        # Don't reveal whether email exists
        return SignupResponse(message="If that email is registered, a verification link has been sent.")

    if user.is_verified:
        return SignupResponse(message="Email is already verified. You can log in.")

    await _send_verification(user, repo)
    return SignupResponse(message="If that email is registered, a verification link has been sent.")


# ─── Login ───────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login_user(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(20, "auth_login")),
) -> TokenResponse:
    """Authenticate user and return access token."""
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
    return TokenResponse(access_token=token, token_type="bearer")


# ─── Google OAuth ────────────────────────────────────────────────────

@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(20, "auth_google")),
) -> TokenResponse:
    """Authenticate or register a user via Google ID token."""
    settings = get_settings()

    # Verify the Google ID token
    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_TOKEN_INFO_URL, params={"id_token": payload.credential})

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    token_data = resp.json()

    # Validate audience matches our client id
    if settings.google_client_id and token_data.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token audience mismatch")

    google_id = token_data.get("sub")
    email = token_data.get("email")
    name = token_data.get("name")
    email_verified = token_data.get("email_verified") == "true"

    if not email or not google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not retrieve email from Google")

    repo = UserRepository(db)

    # Check if user already exists by google_id
    user = await repo.get_by_google_id(google_id)
    if not user:
        # Check if user exists by email (e.g. signed up with password first)
        user = await repo.get_by_email(email)
        if user:
            # Link the Google ID to existing account and auto-verify
            await repo.link_google_id(user, google_id)
        else:
            # Create new Google user – auto-verified
            user = await repo.create_google_user(email=email, full_name=name, google_id=google_id)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")
