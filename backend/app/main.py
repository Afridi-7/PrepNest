import logging
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select, text

from app.api.routers import admin_content, ai_learning, auth, chat, conversations, dashboard, files, mock_tests, usat, users
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.models import MCQ, User, Topic, Subject
from app.db.pg_pool import close_pg_pool, get_pg_pool, init_pg_pool
from app.db.session import SessionLocal, database_url, engine
from app.services.cache_service import cache_service

from app.services.supabase_storage import ensure_bucket_exists

settings = get_settings()
configure_logging(logging.DEBUG if settings.app_debug else logging.INFO)

app = FastAPI(title=settings.app_name, version="1.0.0")
app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir_path)), name="uploads")

_default_origins = [
    "https://prepnestai.app",
    "https://www.prepnestai.app",
]
_local_origin_regex = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"


def _normalize_origin(origin: str | None) -> str | None:
    if origin is None:
        return None

    value = origin.strip().rstrip("/")
    if not value:
        return None

    if "://" not in value:
        value = f"http://{value}"

    try:
        parsed = urlsplit(value)
    except ValueError:
        return None

    if not parsed.scheme or not parsed.netloc:
        return None

    return f"{parsed.scheme}://{parsed.netloc}"


def _build_cors_origin_regex(configured_regex: str | None) -> str:
    loopback_pattern = f"(?:{_local_origin_regex})"
    if not configured_regex:
        return loopback_pattern

    return f"(?:{configured_regex})|{loopback_pattern}"

_cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
_cors_kwargs["allow_origin_regex"] = _build_cors_origin_regex(settings.cors_origin_regex)

_configured_origins = []
if settings.frontend_url:
    _configured_origins.append(settings.frontend_url)
if settings.cors_origins:
    _configured_origins.extend(settings.cors_origins.split(","))

_origins = list(
    dict.fromkeys(
        origin
        for origin in (_normalize_origin(origin) for origin in [*_default_origins, *_configured_origins])
        if origin
    )
)
_cors_kwargs["allow_origins"] = _origins

app.add_middleware(CORSMiddleware, **_cors_kwargs)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {}
    message = first_error.get("msg", "Validation error")
    return JSONResponse(status_code=400, content={"detail": message})


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Catch unhandled exceptions so the response still gets CORS headers."""
    logging.getLogger(__name__).error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Add Cache-Control headers to GET responses on cacheable API routes.

    USAT content (categories, subjects, chapters, papers, tips, etc.) changes
    rarely, so a short stale-while-revalidate allows CDN + browser caching
    while still getting fresh data within seconds.
    """

    _CACHEABLE_PREFIXES = (
        f"{settings.api_prefix}/usat/categories",
    )

    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        if (
            request.method == "GET"
            and response.status_code == 200
            and any(request.url.path.startswith(p) for p in self._CACHEABLE_PREFIXES)
        ):
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        return response


app.add_middleware(CacheControlMiddleware)


@app.on_event("startup")
async def on_startup() -> None:
    if settings.jwt_secret_key == "change-me-in-production":
        logging.warning("JWT_SECRET_KEY is using the insecure default — set a strong secret in .env!")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Detect backend so we can use the right SQL dialect
            is_sqlite = engine.url.get_backend_name() == "sqlite"

            if is_sqlite:
                # SQLite: check existing columns and only add missing ones
                for table, column, col_def in [
                    ("contact_info", "whatsapp_url", "TEXT"),
                    ("users", "is_verified", "BOOLEAN DEFAULT FALSE"),
                    ("users", "is_pro", "BOOLEAN DEFAULT FALSE"),
                    ("users", "google_id", "VARCHAR(255)"),
                    ("users", "verification_token", "VARCHAR(512)"),
                    ("users", "reset_password_token_hash", "VARCHAR(128)"),
                    ("users", "reset_password_token_expires_at", "TIMESTAMP"),
                    ("users", "reset_password_requested_at", "TIMESTAMP"),
                ]:
                    cols = await conn.execute(text(f"PRAGMA table_info({table})"))
                    existing = {row[1] for row in cols}
                    if column not in existing:
                        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
                await conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_users_reset_password_token_hash ON users (reset_password_token_hash)")
                )
            else:
                # PostgreSQL: use IF NOT EXISTS / ALTER COLUMN syntax
                await conn.execute(
                    text("ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS whatsapp_url TEXT")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(512)")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token_hash VARCHAR(128)")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token_expires_at TIMESTAMP")
                )
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_requested_at TIMESTAMP")
                )
                await conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_users_reset_password_token_hash ON users (reset_password_token_hash)")
                )
                await conn.execute(
                    text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
                )

            # One-time: mark all pre-existing users as verified
            await conn.execute(
                text("UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE AND verification_token IS NULL")
            )
    except Exception as exc:
        logging.warning("Database schema init skipped during startup: %s", exc)

    try:
        await init_pg_pool()
        pool = get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        logging.info("Application startup - SQLAlchemy and PostgreSQL connections verified")
    except Exception as exc:
        logging.warning("PostgreSQL pool unavailable during startup; continuing without it: %s", exc)

    ensure_bucket_exists()

    # Connect cache service (Redis) for rate limiting — falls back to in-memory if unavailable
    await cache_service.connect()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    try:
        await close_pg_pool()
    except Exception:
        pass
    await cache_service.close()


@app.get("/health")
async def healthcheck() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.get("/health/db")
async def database_healthcheck() -> dict:
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "database": database_url,
                "detail": str(exc),
            },
        )

    return {
        "status": "ok",
        "database": database_url,
    }


@app.get("/")
async def root() -> dict:
    return {
        "service": settings.app_name,
        "status": "ok",
        "docs": "/docs",
    }


@app.get(f"{settings.api_prefix}/public/stats")
async def public_stats() -> dict:
    """Return real-time platform stats (public, no auth).
    MCQ count is deduplicated: identical MCQs spread across USAT categories
    (same subject name + chapter + 4 options) are counted only once."""
    async with SessionLocal() as db:
        user_count = (
            await db.execute(select(func.count()).select_from(User))
        ).scalar()

        # Distinct MCQs by (subject_name, topic_title, all 4 options)
        inner = (
            select(
                Subject.name,
                Topic.title,
                MCQ.option_a,
                MCQ.option_b,
                MCQ.option_c,
                MCQ.option_d,
            )
            .join(Topic, Topic.subject_id == Subject.id)
            .join(MCQ, MCQ.topic_id == Topic.id)
            .distinct()
        ).subquery()

        mcq_count = (
            await db.execute(select(func.count()).select_from(inner))
        ).scalar()

    return {"users": user_count or 0, "mcqs": mcq_count or 0}


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(files.router, prefix=settings.api_prefix)
app.include_router(conversations.router, prefix=settings.api_prefix)
app.include_router(usat.router, prefix=settings.api_prefix)
app.include_router(mock_tests.router, prefix=settings.api_prefix)
app.include_router(admin_content.router, prefix=settings.api_prefix)
app.include_router(ai_learning.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
