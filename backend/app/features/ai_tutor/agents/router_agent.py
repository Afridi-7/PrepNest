from app.features.ai_tutor.agents.base import AgentContext


class RouterAgent:
    name = "router_agent"

    async def route(self, ctx: AgentContext) -> dict:
        query = ctx.query.lower()

        wants_visual = any(k in query for k in ["diagram", "chart", "draw", "visual", "flowchart", "graph"])
        wants_live_data = any(k in query for k in ["latest", "today", "current", "recent", "update", "news"])
        wants_retrieval = True

        return {
            "use_retriever": wants_retrieval,
            "use_live_data": wants_live_data,
            "use_visualization": wants_visual,
        }


router_agent = RouterAgent()
