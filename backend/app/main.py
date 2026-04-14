import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.routers import admin_content, ai_learning, auth, chat, conversations, dashboard, files, mock_tests, usat, users
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
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
_dev_origins = ["http://localhost:5173", "http://localhost:8080", "http://localhost:8081"]

_cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.cors_origin_regex:
    _cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex
if settings.cors_origins:
    _origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
else:
    _origins = _default_origins
if settings.app_env == "development":
    _origins = list(dict.fromkeys(_origins + _dev_origins))
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
        f"{settings.api_prefix}/usat/",
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
            # Add columns that create_all won't add to existing tables
            await conn.execute(
                text(
                    "ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS whatsapp_url TEXT"
                )
            )
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE")
            )
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE")
            )
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(512)")
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
