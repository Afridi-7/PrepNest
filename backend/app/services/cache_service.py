import asyncio
import json
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import redis.asyncio as redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._memory_cache: dict[str, tuple[datetime, str]] = {}
        self._rate_limit_buckets: dict[str, deque[datetime]] = defaultdict(deque)
        self._redis: redis.Redis | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        try:
            self._redis = redis.from_url(self.settings.redis_url, decode_responses=True)
            await self._redis.ping()
            logger.info("Connected to Redis cache")
        except Exception as exc:
            logger.warning("Redis unavailable, using in-memory cache: %s", exc)
            self._redis = None

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()

    async def get_json(self, key: str) -> dict | None:
        if self._redis:
            data = await self._redis.get(key)
            return json.loads(data) if data else None

        async with self._lock:
            item = self._memory_cache.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at <= datetime.now(timezone.utc):
                del self._memory_cache[key]
                return None
            return json.loads(value)

    async def set_json(self, key: str, value: dict, ttl_seconds: int = 300) -> None:
        serialized = json.dumps(value)
        if self._redis:
            await self._redis.set(key, serialized, ex=ttl_seconds)
            return

        async with self._lock:
            self._memory_cache[key] = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds), serialized)

    async def check_rate_limit(self, key: str, limit_per_minute: int) -> bool:
        if self._redis:
            bucket_key = f"rate:{key}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
            value = await self._redis.incr(bucket_key)
            await self._redis.expire(bucket_key, 70)
            return value <= limit_per_minute

        async with self._lock:
            now = datetime.now(timezone.utc)
            bucket = self._rate_limit_buckets[key]
            while bucket and (now - bucket[0]).total_seconds() > 60:
                bucket.popleft()
            if len(bucket) >= limit_per_minute:
                return False
            bucket.append(now)
            return True

    async def check_daily_quota(self, key: str, limit_per_day: int) -> bool:
        """Increment a per-day counter and return False once the cap is hit.

        Used to protect expensive third-party API budgets (OpenAI, etc.) by
        enforcing an upper bound on calls per UTC day per user.
        """
        day_stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        if self._redis:
            bucket_key = f"quota:{key}:{day_stamp}"
            value = await self._redis.incr(bucket_key)
            # 26 hours so we cover any clock skew around midnight rollover.
            await self._redis.expire(bucket_key, 26 * 60 * 60)
            return value <= limit_per_day

        async with self._lock:
            bucket_key = f"{key}:{day_stamp}"
            bucket = self._rate_limit_buckets[bucket_key]
            # Reuse the deque as a counter — we only care about length within
            # the same UTC day, and the key itself rotates daily.
            if len(bucket) >= limit_per_day:
                return False
            bucket.append(datetime.now(timezone.utc))
            return True


cache_service = CacheService()
