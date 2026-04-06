from collections.abc import AsyncGenerator

from app.agents.base import AgentContext, AgentOutput
from app.services.llm_service import llm_service


class TutorAgent:
    name = "tutor_agent"

    async def generate_answer(self, ctx: AgentContext, compiled_context: dict) -> AgentOutput:
        messages = self._build_messages(ctx, compiled_context)
        answer = await llm_service.complete(messages)
        return AgentOutput(name=self.name, content=answer)

    async def stream_answer(self, ctx: AgentContext, compiled_context: dict) -> AsyncGenerator[str, None]:
        messages = self._build_messages(ctx, compiled_context)
        async for token in llm_service.stream_complete(messages):
            yield token

    def _build_messages(self, ctx: AgentContext, compiled_context: dict) -> list[dict]:
        system_prompt = (
            "You are PrepNest Tutor, an expert AI teacher.\n"
            "Rules:\n"
            "1) Explain step-by-step with conceptual clarity.\n"
            "2) Adapt depth to user level: beginner/intermediate/advanced.\n"
            "3) Include a concise summary and practice questions.\n"
            "4) If retrieval context exists, ground the answer in it.\n"
            "5) If live-data context exists, cite it clearly as current information.\n"
            "6) Use markdown headings and bullet lists for readability."
        )

        user_content = (
            f"Learning level: {ctx.learning_level}\n"
            f"User preferences: {compiled_context.get('preferences_summary', 'N/A')}\n\n"
            f"Recent memory:\n{compiled_context.get('memory', '')}\n\n"
            f"Retrieved context:\n{compiled_context.get('retrieved', '')}\n\n"
            f"Live context:\n{compiled_context.get('live', '')}\n\n"
            f"User query:\n{ctx.query}"
        )

        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]


tutor_agent = TutorAgent()
