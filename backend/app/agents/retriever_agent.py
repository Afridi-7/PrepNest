from app.agents.base import AgentContext, AgentOutput
from app.rag.retriever import retriever


class RetrieverAgent:
    name = "retriever_agent"

    async def run(self, ctx: AgentContext) -> AgentOutput:
        docs = await retriever.retrieve(
            ctx.query,
            user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            top_k=5,
        )

        text = "\n\n".join(
            [f"[Source {idx+1}] {doc['text']}" for idx, doc in enumerate(docs)]
        )
        references = [
            {
                "id": d.get("id"),
                "score": d.get("score"),
                "metadata": d.get("metadata", {}),
            }
            for d in docs
        ]
        return AgentOutput(name=self.name, content=text, references=references, data={"count": len(docs)})


retriever_agent = RetrieverAgent()
