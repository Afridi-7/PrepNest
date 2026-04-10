from __future__ import annotations

import json
import httpx
from collections.abc import AsyncGenerator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import MCQ, Material, Topic
from app.schemas.content import AIResponse
from app.services.llm_service import llm_service


class AILearningService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def _search_materials(self, query: str, limit: int = 8) -> list[Material]:
        pattern = f"%{query}%"
        stmt = (
            select(Material)
            .where(or_(Material.title.ilike(pattern), Material.content.ilike(pattern)))
            .order_by(Material.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _search_mcqs(self, query: str, limit: int = 8) -> list[MCQ]:
        pattern = f"%{query}%"
        stmt = (
            select(MCQ)
            .where(or_(MCQ.question.ilike(pattern), MCQ.explanation.ilike(pattern)))
            .order_by(MCQ.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _load_topic_context(self, query: str, limit: int = 5) -> list[Topic]:
        pattern = f"%{query}%"
        stmt = select(Topic).where(Topic.title.ilike(pattern)).order_by(Topic.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _web_search(self, query: str, limit: int = 5) -> list[dict]:
        if not self.settings.web_search_api_url:
            return []

        headers = {}
        if self.settings.web_search_api_key:
            headers["Authorization"] = f"Bearer {self.settings.web_search_api_key}"

        params = {"q": query, "limit": limit}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(self.settings.web_search_api_url, params=params, headers=headers)

        if response.status_code >= 300:
            return []

        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get("results"), list):
            return payload["results"][:limit]
        if isinstance(payload, list):
            return payload[:limit]
        return []

    def _build_context_text(self, materials: list[Material], mcqs: list[MCQ], topics: list[Topic], web_results: list[dict]) -> str:
        lines: list[str] = []

        if topics:
            lines.append("Relevant topics:")
            for topic in topics:
                lines.append(f"- {topic.title} (topic_id={topic.id})")

        if materials:
            lines.append("Study materials:")
            for material in materials:
                lines.append(f"- [{material.type}] {material.title}: {material.content[:500]}")

        if mcqs:
            lines.append("Practice MCQs:")
            for mcq in mcqs:
                lines.append(
                    "- Question: "
                    f"{mcq.question} | A:{mcq.option_a} B:{mcq.option_b} C:{mcq.option_c} D:{mcq.option_d} "
                    f"| Correct:{mcq.correct_answer} | Explanation:{mcq.explanation[:400]}"
                )

        if web_results:
            lines.append("Live web references:")
            for item in web_results:
                title = item.get("title") or item.get("name") or "Untitled"
                url = item.get("url") or item.get("link") or ""
                snippet = item.get("snippet") or item.get("description") or ""
                lines.append(f"- {title} ({url}) {snippet[:300]}")

        return "\n".join(lines)

    _SYSTEM_PROMPT = (
        "# PrepNest AI Tutor – Expert Learning Companion\n\n"
        "You are an exceptional AI tutor specialising in **USAT & HAT exam preparation**.\n\n"
        "## Core Principles\n"
        "1. **Context First** – ground every answer in the provided study materials, MCQs, topics and web results before adding your own knowledge.\n"
        "2. **Clarity & Structure** – use headings (##, ###), bullet points and numbered lists for easy scanning.\n"
        "3. **Progressive Depth** – start with a concise answer, then build toward deeper understanding.\n"
        "4. **Engaging Teaching** – use memorable analogies, real-world examples and relatable scenarios.\n"
        "5. **Accuracy** – never fabricate facts. If uncertain, say so.\n\n"
        "## Mode-Specific Instructions\n"
        "- **chat**: Answer the question clearly and conversationally. End with a follow-up thought or practice prompt.\n"
        "- **explain**: Give a thorough, concept-focused explanation. Define key terms, show cause-and-effect, and use examples. Finish with 2-3 quick review questions.\n"
        "- **mcq**: Identify the correct option, explain *why* it is correct **and** why each distractor is wrong. Reference the underlying concept.\n"
        "- **math**: Show complete step-by-step working with every formula and substitution labelled. Highlight common mistakes students make.\n"
        "- **essay**: Provide structured, constructive feedback – strengths first, then specific improvements with rewrite suggestions.\n\n"
        "## Formatting Rules\n"
        "- Use **bold** for key terms on first mention.\n"
        "- Use `inline code` for formulas, variables, and short expressions.\n"
        "- Use fenced code blocks (```lang) for multi-line derivations or code.\n"
        "- Keep paragraphs short (2-4 sentences).\n"
        "- End every response with actionable next steps or a quick practice question.\n\n"
        "## Tone\n"
        "Professional yet warm and encouraging. Be enthusiastic about the subject. Motivate the student to keep going."
    )

    async def _generate_answer(self, user_prompt: str, context_text: str, mode: str) -> str:
        messages = [
            {"role": "system", "content": self._SYSTEM_PROMPT},
            {"role": "user", "content": f"Mode: {mode}\n\nContext:\n{context_text}\n\nQuestion:\n{user_prompt}"},
        ]
        return await llm_service.complete(messages)

    async def run(self, prompt: str, mode: str, include_web: bool) -> AIResponse:
        materials = await self._search_materials(prompt)
        mcqs = await self._search_mcqs(prompt)
        topics = await self._load_topic_context(prompt)
        web_results = await self._web_search(prompt) if include_web else []

        context_text = self._build_context_text(materials, mcqs, topics, web_results)
        answer = await self._generate_answer(prompt, context_text, mode)

        return AIResponse(
            answer=answer,
            context_materials=[
                {"id": m.id, "title": m.title, "type": m.type, "topic_id": m.topic_id} for m in materials
            ],
            context_mcqs=[
                {
                    "id": q.id,
                    "question": q.question,
                    "correct_answer": q.correct_answer,
                    "topic_id": q.topic_id,
                }
                for q in mcqs
            ],
            web_results=web_results,
        )

    async def stream_run(self, prompt: str, mode: str, include_web: bool) -> AsyncGenerator[str, None]:
        """SSE streaming variant – yields `data: {...}\n\n` lines."""
        materials = await self._search_materials(prompt)
        mcqs = await self._search_mcqs(prompt)
        topics = await self._load_topic_context(prompt)
        web_results = await self._web_search(prompt) if include_web else []

        context_text = self._build_context_text(materials, mcqs, topics, web_results)

        messages = [
            {"role": "system", "content": self._SYSTEM_PROMPT},
            {"role": "user", "content": f"Mode: {mode}\n\nContext:\n{context_text}\n\nQuestion:\n{prompt}"},
        ]

        async for token in llm_service.stream_complete(messages):
            yield f"data: {json.dumps({'type': 'token', 'value': token})}\n\n"

        done_payload = {
            "type": "done",
            "context_materials": [
                {"id": m.id, "title": m.title, "type": m.type, "topic_id": m.topic_id} for m in materials
            ],
            "context_mcqs": [
                {"id": q.id, "question": q.question, "correct_answer": q.correct_answer, "topic_id": q.topic_id}
                for q in mcqs
            ],
            "web_results": web_results,
        }
        yield f"data: {json.dumps(done_payload)}\n\n"
