"""Celery tasks for email delivery (Phase 2).

Registration, password reset, and any other transactional email is
handed off to a Celery worker so the API never blocks waiting on the
SMTP/Resend network round-trip.

Tasks run with retry-on-failure so a transient Resend outage doesn't
silently lose verification emails. ``acks_late=True`` on the Celery
worker ensures a crashed worker requeues the job.
"""
from __future__ import annotations

import asyncio
import logging

from app.features.ai_tutor.workers.celery_app import celery_app
from app.services.email_service import (
    async_send_password_reset_email,
    async_send_verification_email,
)

logger = logging.getLogger(__name__)


_RETRY_KWARGS: dict = {
    "autoretry_for": (Exception,),
    "retry_backoff": True,
    "retry_backoff_max": 600,
    "retry_jitter": True,
    "max_retries": 5,
    "acks_late": True,
}


@celery_app.task(name="email.send_verification", **_RETRY_KWARGS)
def send_verification_email_task(to_email: str, verification_url: str) -> bool:
    return asyncio.run(async_send_verification_email(to_email, verification_url))


@celery_app.task(name="email.send_password_reset", **_RETRY_KWARGS)
def send_password_reset_email_task(to_email: str, reset_url: str, expiry_minutes: int) -> bool:
    return asyncio.run(async_send_password_reset_email(to_email, reset_url, expiry_minutes))


# ── Convenience helpers callers use instead of importing tasks directly ─

def enqueue_verification_email(to_email: str, verification_url: str) -> None:
    """Best-effort enqueue. Falls back to inline send if the broker is down,
    so a Redis outage doesn't block sign-ups during a deploy.
    """
    try:
        send_verification_email_task.delay(to_email, verification_url)
    except Exception as exc:
        logger.warning("Celery enqueue failed for verification email; sending inline: %s", exc)
        try:
            asyncio.get_event_loop().create_task(
                async_send_verification_email(to_email, verification_url)
            )
        except Exception as inner:
            logger.error("Inline fallback also failed: %s", inner)


def enqueue_password_reset_email(to_email: str, reset_url: str, expiry_minutes: int) -> None:
    try:
        send_password_reset_email_task.delay(to_email, reset_url, expiry_minutes)
    except Exception as exc:
        logger.warning("Celery enqueue failed for password reset email; sending inline: %s", exc)
        try:
            asyncio.get_event_loop().create_task(
                async_send_password_reset_email(to_email, reset_url, expiry_minutes)
            )
        except Exception as inner:
            logger.error("Inline fallback also failed: %s", inner)
