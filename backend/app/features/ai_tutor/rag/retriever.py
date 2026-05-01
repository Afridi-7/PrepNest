from app.features.ai_tutor.rag.vector_store import vector_store
from app.services.pgvector_store import pgvector_store


class Retriever:
    """Hybrid retriever: pgvector in production, FAISS as a fallback.

    Phase 3 of the scalability plan. Querying pgvector first guarantees
    every replica sees the same corpus; if pgvector is not available
    (e.g. local SQLite dev or extension missing) the in-process FAISS
    store still provides answers from files that were ingested locally.
    """

    async def retrieve(
        self,
        query: str,
        *,
        user_id: str | None = None,
        conversation_id: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        # 1) Distributed store (pgvector). Returns [] if unavailable.
        results = await pgvector_store.similarity_search(
            query,
            top_k=top_k,
            user_id=user_id,
            conversation_id=conversation_id,
        )
        if results:
            return results

        # 2) Local FAISS — keeps dev / single-replica deploys working.
        filters: dict[str, str] = {}
        if user_id:
            filters["user_id"] = user_id
        if conversation_id:
            filters["conversation_id"] = conversation_id

        primary = await vector_store.similarity_search(
            query, top_k=top_k, filters=filters or None
        )
        if primary:
            return primary
        return await vector_store.similarity_search(query, top_k=top_k)


retriever = Retriever()
