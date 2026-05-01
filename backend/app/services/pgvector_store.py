"""pgvector-backed vector store for distributed deployments.

Phase 3 of the scalability plan. Replaces the per-replica FAISS index with
a single Postgres-resident store that every backend replica can read from
and write to safely.

Falls back to the in-process FAISS store
(``app.features.ai_tutor.rag.vector_store``) when:

* the database is not Postgres (e.g. local SQLite dev), or
* the ``vector`` extension is not present, or
* the env flag ``USE_PGVECTOR`` is explicitly disabled.

The fallback path keeps local development friction-free while production
runs on pgvector.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class PgVectorStore:
    """Thin async wrapper around the ``document_chunks`` table.

    All methods are safe to call when pgvector is unavailable — they
    simply return empty results / no-ops, and the caller is expected to
    fall back to the FAISS store.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        # Cached availability check — set lazily on first call so app
        # startup doesn't depend on the DB being reachable.
        self._available: bool | None = None

    async def _detect_available(self, db: AsyncSession) -> bool:
        if self._available is not None:
            return self._available
        if os.getenv("USE_PGVECTOR", "1").lower() in ("0", "false", "no"):
            self._available = False
            return False
        try:
            dialect = db.bind.dialect.name if db.bind else ""
            if dialect != "postgresql":
                self._available = False
                return False
            row = (
                await db.execute(text("SELECT 1 FROM pg_extension WHERE extname='vector'"))
            ).first()
            self._available = bool(row)
        except Exception as exc:
            logger.warning("pgvector detection failed: %s", exc)
            self._available = False
        return self._available

    @staticmethod
    def _format_vector(values: list[float]) -> str:
        # pgvector accepts the literal "[0.1,0.2,...]" string form.
        return "[" + ",".join(f"{v:.6f}" for v in values) + "]"

    async def add_documents(
        self,
        docs: list[dict],
        *,
        db: AsyncSession | None = None,
    ) -> int:
        """Embed and persist a batch of chunks. Returns the inserted count."""
        if not docs:
            return 0

        own_session = db is None
        session: AsyncSession = db or SessionLocal()
        try:
            if not await self._detect_available(session):
                return 0
            texts = [d["text"] for d in docs]
            embeddings = await llm_service.embed_texts(texts)
            inserted = 0
            for doc, emb in zip(docs, embeddings):
                meta = doc.get("metadata", {}) or {}
                await session.execute(
                    text(
                        """
                        INSERT INTO document_chunks
                            (id, user_id, conversation_id, file_id, source, page,
                             chunk_text, embedding, metadata_json)
                        VALUES
                            (:id, :user_id, :conversation_id, :file_id, :source, :page,
                             :chunk_text, CAST(:embedding AS vector), CAST(:meta AS jsonb))
                        """
                    ),
                    {
                        "id": str(doc.get("id") or uuid.uuid4()),
                        "user_id": meta.get("user_id"),
                        "conversation_id": meta.get("conversation_id"),
                        "file_id": meta.get("file_id"),
                        "source": meta.get("source") or "file",
                        "page": meta.get("page"),
                        "chunk_text": doc["text"],
                        "embedding": self._format_vector(emb),
                        "meta": json.dumps(meta),
                    },
                )
                inserted += 1
            if own_session:
                await session.commit()
            return inserted
        except Exception as exc:
            logger.warning("pgvector add_documents failed (will fall back): %s", exc)
            if own_session:
                try:
                    await session.rollback()
                except Exception:
                    pass
            return 0
        finally:
            if own_session:
                await session.close()

    async def similarity_search(
        self,
        query: str,
        *,
        top_k: int = 5,
        user_id: str | None = None,
        conversation_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> list[dict[str, Any]]:
        own_session = db is None
        session: AsyncSession = db or SessionLocal()
        try:
            if not await self._detect_available(session):
                return []
            embeddings = await llm_service.embed_texts([query])
            if not embeddings:
                return []
            params: dict[str, Any] = {
                "embedding": self._format_vector(embeddings[0]),
                "top_k": top_k,
            }
            where: list[str] = []
            if user_id:
                where.append("(user_id = :user_id OR user_id IS NULL)")
                params["user_id"] = user_id
            if conversation_id:
                where.append("conversation_id = :conversation_id")
                params["conversation_id"] = conversation_id
            where_sql = (" WHERE " + " AND ".join(where)) if where else ""

            sql = text(
                f"""
                SELECT id, chunk_text, metadata_json,
                       1 - (embedding <=> CAST(:embedding AS vector)) AS score
                FROM document_chunks
                {where_sql}
                ORDER BY embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
                """
            )
            rows = (await session.execute(sql, params)).mappings().all()
            return [
                {
                    "id": str(r["id"]),
                    "text": r["chunk_text"],
                    "metadata": r["metadata_json"] or {},
                    "score": float(r["score"]) if r["score"] is not None else 0.0,
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning("pgvector similarity_search failed: %s", exc)
            return []
        finally:
            if own_session:
                await session.close()


pgvector_store = PgVectorStore()
