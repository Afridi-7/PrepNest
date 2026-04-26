"""Unit tests for the in-memory paths of CacheService.

These don't require Redis — by not calling `connect()`, the service stays in
in-memory mode, so we can exercise rate-limit and daily-quota logic in
isolation, fast and independent.
"""
from __future__ import annotations

import asyncio

from app.services.cache_service import CacheService


def _run(coro):
    return asyncio.run(coro)


def test_check_rate_limit_allows_under_the_cap() -> None:
    cache = CacheService()

    async def go() -> None:
        for _ in range(5):
            assert await cache.check_rate_limit("user:1", limit_per_minute=5) is True

    _run(go())


def test_check_rate_limit_blocks_over_the_cap() -> None:
    cache = CacheService()

    async def go() -> None:
        for _ in range(3):
            assert await cache.check_rate_limit("user:1", limit_per_minute=3) is True
        assert await cache.check_rate_limit("user:1", limit_per_minute=3) is False

    _run(go())


def test_check_rate_limit_isolates_keys() -> None:
    """Hitting the cap on user A must not affect user B."""
    cache = CacheService()

    async def go() -> None:
        for _ in range(2):
            assert await cache.check_rate_limit("user:A", limit_per_minute=2) is True
        assert await cache.check_rate_limit("user:A", limit_per_minute=2) is False
        assert await cache.check_rate_limit("user:B", limit_per_minute=2) is True

    _run(go())


def test_check_daily_quota_allows_under_the_cap() -> None:
    cache = CacheService()

    async def go() -> None:
        for _ in range(3):
            assert await cache.check_daily_quota("ai:user:1", limit_per_day=3) is True

    _run(go())


def test_check_daily_quota_blocks_over_the_cap() -> None:
    cache = CacheService()

    async def go() -> None:
        for _ in range(2):
            assert await cache.check_daily_quota("ai:user:1", limit_per_day=2) is True
        assert await cache.check_daily_quota("ai:user:1", limit_per_day=2) is False

    _run(go())


def test_check_daily_quota_isolates_keys() -> None:
    cache = CacheService()

    async def go() -> None:
        assert await cache.check_daily_quota("ai:user:A", limit_per_day=1) is True
        assert await cache.check_daily_quota("ai:user:A", limit_per_day=1) is False
        assert await cache.check_daily_quota("ai:user:B", limit_per_day=1) is True

    _run(go())


def test_get_set_json_round_trip_in_memory() -> None:
    cache = CacheService()

    async def go() -> None:
        await cache.set_json("k", {"hello": "world"}, ttl_seconds=60)
        assert await cache.get_json("k") == {"hello": "world"}

    _run(go())


def test_get_json_returns_none_for_missing_key() -> None:
    cache = CacheService()

    async def go() -> None:
        assert await cache.get_json("does-not-exist") is None

    _run(go())

