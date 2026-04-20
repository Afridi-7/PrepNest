from __future__ import annotations

import asyncio
import json
import httpx
from collections.abc import AsyncGenerator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import MCQ, Material, Topic, Subject, Note, Tip
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

    async def _search_subjects(self, query: str, limit: int = 5) -> list[Subject]:
        pattern = f"%{query}%"
        stmt = select(Subject).where(Subject.name.ilike(pattern)).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _search_notes(self, query: str, limit: int = 5) -> list[Note]:
        pattern = f"%{query}%"
        stmt = (
            select(Note)
            .where(or_(Note.title.ilike(pattern), Note.content.ilike(pattern)))
            .order_by(Note.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _search_tips(self, query: str, limit: int = 5) -> list[Tip]:
        pattern = f"%{query}%"
        stmt = (
            select(Tip)
            .where(or_(Tip.title.ilike(pattern), Tip.content.ilike(pattern)))
            .order_by(Tip.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _web_search(self, query: str, limit: int = 5) -> list[dict]:
        """Fetch live data from Wikipedia as a lightweight web search."""
        from urllib.parse import quote
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(query)}"
        async with httpx.AsyncClient(timeout=8) as client:
            try:
                response = await client.get(url)
                if response.status_code != 200:
                    return []
                payload = response.json()
                return [{
                    "title": payload.get("title", ""),
                    "snippet": payload.get("extract", ""),
                    "url": payload.get("content_urls", {}).get("desktop", {}).get("page", ""),
                }]
            except Exception:
                return []

    def _build_context_text(
        self,
        materials: list[Material],
        mcqs: list[MCQ],
        topics: list[Topic],
        subjects: list[Subject],
        notes: list[Note],
        tips: list[Tip],
        web_results: list[dict],
    ) -> str:
        lines: list[str] = []

        if subjects:
            lines.append("**Available Subjects:**")
            for s in subjects:
                lines.append(f"- {s.name} (Exam: {s.exam_type})")

        if topics:
            lines.append("**Relevant Topics:**")
            for topic in topics:
                lines.append(f"- {topic.title} (topic_id={topic.id})")

        if materials:
            lines.append("**Study Materials:**")
            for material in materials:
                lines.append(f"- [{material.type}] {material.title}: {material.content[:500]}")

        if mcqs:
            lines.append("**Practice MCQs:**")
            for mcq in mcqs:
                lines.append(
                    f"- Q: {mcq.question}\n"
                    f"  A:{mcq.option_a} B:{mcq.option_b} C:{mcq.option_c} D:{mcq.option_d}\n"
                    f"  Correct: {mcq.correct_answer} | {mcq.explanation[:400]}"
                )

        if notes:
            lines.append("**Study Notes:**")
            for note in notes:
                lines.append(f"- {note.title}: {note.content[:400]}")

        if tips:
            lines.append("**Exam Tips:**")
            for tip in tips:
                lines.append(f"- {tip.title}: {tip.content[:300]}")

        if web_results:
            lines.append("**Live Web References:**")
            for item in web_results:
                title = item.get("title") or item.get("name") or "Untitled"
                url = item.get("url") or item.get("link") or ""
                snippet = item.get("snippet") or item.get("description") or ""
                lines.append(f"- {title} ({url}) {snippet[:300]}")

        return "\n".join(lines)

    _SYSTEM_PROMPT = (
        "# PrepNest AI Tutor — Your Personal Learning Companion\n\n"
        "You are **PrepNest AI Tutor**, an expert personal tutor for **USAT & HAT exam preparation**.\n\n"
        "## Core Principles\n"
        "1. **Context First** — ground every answer in the provided study materials, MCQs, notes, tips and web results.\n"
        "2. **Clarity & Structure** — use headings (##, ###), bullet points and numbered lists.\n"
        "3. **Progressive Depth** — start with a concise answer, then build deeper understanding.\n"
        "4. **Engaging Teaching** — use memorable analogies, real-world examples and relatable scenarios.\n"
        "5. **Accuracy** — never fabricate facts. If uncertain, say so.\n"
        "6. **Personalization** — adapt tone and complexity to the student's level.\n\n"
        "## Mode-Specific Instructions\n"
        "- **chat**: Answer clearly, conversationally. End with a follow-up thought.\n"
        "- **explain**: Thorough concept-focused explanation. Define terms, show cause-and-effect, examples. End with review questions.\n"
        "- **mcq**: Identify correct option, explain WHY correct AND why each distractor is wrong.\n"
        "- **math**: Complete step-by-step working with every formula labeled. Highlight common mistakes.\n"
        "- **essay**: Structured feedback — strengths first, then improvements with rewrite examples. Score /10.\n\n"
        "## Formatting\n"
        "- **Bold** key terms. Use `code` for formulas. Fenced blocks for derivations.\n"
        "- Short paragraphs (2-4 sentences). End with actionable next steps.\n\n"
        "## Tone\n"
        "Professional yet warm, encouraging, and enthusiastic. Motivate the student."
    )

    async def _generate_answer(self, user_prompt: str, context_text: str, mode: str) -> str:
        messages = [
            {"role": "system", "content": self._SYSTEM_PROMPT},
            {"role": "user", "content": f"Mode: {mode}\n\nContext:\n{context_text}\n\nQuestion:\n{user_prompt}"},
        ]
        return await llm_service.complete(messages, temperature=0.3)

    async def run(self, prompt: str, mode: str, include_web: bool) -> AIResponse:
        coros = [
            self._search_materials(prompt),
            self._search_mcqs(prompt),
            self._load_topic_context(prompt),
            self._search_subjects(prompt),
            self._search_notes(prompt),
            self._search_tips(prompt),
        ]
        if include_web:
            coros.append(self._web_search(prompt))

        results = await asyncio.gather(*coros)
        materials, mcqs, topics = results[0], results[1], results[2]
        subjects, notes, tips = results[3], results[4], results[5]
        web_results = results[6] if include_web else []

        context_text = self._build_context_text(materials, mcqs, topics, subjects, notes, tips, web_results)
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
        coros = [
            self._search_materials(prompt),
            self._search_mcqs(prompt),
            self._load_topic_context(prompt),
            self._search_subjects(prompt),
            self._search_notes(prompt),
            self._search_tips(prompt),
        ]
        if include_web:
            coros.append(self._web_search(prompt))

        results = await asyncio.gather(*coros)
        materials, mcqs, topics = results[0], results[1], results[2]
        subjects, notes, tips = results[3], results[4], results[5]
        web_results = results[6] if include_web else []

        context_text = self._build_context_text(materials, mcqs, topics, subjects, notes, tips, web_results)

        messages = [
            {"role": "system", "content": self._SYSTEM_PROMPT},
            {"role": "user", "content": f"Mode: {mode}\n\nContext:\n{context_text}\n\nQuestion:\n{prompt}"},
        ]

        async for token in llm_service.stream_complete(messages, temperature=0.3):
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
