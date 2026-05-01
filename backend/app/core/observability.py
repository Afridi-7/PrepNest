"""Sentry / observability hooks.

Initialised from ``main.py``. Safe to import even when Sentry is not
configured — every helper degrades to a no-op.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_INITIALIZED = False


def init_sentry() -> None:
    """Initialise the Sentry SDK if ``SENTRY_DSN`` is present.

    The SDK is wired with FastAPI/Starlette + SQLAlchemy + Redis integrations
    so spans show up automatically. Sample rates default to a low value to
    keep production cost predictable; tune via env.
    """
    global _INITIALIZED
    if _INITIALIZED:
        return

    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    except Exception as exc:  # pragma: no cover
        logger.warning("sentry-sdk not installed; Sentry disabled (%s)", exc)
        return

    env = os.getenv("APP_ENV", "development")
    release = os.getenv("APP_RELEASE") or os.getenv("RENDER_GIT_COMMIT")

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=env,
            release=release,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
            send_default_pii=False,
            integrations=[
                StarletteIntegration(),
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
        )
        _INITIALIZED = True
        logger.info("Sentry initialised for environment=%s", env)
    except Exception as exc:
        logger.warning("Sentry init failed: %s", exc)
