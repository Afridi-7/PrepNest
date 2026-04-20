import json
import logging

from app.features.ai_tutor.agents.base import AgentContext
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

_ROUTER_SYSTEM = (
    "You are a query-routing classifier for an AI tutoring system.\n"
    "Given the user query, conversation history and metadata, output a JSON object with these boolean keys:\n"
    "  use_retriever – true if the query would benefit from searching study materials, MCQs, notes, or uploaded documents.\n"
    "  use_live_data – true if the query needs up-to-date or real-world information (current events, latest stats, recent news).\n"
    "  use_visualization – true if the query explicitly asks for a diagram, chart, graph, flowchart or visual aid.\n"
    "  use_database – true if answering requires searching the full database of subjects, topics, materials, MCQs, tips, or notes.\n"
    "  detected_mode – one of: chat, explain, solve-mcq, solve-math, solve-essay (infer from query intent).\n"
    "  confidence – float 0-1 indicating routing confidence.\n"
    "Respond with ONLY valid JSON, no markdown fences."
)


class RouterAgent:
    name = "router_agent"

    async def route(self, ctx: AgentContext) -> dict:
        # Fast keyword pre-check for fallback
        query_lower = ctx.query.lower()
        keyword_visual = any(k in query_lower for k in ["diagram", "chart", "draw", "visual", "flowchart", "graph"])
        keyword_live = any(k in query_lower for k in ["latest", "today", "current", "recent", "update", "news", "2024", "2025", "2026"])
        keyword_db = any(k in query_lower for k in ["subject", "topic", "material", "mcq", "past paper", "note", "tip", "syllabus", "curriculum"])

        # Try LLM-based routing for better accuracy
        try:
            history_summary = ""
            if ctx.recent_messages:
                last_msgs = ctx.recent_messages[-4:]
                history_summary = " | ".join(f"{m.get('role','?')}: {m.get('content','')[:80]}" for m in last_msgs)

            messages = [
                {"role": "system", "content": _ROUTER_SYSTEM},
                {"role": "user", "content": (
                    f"Query: {ctx.query}\n"
                    f"Learning level: {ctx.learning_level}\n"
                    f"Has attachments: {bool(ctx.attachments)}\n"
                    f"Recent history: {history_summary or 'none'}"
                )},
            ]
            raw = await llm_service.complete(messages, temperature=0.0)
            # Strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            return {
                "use_retriever": parsed.get("use_retriever", True),
                "use_live_data": parsed.get("use_live_data", keyword_live),
                "use_visualization": parsed.get("use_visualization", keyword_visual),
                "use_database": parsed.get("use_database", keyword_db),
                "detected_mode": parsed.get("detected_mode", "chat"),
                "confidence": parsed.get("confidence", 0.8),
            }
        except Exception as exc:
            logger.debug("LLM routing fallback: %s", exc)
            return {
                "use_retriever": True,
                "use_live_data": keyword_live,
                "use_visualization": keyword_visual,
                "use_database": True,
                "detected_mode": "chat",
                "confidence": 0.5,
            }


router_agent = RouterAgent()
