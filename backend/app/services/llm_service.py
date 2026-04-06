import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key) if self.settings.openai_api_key else None

    async def complete(self, messages: list[dict], model: str | None = None, temperature: float = 0.2) -> str:
        if not self.client:
            return self._fallback_response(messages)

        response = await self.client.chat.completions.create(
            model=model or self.settings.openai_model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def stream_complete(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        if not self.client:
            text = self._fallback_response(messages)
            for token in text.split(" "):
                yield token + " "
            return

        stream = await self.client.chat.completions.create(
            model=model or self.settings.openai_model,
            messages=messages,
            temperature=temperature,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if self.client:
            response = await self.client.embeddings.create(model=self.settings.openai_embedding_model, input=texts)
            return [row.embedding for row in response.data]
        return [self._hash_embed(text) for text in texts]

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
