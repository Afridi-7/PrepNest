import asyncio
import logging
import os
import time
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)


# Phase 5 — AI timeout / fallback. Both are configurable via env so we can
# tune per deployment without a code change.
_OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "45"))
_OPENAI_FALLBACK_MODEL = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4o-mini")

# Concurrency cap: limits simultaneous in-flight OpenAI requests across all
# users on this instance.  Lazily created on first use so the semaphore is
# always bound to the running event loop (avoids DeprecationWarning on 3.10+
# and RuntimeError on 3.12 if the module is imported before the loop starts).
_llm_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _llm_semaphore
    if _llm_semaphore is None:
        _llm_semaphore = asyncio.Semaphore(get_settings().llm_max_concurrent)
    return _llm_semaphore


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = (
            AsyncOpenAI(api_key=self.settings.openai_api_key, timeout=_OPENAI_TIMEOUT_SECONDS)
            if self.settings.openai_api_key
            else None
        )

    async def complete(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
        *,
        user_id: str | None = None,
        conversation_id: str | None = None,
    ) -> str:
        if not self.client:
            return self._fallback_response(messages)

        chosen = model or self.settings.openai_model
        started = time.perf_counter()
        async with _get_semaphore():
            try:
                response = await self.client.chat.completions.create(
                    model=chosen,
                    messages=messages,
                    temperature=temperature,
                )
            except Exception as exc:
                logger.warning("Primary model %s failed (%s); attempting fallback %s",
                               chosen, exc, _OPENAI_FALLBACK_MODEL)
                if chosen == _OPENAI_FALLBACK_MODEL:
                    await self._record_usage_safe(user_id, conversation_id, chosen, started, status="error")
                    raise
                try:
                    response = await self.client.chat.completions.create(
                        model=_OPENAI_FALLBACK_MODEL,
                        messages=messages,
                        temperature=temperature,
                    )
                    chosen = _OPENAI_FALLBACK_MODEL
                except Exception:
                    await self._record_usage_safe(user_id, conversation_id, chosen, started, status="error")
                    raise

        prompt_tokens = getattr(getattr(response, "usage", None), "prompt_tokens", 0) or 0
        completion_tokens = getattr(getattr(response, "usage", None), "completion_tokens", 0) or 0
        await self._record_usage_safe(
            user_id,
            conversation_id,
            chosen,
            started,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream_complete(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
        *,
        user_id: str | None = None,
        conversation_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        if not self.client:
            text = self._fallback_response(messages)
            for token in text.split(" "):
                yield token + " "
            return

        chosen = model or self.settings.openai_model
        started = time.perf_counter()
        approx_completion = 0
        # Acquire the concurrency slot before opening the stream.  We hold it
        # for the entire streaming duration so the cap applies to active
        # streams, not just the connection phase.
        async with _get_semaphore():
            try:
                stream = await self.client.chat.completions.create(
                    model=chosen,
                    messages=messages,
                    temperature=temperature,
                    stream=True,
                )
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        approx_completion += max(1, len(delta) // 4)
                        yield delta
            except asyncio.CancelledError:
                await self._record_usage_safe(user_id, conversation_id, chosen, started, status="cancelled")
                raise
            except Exception as exc:
                logger.warning("Streaming model %s failed (%s); falling back to %s",
                               chosen, exc, _OPENAI_FALLBACK_MODEL)
                await self._record_usage_safe(user_id, conversation_id, chosen, started, status="error")
                if chosen == _OPENAI_FALLBACK_MODEL:
                    raise
                stream = await self.client.chat.completions.create(
                    model=_OPENAI_FALLBACK_MODEL,
                    messages=messages,
                    temperature=temperature,
                    stream=True,
                )
                chosen = _OPENAI_FALLBACK_MODEL
                started = time.perf_counter()
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        approx_completion += max(1, len(delta) // 4)
                        yield delta

        # Tokens for streamed responses aren't reported until the chunked
        # body finishes; we record an approximate completion-token count
        # based on character length so dashboards stay roughly accurate.
        await self._record_usage_safe(
            user_id,
            conversation_id,
            chosen,
            started,
            prompt_tokens=0,
            completion_tokens=approx_completion,
        )

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if self.client:
            response = await self.client.embeddings.create(model=self.settings.openai_embedding_model, input=texts)
            return [row.embedding for row in response.data]
        return [self._hash_embed(text) for text in texts]

    @staticmethod
    async def _record_usage_safe(
        user_id: str | None,
        conversation_id: str | None,
        model: str,
        started: float,
        *,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        status: str = "ok",
    ) -> None:
        if not user_id:
            return
        try:
            from app.services.ai_usage_service import record_usage

            await record_usage(
                user_id=user_id,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                latency_ms=int((time.perf_counter() - started) * 1000),
                conversation_id=conversation_id,
                status=status,
            )
        except Exception as exc:  # pragma: no cover
            logger.debug("AI usage record failed: %s", exc)

    def _fallback_response(self, messages: list[dict]) -> str:
        user_messages = [m["content"] for m in messages if m.get("role") == "user"]
        prompt = user_messages[-1] if user_messages else ""
        return (
            "AI provider key is not configured. "
            "Set OPENAI_API_KEY to enable full model responses.\n\n"
            "I still captured your request and prepared a structured answer shell for: "
            f"{prompt[:120]}"
        )

    def _hash_embed(self, text: str, dim: int = 384) -> list[float]:
        vec = [0.0] * dim
        if not text:
            return vec
        for token in text.lower().split():
            idx = hash(token) % dim
            vec[idx] += 1.0
        norm = sum(v * v for v in vec) ** 0.5
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec


llm_service = LLMService()
