from app.agents.base import AgentContext, AgentOutput


class MemoryAgent:
    name = "memory_agent"

    async def summarize_context(self, ctx: AgentContext) -> AgentOutput:
        memory_lines = []
        for message in ctx.recent_messages[-10:]:
            role = message.get("role", "user")
            content = message.get("content", "")
            memory_lines.append(f"{role}: {content[:300]}")

        prefs = ctx.user_preferences or {}
        pref_line = (
            f"Preferred style={prefs.get('style', 'balanced')}, "
            f"pace={prefs.get('pace', 'normal')}, level={ctx.learning_level}."
        )

        return AgentOutput(
            name=self.name,
            content="\n".join(memory_lines),
            data={"preferences_summary": pref_line},
        )


memory_agent = MemoryAgent()
