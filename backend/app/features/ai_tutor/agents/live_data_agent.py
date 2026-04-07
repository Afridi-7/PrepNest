from app.features.ai_tutor.agents.base import AgentContext, AgentOutput
from app.features.ai_tutor.tools.web_search import web_search_tool


class LiveDataAgent:
    name = "live_data_agent"

    async def run(self, ctx: AgentContext) -> AgentOutput:
        results = await web_search_tool.search(ctx.query)
        snippets = []
        references = []
        for row in results:
            title = row.get("title", "Untitled")
            summary = row.get("summary", "")
            source = row.get("source")
            snippets.append(f"{title}: {summary}")
            if source:
                references.append({"title": title, "url": source})

        return AgentOutput(
            name=self.name,
            content="\n\n".join(snippets),
            references=references,
            data={"count": len(results)},
        )


live_data_agent = LiveDataAgent()
