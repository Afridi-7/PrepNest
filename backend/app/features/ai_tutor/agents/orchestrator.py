from collections.abc import AsyncGenerator

from app.features.ai_tutor.agents.base import AgentContext
from app.features.ai_tutor.agents.live_data_agent import live_data_agent
from app.features.ai_tutor.agents.memory_agent import memory_agent
from app.features.ai_tutor.agents.retriever_agent import retriever_agent
from app.features.ai_tutor.agents.router_agent import router_agent
from app.features.ai_tutor.agents.tutor_agent import tutor_agent
from app.features.ai_tutor.agents.visualization_agent import visualization_agent


class AgentOrchestrator:
    async def run(self, ctx: AgentContext) -> dict:
        route = await router_agent.route(ctx)
        used_agents = [router_agent.name]

        memory = await memory_agent.summarize_context(ctx)
        used_agents.append(memory.name)

        retrieved_text = ""
        references: list[dict] = []
        if route["use_retriever"]:
            retrieved = await retriever_agent.run(ctx)
            used_agents.append(retrieved.name)
            retrieved_text = retrieved.content
            references.extend(retrieved.references)

        live_text = ""
        if route["use_live_data"]:
            live = await live_data_agent.run(ctx)
            used_agents.append(live.name)
            live_text = live.content
            references.extend(live.references)

        visuals: list[dict] = []
        if route["use_visualization"]:
            visuals_output = await visualization_agent.run(ctx)
            used_agents.append(visuals_output.name)
            visuals.extend(visuals_output.visuals)

        context = {
            "memory": memory.content,
            "preferences_summary": memory.data.get("preferences_summary", ""),
            "retrieved": retrieved_text,
            "live": live_text,
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

        memory = await memory_agent.summarize_context(ctx)
        used_agents.append(memory.name)

        retrieved_text = ""
        references: list[dict] = []
        if route["use_retriever"]:
            retrieved = await retriever_agent.run(ctx)
            used_agents.append(retrieved.name)
            retrieved_text = retrieved.content
            references.extend(retrieved.references)

        live_text = ""
        if route["use_live_data"]:
            live = await live_data_agent.run(ctx)
            used_agents.append(live.name)
            live_text = live.content
            references.extend(live.references)

        visuals: list[dict] = []
        if route["use_visualization"]:
            visuals_output = await visualization_agent.run(ctx)
            used_agents.append(visuals_output.name)
            visuals.extend(visuals_output.visuals)

        context = {
            "memory": memory.content,
            "preferences_summary": memory.data.get("preferences_summary", ""),
            "retrieved": retrieved_text,
            "live": live_text,
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
