from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.security import create_access_token, hash_password, verify_password
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.schemas.user import TokenResponse, UserLoginRequest, UserRegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

DEV_MODE = True


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    """Register user and return access token."""
    if DEV_MODE:
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)
        return TokenResponse(access_token=token, token_type="bearer")
    
    repo = UserRepository(db)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await repo.create(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    """Alias for /register endpoint to match frontend expectations."""
    if DEV_MODE:
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)
        return TokenResponse(access_token=token, token_type="bearer")

    repo = UserRepository(db)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await repo.create(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")


@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLoginRequest, db: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    """Authenticate user and return access token."""
    if DEV_MODE:
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)
        return TokenResponse(access_token=token, token_type="bearer")

    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")
