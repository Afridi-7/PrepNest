import re
import uuid

from app.core.config import get_settings


class DiagramTool:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_dir = self.settings.upload_dir_path / "visuals"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def generate_mermaid_diagram(self, topic: str) -> dict:
        file_id = str(uuid.uuid4())
        mermaid = (
            "flowchart TD\n"
            f"A[{topic}] --> B[Core Concepts]\n"
            "A --> C[Examples]\n"
            "A --> D[Common Mistakes]\n"
            "B --> E[Practice]\n"
            "C --> E\n"
            "D --> E"
        )
        output_path = self.base_dir / f"{file_id}.mmd"
        output_path.write_text(mermaid, encoding="utf-8")
        return {
            "type": "mermaid",
            "topic": topic,
            "artifact_path": str(output_path),
            "content": mermaid,
        }

    async def build_chart_from_query(self, query: str) -> dict | None:
        numbers = [int(x) for x in re.findall(r"\d+", query)]
        if len(numbers) < 2:
            return None

        file_id = str(uuid.uuid4())
        output_path = self.base_dir / f"{file_id}.png"

        try:
            import matplotlib

            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            labels = [f"v{i+1}" for i in range(len(numbers))]
            plt.figure(figsize=(8, 4))
            plt.bar(labels, numbers)
            plt.title("Generated Study Chart")
            plt.tight_layout()
            plt.savefig(output_path)
            plt.close()

            return {
                "type": "chart",
                "artifact_path": str(output_path),
                "data": numbers,
            }
        except Exception:
            return None


diagram_tool = DiagramTool()
