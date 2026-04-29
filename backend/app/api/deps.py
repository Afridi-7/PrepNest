from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.models import User
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.services.cache_service import cache_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _real_client_ip(request: Request) -> str:
    """Resolve the originating client IP, honouring the proxy hop list when
    the deployment sits behind a reverse proxy (Render, Vercel, Cloudflare,
    nginx, ...). Without this, every user shares the proxy's IP and rate
    limits would 429 legitimate traffic in production.
    """
    settings = get_settings()
    if settings.trust_proxy_headers:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            first = xff.split(",", 1)[0].strip()
            if first:
                return first
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else "unknown"


def rate_limit(limit_per_minute: int = 60, key_prefix: str = "global"):
    """Return a FastAPI dependency that enforces per-client rate limiting.

    Bucket key prefers the authenticated user id (survives NAT / shared IPs)
    and falls back to the resolved client IP for anonymous routes.
    """

    async def _check(request: Request) -> None:
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            bucket_key = f"{key_prefix}:user:{user_id}"
        else:
            bucket_key = f"{key_prefix}:ip:{_real_client_ip(request)}"
        allowed = await cache_service.check_rate_limit(bucket_key, limit_per_minute)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": "60"},
            )

    return _check


def daily_quota(limit_per_day: int, key_prefix: str):
    """Return a dependency enforcing a per-user daily quota.

    This is the primary defence against runaway third-party-API costs (OpenAI,
    Resend, etc.). A logged-in user can only consume ``limit_per_day`` calls
    per UTC day across the protected route group; further calls return 429
    until the next day rolls over.

    Falls back to per-IP if no authenticated user is on the request, so
    anonymous abuse is still capped.
    """

    async def _check(request: Request) -> None:
        # We don't take a hard dependency on the auth dep here because some
        # routes are public-but-quota'd. Instead read the resolved user (if
        # any) that earlier deps placed on request.state, otherwise key by IP.
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            # Try the Authorization header — decode lazily to avoid breaking
            # routes that use this without an auth dep.
            authz = request.headers.get("authorization") or ""
            if authz.lower().startswith("bearer "):
                from app.core.security import decode_access_token

                user_id = decode_access_token(authz.split(" ", 1)[1].strip())

        if user_id:
            bucket_key = f"quota:{key_prefix}:user:{user_id}"
        else:
            bucket_key = f"quota:{key_prefix}:ip:{_real_client_ip(request)}"

        allowed = await cache_service.check_daily_quota(bucket_key, limit_per_day)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Daily usage limit reached. Please try again tomorrow."
                ),
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
        # Raises a structured AppError → response body carries
        # ``{detail, code: "pro_required"}`` so the frontend can branch on
        # the code rather than substring-matching the human message.
        from app.core.errors import AppError

        raise AppError.pro_required()
    return current_user
