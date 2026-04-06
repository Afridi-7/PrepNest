import logging
from urllib.parse import quote

import httpx

from app.core.config import get_settings
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


class WebSearchTool:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def search(self, query: str) -> list[dict]:
        cache_key = f"live:wiki:{query.lower().strip()}"
        cached = await cache_service.get_json(cache_key)
        if cached:
            return cached.get("results", [])

        allowed = await cache_service.check_rate_limit("live_data_agent", self.settings.live_data_rate_limit_per_minute)
        if not allowed:
            return []

        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(query)}"
        async with httpx.AsyncClient(timeout=8) as client:
            try:
                response = await client.get(url)
                if response.status_code != 200:
                    return []
                payload = response.json()
                result = [
                    {
                        "title": payload.get("title"),
                        "summary": payload.get("extract", ""),
                        "source": payload.get("content_urls", {}).get("desktop", {}).get("page"),
                    }
                ]
                await cache_service.set_json(cache_key, {"results": result}, ttl_seconds=self.settings.live_data_ttl_seconds)
                return result
            except Exception as exc:
                logger.warning("Live data fetch failed: %s", exc)
                return []


web_search_tool = WebSearchTool()
