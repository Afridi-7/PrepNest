"""AI request concurrency limiter (Phase 5).

Caps how many AI requests a single user — and the system as a whole —
may have in flight at once. Limits are tracked in Redis when available
so they hold across multiple backend replicas; on a single dev machine
the in-memory cache fallback works fine.

Usage::

    async with ai_concurrency.acquire(user_id):
        ...stream the AI response...

If the per-user or global cap would be exceeded the context manager
raises ``HTTPException(429)`` with a helpful ``Retry-After``.
"""
from __future__ import annotations

import contextlib
import logging
import os
import uuid
from typing import AsyncIterator

from fastapi import HTTPException, status

from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


# Defaults are conservative; override via env in production.
PER_USER_MAX = int(os.getenv("AI_PER_USER_MAX_CONCURRENT", "2"))
GLOBAL_MAX = int(os.getenv("AI_GLOBAL_MAX_CONCURRENT", "50"))
LEASE_SECONDS = int(os.getenv("AI_LEASE_SECONDS", "120"))


def _global_key() -> str:
    return "ai:concurrency:global"


def _user_key(user_id: str) -> str:
    return f"ai:concurrency:user:{user_id}"


class _Lease:
    __slots__ = ("user_key", "global_key", "lease_id")

    def __init__(self, user_key: str, global_key: str, lease_id: str) -> None:
        self.user_key = user_key
        self.global_key = global_key
        self.lease_id = lease_id


@contextlib.asynccontextmanager
async def acquire(user_id: str) -> AsyncIterator[None]:
    """Reserve one AI slot for ``user_id``. Raises 429 if at capacity.

    Implementation note: instead of INCR (which is hard to clean up after
    a crashed worker), we use a Redis hash per scope where each in-flight
    request adds a member with a TTL. This lets stale leases self-expire,
    so a worker that crashes mid-request never permanently consumes a slot.
    """
    redis = cache_service._redis  # may be None
    lease_id = uuid.uuid4().hex
    user_key = _user_key(user_id)
    global_key = _global_key()

    if redis is None:
        # In-memory fallback: best-effort using the cache service's bucket.
        # This is fine for single-process local dev; in production we expect
        # Redis so the limit is shared across replicas.
        async with cache_service._lock:
            user_bucket = cache_service._rate_limit_buckets.setdefault(user_key, [])  # type: ignore[arg-type]
            global_bucket = cache_service._rate_limit_buckets.setdefault(global_key, [])  # type: ignore[arg-type]
            if len(user_bucket) >= PER_USER_MAX:
                _raise_user_full()
            if len(global_bucket) >= GLOBAL_MAX:
                _raise_global_full()
            user_bucket.append(lease_id)  # type: ignore[arg-type]
            global_bucket.append(lease_id)  # type: ignore[arg-type]
        try:
            yield
        finally:
            async with cache_service._lock:
                if lease_id in user_bucket:  # type: ignore[operator]
                    user_bucket.remove(lease_id)  # type: ignore[operator]
                if lease_id in global_bucket:  # type: ignore[operator]
                    global_bucket.remove(lease_id)  # type: ignore[operator]
        return

    # Redis path — atomic enough that a few racing acquisitions can briefly
    # exceed the cap by 1; that's acceptable given the rough nature of the
    # limit and the cost of a full Lua script for strict atomicity.
    try:
        await _expire_dead(redis, user_key)
        await _expire_dead(redis, global_key)
        user_count = await redis.hlen(user_key)
        global_count = await redis.hlen(global_key)
        if user_count >= PER_USER_MAX:
            _raise_user_full()
        if global_count >= GLOBAL_MAX:
            _raise_global_full()
        await redis.hset(user_key, lease_id, _now_ts())
        await redis.hset(global_key, lease_id, _now_ts())
        # Mark the whole hash with a TTL so the structure itself self-cleans
        # if every lease drops at once.
        await redis.expire(user_key, LEASE_SECONDS * 2)
        await redis.expire(global_key, LEASE_SECONDS * 2)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - degrades open
        logger.warning("AI concurrency: redis unavailable, allowing request: %s", exc)
        yield
        return

    try:
        yield
    finally:
        try:
            await redis.hdel(user_key, lease_id)
            await redis.hdel(global_key, lease_id)
        except Exception:  # pragma: no cover
            pass


# ── helpers ──────────────────────────────────────────────────────────────


def _now_ts() -> str:
    import time

    return str(int(time.time()))


async def _expire_dead(redis, key: str) -> None:
    """Sweep leases older than LEASE_SECONDS — a defence against orphaned
    entries from crashed workers."""
    try:
        members = await redis.hgetall(key)
        if not members:
            return
        import time

        cutoff = int(time.time()) - LEASE_SECONDS
        stale = [m for m, ts in members.items() if int(ts) < cutoff]
        if stale:
            await redis.hdel(key, *stale)
    except Exception:
        return


def _raise_user_full() -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=(
            "You already have an AI request in progress. "
            "Please wait for it to finish before sending another."
        ),
        headers={"Retry-After": "5"},
    )


def _raise_global_full() -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="The AI tutor is at capacity. Please try again in a few seconds.",
        headers={"Retry-After": "10"},
    )
