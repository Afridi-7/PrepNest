import logging
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import admin_content, ai_learning, auth, chat, content, conversations, files, users
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.pg_pool import close_pg_pool, get_pg_pool, init_pg_pool
from app.db.session import engine
from app.services.cache_service import cache_service
from app.services.email_service import email_service

settings = get_settings()
configure_logging(logging.DEBUG if settings.app_debug else logging.INFO)


def _build_allowed_origins() -> list[str]:
    default_local_origins = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ]

    configured_origins: list[str] = [settings.frontend_url]
    if settings.cors_origins:
        configured_origins.extend(origin.strip() for origin in settings.cors_origins.split(",") if origin.strip())

    def _normalize_origin(value: str) -> str:
        candidate = value.strip().rstrip("/")
        if not candidate:
            return ""

        parsed = urlparse(candidate)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".lower()

        return candidate.lower()

    deduped_origins: list[str] = []
    for origin in [*default_local_origins, *configured_origins]:
        normalized_origin = _normalize_origin(origin)
        if normalized_origin and normalized_origin not in deduped_origins:
            deduped_origins.append(normalized_origin)

    return deduped_origins


allowed_origins = _build_allowed_origins()

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials="*" not in allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {}
    message = first_error.get("msg", "Validation error")
    return JSONResponse(status_code=400, content={"detail": message})


@app.on_event("startup")
async def on_startup() -> None:
    try:
        resolved_provider = email_service._resolve_provider()
    except Exception as exc:
        resolved_provider = f"invalid ({exc})"
    logging.info(
        "Email transport provider: %s (resend_key_set=%s)",
        resolved_provider,
        bool(settings.resend_api_key),
    )

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
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


@app.get("/health/email")
async def email_healthcheck() -> dict:
    try:
        provider = email_service._resolve_provider()
        provider_error = None
    except Exception as exc:
        provider = "invalid"
        provider_error = str(exc)

    return {
        "provider": provider,
        "provider_error": provider_error,
        "resend_key_set": bool(settings.resend_api_key),
        "resend_from_email": settings.resend_from_email,
        "smtp_host": settings.smtp_host,
        "smtp_use_tls": settings.smtp_use_tls,
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
app.include_router(content.router, prefix=settings.api_prefix)
app.include_router(admin_content.router, prefix=settings.api_prefix)
app.include_router(ai_learning.router, prefix=settings.api_prefix)
