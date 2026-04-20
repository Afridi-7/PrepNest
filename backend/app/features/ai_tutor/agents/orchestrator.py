import asyncio
import logging
from collections.abc import AsyncGenerator

from app.features.ai_tutor.agents.base import AgentContext
from app.features.ai_tutor.agents.live_data_agent import live_data_agent
from app.features.ai_tutor.agents.memory_agent import memory_agent
from app.features.ai_tutor.agents.retriever_agent import retriever_agent
from app.features.ai_tutor.agents.router_agent import router_agent
from app.features.ai_tutor.agents.tutor_agent import tutor_agent
from app.features.ai_tutor.agents.visualization_agent import visualization_agent

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    async def _fetch_database_context(self, ctx: AgentContext) -> str:
        """Search the full database for relevant materials, MCQs, topics, subjects, notes, tips."""
        try:
            from sqlalchemy import or_, select
            from app.db.session import async_session_factory
            from app.db.models import Material, MCQ, Topic, Subject, Note, Tip

            query = ctx.query
            pattern = f"%{query[:100]}%"

            async with async_session_factory() as db:
                # Run all searches concurrently
                mat_stmt = (
                    select(Material)
                    .where(or_(Material.title.ilike(pattern), Material.content.ilike(pattern)))
                    .order_by(Material.created_at.desc())
                    .limit(6)
                )
                mcq_stmt = (
                    select(MCQ)
                    .where(or_(MCQ.question.ilike(pattern), MCQ.explanation.ilike(pattern)))
                    .order_by(MCQ.created_at.desc())
                    .limit(6)
                )
                topic_stmt = select(Topic).where(Topic.title.ilike(pattern)).limit(5)
                subject_stmt = select(Subject).where(Subject.name.ilike(pattern)).limit(5)

                mat_res, mcq_res, topic_res, subject_res = await asyncio.gather(
                    db.execute(mat_stmt),
                    db.execute(mcq_stmt),
                    db.execute(topic_stmt),
                    db.execute(subject_stmt),
                )

                materials = list(mat_res.scalars().all())
                mcqs = list(mcq_res.scalars().all())
                topics = list(topic_res.scalars().all())
                subjects = list(subject_res.scalars().all())

                # Also search by extracted keywords (first 3 significant words)
                words = [w.strip(".,!?:;()\"'") for w in query.split() if len(w) > 3][:3]
                if words and not (materials or mcqs):
                    for word in words:
                        wp = f"%{word}%"
                        extra_mat = await db.execute(
                            select(Material).where(Material.title.ilike(wp)).limit(3)
                        )
                        materials.extend(extra_mat.scalars().all())
                        extra_mcq = await db.execute(
                            select(MCQ).where(MCQ.question.ilike(wp)).limit(3)
                        )
                        mcqs.extend(extra_mcq.scalars().all())

            lines: list[str] = []
            if subjects:
                lines.append("**Available Subjects:**")
                for s in subjects:
                    lines.append(f"- {s.name} (Exam: {s.exam_type})")
            if topics:
                lines.append("**Relevant Topics:**")
                for t in topics:
                    lines.append(f"- {t.title}")
            if materials:
                lines.append("**Study Materials:**")
                seen_ids: set[int] = set()
                for m in materials:
                    if m.id not in seen_ids:
                        seen_ids.add(m.id)
                        lines.append(f"- [{m.type}] {m.title}: {m.content[:500]}")
            if mcqs:
                lines.append("**Practice MCQs:**")
                seen_ids_mcq: set[int] = set()
                for q in mcqs:
                    if q.id not in seen_ids_mcq:
                        seen_ids_mcq.add(q.id)
                        lines.append(
                            f"- Q: {q.question}\n"
                            f"  A:{q.option_a} B:{q.option_b} C:{q.option_c} D:{q.option_d}\n"
                            f"  Correct: {q.correct_answer} | {q.explanation[:300]}"
                        )

            return "\n".join(lines) if lines else ""
        except Exception as exc:
            logger.warning("Database context fetch failed: %s", exc)
            return ""

    async def run(self, ctx: AgentContext) -> dict:
        route = await router_agent.route(ctx)
        used_agents = [router_agent.name]

        # Run independent agents concurrently
        coros: dict[str, asyncio.Task] = {}

        memory_task = asyncio.create_task(memory_agent.summarize_context(ctx))
        coros["memory"] = memory_task

        if route.get("use_retriever", True):
            coros["retriever"] = asyncio.create_task(retriever_agent.run(ctx))
        if route.get("use_live_data", False):
            coros["live"] = asyncio.create_task(live_data_agent.run(ctx))
        if route.get("use_visualization", False):
            coros["visual"] = asyncio.create_task(visualization_agent.run(ctx))
        if route.get("use_database", True):
            coros["database"] = asyncio.create_task(self._fetch_database_context(ctx))

        # Await all
        results: dict[str, object] = {}
        for key, task in coros.items():
            try:
                results[key] = await task
            except Exception as exc:
                logger.warning("Agent %s failed: %s", key, exc)
                results[key] = None

        memory = results.get("memory")
        if memory:
            used_agents.append(memory.name)

        retrieved_text = ""
        references: list[dict] = []
        retrieved = results.get("retriever")
        if retrieved:
            used_agents.append(retrieved.name)
            retrieved_text = retrieved.content
            references.extend(retrieved.references)

        live_text = ""
        live = results.get("live")
        if live:
            used_agents.append(live.name)
            live_text = live.content
            references.extend(live.references)

        visuals: list[dict] = []
        visuals_output = results.get("visual")
        if visuals_output:
            used_agents.append(visuals_output.name)
            visuals.extend(visuals_output.visuals)

        database_context = results.get("database", "")

        context = {
            "memory": memory.content if memory else "",
            "preferences_summary": memory.data.get("preferences_summary", "") if memory else "",
            "retrieved": retrieved_text,
            "live": live_text,
            "database_context": database_context if isinstance(database_context, str) else "",
        }

        tutor = await tutor_agent.generate_answer(ctx, context)
        used_agents.append(tutor.name)

        return {
            "answer": tutor.content,
            "used_agents": used_agents,
            "references": references,
            "visuals": visuals,
            "compiled_context": context,
        }

    async def stream(self, ctx: AgentContext) -> tuple[AsyncGenerator[str, None], dict]:
        route = await router_agent.route(ctx)
        used_agents = [router_agent.name]

        # Run independent agents concurrently
        coros: dict[str, asyncio.Task] = {}

        memory_task = asyncio.create_task(memory_agent.summarize_context(ctx))
        coros["memory"] = memory_task

        if route.get("use_retriever", True):
            coros["retriever"] = asyncio.create_task(retriever_agent.run(ctx))
        if route.get("use_live_data", False):
            coros["live"] = asyncio.create_task(live_data_agent.run(ctx))
        if route.get("use_visualization", False):
            coros["visual"] = asyncio.create_task(visualization_agent.run(ctx))
        if route.get("use_database", True):
            coros["database"] = asyncio.create_task(self._fetch_database_context(ctx))

        results: dict[str, object] = {}
        for key, task in coros.items():
            try:
                results[key] = await task
            except Exception as exc:
                logger.warning("Agent %s failed: %s", key, exc)
                results[key] = None

        memory = results.get("memory")
        if memory:
            used_agents.append(memory.name)

        retrieved_text = ""
        references: list[dict] = []
        retrieved = results.get("retriever")
        if retrieved:
            used_agents.append(retrieved.name)
            retrieved_text = retrieved.content
            references.extend(retrieved.references)

        live_text = ""
        live = results.get("live")
        if live:
            used_agents.append(live.name)
            live_text = live.content
            references.extend(live.references)

        visuals: list[dict] = []
        visuals_output = results.get("visual")
        if visuals_output:
            used_agents.append(visuals_output.name)
            visuals.extend(visuals_output.visuals)

        database_context = results.get("database", "")

        context = {
            "memory": memory.content if memory else "",
            "preferences_summary": memory.data.get("preferences_summary", "") if memory else "",
            "retrieved": retrieved_text,
            "live": live_text,
            "database_context": database_context if isinstance(database_context, str) else "",
        }

        async def token_stream() -> AsyncGenerator[str, None]:
            async for token in tutor_agent.stream_answer(ctx, context):
                yield token

        used_agents.append(tutor_agent.name)

        return token_stream(), {
            "used_agents": used_agents,
            "references": references,
            "visuals": visuals,
            "compiled_context": context,
        }


orchestrator = AgentOrchestrator()
