import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import auth, chat, conversations, files, users
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.pg_pool import close_pg_pool, init_pg_pool
from app.db.session import engine
from app.services.cache_service import cache_service

settings = get_settings()
configure_logging(logging.DEBUG if settings.app_debug else logging.INFO)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
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
    await init_pg_pool()
    logging.info("Application startup - DEV MODE (database access skipped, mock auth enabled)")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_pg_pool()
    await cache_service.close()


@app.get("/health")
async def healthcheck() -> dict:
    return {"status": "ok", "service": settings.app_name}


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(files.router, prefix=settings.api_prefix)
app.include_router(conversations.router, prefix=settings.api_prefix)
