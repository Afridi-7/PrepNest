"""Admin analytics endpoints (Phase 5).

Surface AI usage, request volume, and other operational metrics that
admins need to monitor cost / capacity.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.session import get_db_session
from app.models import User
from app.services.ai_usage_service import monthly_summary

router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])


@router.get("/ai-usage")
async def ai_usage_monthly(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return per-model token & call totals for the trailing 30 days."""
    rows = await monthly_summary(db=db)
    total_tokens = sum(r["total_tokens"] for r in rows)
    total_requests = sum(r["requests"] for r in rows)
    return {
        "window_days": 30,
        "total_requests": total_requests,
        "total_tokens": total_tokens,
        "by_model": rows,
    }
