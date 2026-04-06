from app.rag.vector_store import vector_store


class Retriever:
    async def retrieve(
        self,
        query: str,
        *,
        user_id: str | None = None,
        conversation_id: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        filters = {}
        if user_id:
            filters["user_id"] = user_id
        if conversation_id:
            filters["conversation_id"] = conversation_id

        primary = await vector_store.similarity_search(query, top_k=top_k, filters=filters or None)
        if primary:
            return primary
        return await vector_store.similarity_search(query, top_k=top_k)


retriever = Retriever()
