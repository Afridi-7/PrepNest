"""AI concurrency limiter tests (in-memory fallback path)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services import ai_concurrency
from app.services.cache_service import cache_service


@pytest.fixture(autouse=True)
def _force_in_memory(monkeypatch):
    """Force the in-memory fallback so tests don't depend on Redis."""
    monkeypatch.setattr(cache_service, "_redis", None, raising=False)
    cache_service._rate_limit_buckets.clear()
    yield
    cache_service._rate_limit_buckets.clear()


@pytest.mark.asyncio
async def test_in_memory_acquire_releases() -> None:
    async with ai_concurrency.acquire("user-1"):
        pass
    # After release we should be able to acquire again immediately.
    async with ai_concurrency.acquire("user-1"):
        pass


@pytest.mark.asyncio
async def test_per_user_cap_raises_429(monkeypatch) -> None:
    monkeypatch.setattr(ai_concurrency, "PER_USER_MAX", 1, raising=False)

    cm1 = ai_concurrency.acquire("user-2")
    await cm1.__aenter__()
    try:
        with pytest.raises(HTTPException) as excinfo:
            async with ai_concurrency.acquire("user-2"):
                pass
        assert excinfo.value.status_code == 429
    finally:
        await cm1.__aexit__(None, None, None)
