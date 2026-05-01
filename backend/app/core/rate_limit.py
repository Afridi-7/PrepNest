"""Reusable FastAPI dependencies for fine-grained per-user rate limiting.

``check_rate_limit(limit, key_prefix)`` returns a FastAPI dependency that:

* Enforces *limit* requests per authenticated user per clock-hour.
* Uses Redis ``INCR`` + ``EXPIRE`` via :func:`cache_service.check_hourly_rate_limit`
  so counters are shared across all replicas and reset automatically after one
  hour without a background job.
* Returns **HTTP 429** with a machine-readable ``Retry-After`` header (seconds
  until the top of the next UTC hour) and a human-readable detail message when
  the limit is exceeded.
* If Redis is unavailable the request is **allowed through** and a warning is
  logged — degraded-mode is preferred over a hard outage.

Usage::

    from app.core.rate_limit import check_rate_limit

    @router.post("/chat")
    async def chat(
        payload: ChatRequest,
        current_user: User = Depends(get_current_user),
        _rl=Depends(check_rate_limit(20, "chat_ai")),
    ):
        ...
"""
from __future__ import annotations

import logging
import math

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models import User
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


def check_rate_limit(limit: int, key_prefix: str):
    """Return a FastAPI dependency that enforces a per-user hourly request cap.

    Args:
        limit: Maximum number of requests allowed per user per clock-hour.
        key_prefix: Logical name for this limit bucket (e.g. ``"chat_ai"``).
            Different prefixes are independent counters, so you can apply
            different limits to different endpoint groups.

    Raises:
        HTTPException(429): When the user has exhausted their hourly quota.
            Includes a ``Retry-After`` header with the remaining seconds until
            the counter resets and a human-readable detail message.
    """

    async def _check(current_user: User = Depends(get_current_user)) -> None:
        allowed, retry_after = await cache_service.check_hourly_rate_limit(
            f"{key_prefix}:{current_user.id}", limit
        )
        if not allowed:
            minutes_left = math.ceil(retry_after / 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"You have reached the limit of {limit} AI messages per hour. "
                    f"Please wait {minutes_left} minute(s) and try again."
                ),
                headers={"Retry-After": str(retry_after)},
            )

    return _check
