import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.schemas.user import (
    SignupResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


async def create_user_signup(
    payload: UserRegisterRequest,
    db: AsyncSession,
) -> SignupResponse:
    user_repo = UserRepository(db)
    existing_user = await user_repo.get_by_email(payload.email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    await user_repo.create(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )

    return SignupResponse(
        message="Account created successfully. You can now log in.",
    )


@router.post("/register", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
) -> SignupResponse:
    """Register user account."""
    return await create_user_signup(payload, db)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
) -> SignupResponse:
    """Alias for /register endpoint to match frontend expectations."""
    return await create_user_signup(payload, db)


@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLoginRequest, db: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    """Authenticate user and return access token."""
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")
