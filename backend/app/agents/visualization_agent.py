from app.agents.base import AgentContext, AgentOutput
from app.tools.diagram_tool import diagram_tool
from app.tools.image_tool import image_tool


class VisualizationAgent:
    name = "visualization_agent"

    async def run(self, ctx: AgentContext) -> AgentOutput:
        visuals: list[dict] = []

        chart = await diagram_tool.build_chart_from_query(ctx.query)
        if chart:
            visuals.append(chart)

        diagram = await diagram_tool.generate_mermaid_diagram(ctx.query[:80])
        visuals.append(diagram)

        image = await image_tool.generate_study_image(f"Educational visual for: {ctx.query}")
        if image:
            visuals.append(image)

        content = "Generated supporting visual artifacts for the tutor response."
        return AgentOutput(name=self.name, content=content, visuals=visuals)


visualization_agent = VisualizationAgent()
