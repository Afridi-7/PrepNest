import logging
from urllib.parse import urlsplit

import fastapi
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select, text

from app.api.routers import admin_content, ai_learning, auth, chat, conversations, dashboard, files, mock_tests, site, usat, users
from app.api.deps import rate_limit
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

# Startup audit: in production, refuse to silently accept a wildcard CORS
# regex. A misconfigured `.*` would defeat the entire same-origin model.
_is_production_env = settings.app_env.lower() not in ("development", "dev", "local", "test")
if _is_production_env:
    _regex = settings.cors_origin_regex or ""
    if _regex.strip() in (".*", ".+", "^.*$", "^.+$"):
        raise RuntimeError(
            "Refusing to start: cors_origin_regex is a wildcard in production. "
            "Set CORS_ORIGIN_REGEX to an explicit pattern matching your frontend domain(s)."
        )
    if any(o == "*" for o in _origins):
        raise RuntimeError(
            "Refusing to start: CORS allow_origins contains '*' in production."
        )

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


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add safe, non-breaking security response headers on every response.

    These are additive and do NOT change response bodies, status codes, or
    affect any API contract. CSP is intentionally NOT applied globally because
    the SPA may legitimately load fonts/scripts from CDNs; instead the frontend
    should set its own CSP via nginx/vercel headers. We do set a minimal CSP
    only on the static /uploads and PDF responses to prevent any uploaded
    HTML/JS from running in the user's origin if directly opened.
    """

    _is_prod = settings.app_env.lower() not in ("development", "dev", "local", "test")

    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        # Universal hardening — never breaks API consumers.
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
        )
        # Defence-in-depth against legacy Flash/PDF cross-domain abuse and
        # XS-Leaks via window.opener / cross-origin embeddings of API JSON.
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        # CORP is set per-path: API JSON is same-origin only; static /uploads
        # must remain cross-origin so the SPA can load images/PDFs.
        if request.url.path.startswith("/uploads"):
            response.headers.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
        else:
            response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        # HSTS is only meaningful over HTTPS — set in production environments.
        if self._is_prod:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        # Lock down anything served from /uploads (static files) so a malicious
        # uploaded HTML cannot execute scripts in the API origin.
        if request.url.path.startswith("/uploads"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; img-src 'self' data:; "
                "style-src 'unsafe-inline'; sandbox"
            )
            # Allow PDF iframes from same origin to keep PDF viewer working.
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
        else:
            # Defence-in-depth CSP for API JSON responses. Browsers don't
            # render JSON, but if someone opens an API URL directly we want
            # the page to be inert. We skip Swagger/Redoc which legitimately
            # need CDN scripts/styles.
            path = request.url.path
            if not path.startswith(("/docs", "/redoc", "/openapi.json")):
                response.headers.setdefault(
                    "Content-Security-Policy",
                    "default-src 'none'; frame-ancestors 'none'",
                )
        return response


app.add_middleware(SecurityHeadersMiddleware)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized request bodies before they reach handlers.

    This is defence-in-depth against DoS via huge JSON / form payloads. Upload
    routes legitimately need much larger bodies, so we read the configured
    upload cap and add a small framing buffer for those paths.
    """

    # 2 MB is comfortable for any JSON/auth payload we accept.
    _DEFAULT_LIMIT = 2 * 1024 * 1024
    # Routes that legitimately accept large bodies. Kept as a hint; we also
    # detect any `multipart/form-data` request as an upload below so new
    # file-accepting endpoints don't accidentally trip the small default cap.
    _UPLOAD_PREFIXES = (
        f"{settings.api_prefix}/files/upload",
        f"{settings.api_prefix}/admin/materials/upload-pdfs",
        f"{settings.api_prefix}/admin/mcqs/upload-csv",
        f"{settings.api_prefix}/admin/essay-prompts/upload-csv",
        f"{settings.api_prefix}/admin/visuals/upload",
        f"{settings.api_prefix}/users/me/avatar",
        f"{settings.api_prefix}/usat",  # past-paper / chapter PDF uploads
    )

    async def dispatch(self, request: StarletteRequest, call_next):
        # Only inspect requests that can carry a body.
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length is not None:
                try:
                    length = int(content_length)
                except ValueError:
                    return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})

                content_type = (request.headers.get("content-type") or "").lower()
                is_multipart = content_type.startswith("multipart/form-data")
                is_upload = is_multipart or any(
                    request.url.path.startswith(p) for p in self._UPLOAD_PREFIXES
                )
                limit = (
                    (settings.max_upload_size_mb * 1024 * 1024) + 1024 * 1024
                    if is_upload
                    else self._DEFAULT_LIMIT
                )
                if length > limit:
                    return JSONResponse(status_code=413, content={"detail": "Payload too large"})
        return await call_next(request)


