from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.models import User
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.services.cache_service import cache_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def rate_limit(limit_per_minute: int = 60, key_prefix: str = "global"):
    """Return a FastAPI dependency that enforces per-IP rate limiting."""

    async def _check(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        bucket_key = f"{key_prefix}:{client_ip}"
        allowed = await cache_service.check_rate_limit(bucket_key, limit_per_minute)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )

    return _check


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email to access this resource.",
        )
    return current_user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


def is_user_pro(user: User) -> bool:
    """Return True if the user has pro access (paid or admin)."""
    return bool(user.is_pro or user.is_admin)


async def get_current_pro_user(current_user: User = Depends(get_current_user)) -> User:
    if not is_user_pro(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a Pro subscription.",
        )
    return current_user
