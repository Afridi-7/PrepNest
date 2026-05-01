"""Per-call AI usage logging and quota-by-tokens helpers.

Writes a row to the ``ai_usage`` table for every chat completion. Used
both for billing-style daily caps that consider tokens (not just call
count) and for admin analytics.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AiUsage
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


async def record_usage(
    *,
    user_id: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int | None = None,
    conversation_id: str | None = None,
    status: str = "ok",
    db: AsyncSession | None = None,
) -> None:
    """Insert one ``ai_usage`` row. Never raises — failures only log."""
    own_session = db is None
    session = db or SessionLocal()
    try:
        row = AiUsage(
            user_id=user_id,
            conversation_id=conversation_id,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            latency_ms=latency_ms,
            status=status,
        )
        session.add(row)
        if own_session:
            await session.commit()
    except Exception as exc:
        logger.warning("Failed to record AI usage: %s", exc)
        if own_session:
            try:
                await session.rollback()
            except Exception:
                pass
    finally:
        if own_session:
            await session.close()


async def daily_token_total(user_id: str, *, db: AsyncSession) -> int:
    """Total tokens this user has consumed in the current UTC day."""
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    stmt = select(func.coalesce(func.sum(AiUsage.total_tokens), 0)).where(
        AiUsage.user_id == user_id,
        AiUsage.created_at >= start,
    )
    return int((await db.execute(stmt)).scalar_one() or 0)


async def monthly_summary(*, db: AsyncSession) -> list[dict[str, Any]]:
    """Aggregate usage for the trailing 30 days, grouped by model."""
    since = datetime.now(timezone.utc) - timedelta(days=30)
    stmt = (
        select(
            AiUsage.model,
            func.count().label("requests"),
            func.coalesce(func.sum(AiUsage.prompt_tokens), 0).label("prompt"),
            func.coalesce(func.sum(AiUsage.completion_tokens), 0).label("completion"),
            func.coalesce(func.sum(AiUsage.total_tokens), 0).label("total"),
        )
        .where(AiUsage.created_at >= since)
        .group_by(AiUsage.model)
        .order_by(func.sum(AiUsage.total_tokens).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "model": r.model,
            "requests": int(r.requests),
            "prompt_tokens": int(r.prompt),
            "completion_tokens": int(r.completion),
            "total_tokens": int(r.total),
        }
        for r in rows
    ]