app.add_middleware(BodySizeLimitMiddleware)


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """Coarse per-client burst limit applied to every request.

    This is a *backstop* — individual routes still have their own (typically
    stricter) `rate_limit` dependencies. This middleware exists to stop a
    single client from hammering arbitrary routes (e.g. scraping, vuln
    scanning) and to protect us from runaway costs on egress / DB load.

    Client identity:
      - If `settings.trust_proxy_headers` is True (the default — every supported
        deploy target sits behind a reverse proxy), we use the leftmost IP from
        `X-Forwarded-For`, falling back to `X-Real-IP`. This is essential in
        production: without it, the socket peer would be the proxy and *every*
        real user would share one bucket, causing legitimate 429s under load.
      - Otherwise we use the socket peer (`request.client.host`).

    Limit is `settings.global_rate_limit_per_minute` (default 600/min, ~10 rps
    sustained per client) so a normal SPA session — even with a few users
    sharing NAT/Wi-Fi — is never affected.
    """

    # Skip cheap endpoints that the platform itself or uptime checks may poll.
    _EXEMPT_PREFIXES = ("/health", "/uploads")

    @staticmethod
    def _client_id(request: StarletteRequest) -> str:
        if settings.trust_proxy_headers:
            xff = request.headers.get("x-forwarded-for")
            if xff:
                # First entry is the original client; subsequent entries are
                # intermediate proxies appended by each hop.
                first = xff.split(",", 1)[0].strip()
                if first:
                    return first
            real_ip = request.headers.get("x-real-ip")
            if real_ip:
                return real_ip.strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in self._EXEMPT_PREFIXES):
            return await call_next(request)

        client_id = self._client_id(request)
        allowed = await cache_service.check_rate_limit(
            f"global_burst:{client_id}", settings.global_rate_limit_per_minute
        )
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)


app.add_middleware(GlobalRateLimitMiddleware)


@app.on_event("startup")
async def on_startup() -> None:
    if settings.jwt_secret_key == "change-me-in-production":
        env_name = settings.app_env.lower()
        if env_name not in ("development", "dev", "local", "test"):
            # In production / staging, refuse to start with the default secret.
            # This prevents a catastrophic deploy where forging tokens is trivial.
            raise RuntimeError(
                "JWT_SECRET_KEY is set to the insecure default in a non-development "
                "environment. Set a strong secret in your environment before starting."
            )
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
async def public_stats(_rl=fastapi.Depends(rate_limit(60, "public_stats"))) -> dict:
    """Return real-time platform stats (public, no auth).
    MCQ count is deduplicated: identical MCQs spread across USAT categories
    (same subject name + chapter + 4 options) are counted only once.

    Cached 60s and rate-limited to 60/min per IP as defence-in-depth.
    Used by the public marketing landing page only.
    """
    cached = await cache_service.get_json("public:stats")
    if cached:
        return cached
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

    payload = {"users": user_count or 0, "mcqs": mcq_count or 0}
    await cache_service.set_json("public:stats", payload, ttl_seconds=60)
    return payload


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
app.include_router(site.router, prefix=settings.api_prefix)
