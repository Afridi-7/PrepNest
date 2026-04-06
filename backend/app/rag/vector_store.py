import json
import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover - optional dependency fallback
    faiss = None


class VectorStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_dir = self.settings.vector_store_dir_path
        self.index_path = self.base_dir / "index.faiss"
        self.metadata_path = self.base_dir / "metadata.pkl"
        self.fallback_vec_path = self.base_dir / "vectors.npy"

        self.metadata: list[dict[str, Any]] = []
        self.vectors = np.empty((0, self.settings.vector_dim), dtype=np.float32)
        self.index = None
        self._load()

    def _load(self) -> None:
        if self.metadata_path.exists():
            self.metadata = pickle.loads(self.metadata_path.read_bytes())
        if self.fallback_vec_path.exists():
            self.vectors = np.load(self.fallback_vec_path)

        if faiss and self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))
        elif faiss:
            self.index = faiss.IndexFlatIP(self.settings.vector_dim)
            if len(self.vectors) > 0:
                self.index.add(self.vectors)

    def _persist(self) -> None:
        self.metadata_path.write_bytes(pickle.dumps(self.metadata))
        np.save(self.fallback_vec_path, self.vectors)
        if faiss and self.index is not None:
            faiss.write_index(self.index, str(self.index_path))

    async def add_documents(self, docs: list[dict]) -> None:
        if not docs:
            return

        texts = [d["text"] for d in docs]
        embeddings = await llm_service.embed_texts(texts)
        matrix = np.array(embeddings, dtype=np.float32)

        self.vectors = np.vstack([self.vectors, matrix]) if self.vectors.size else matrix
        for d in docs:
            self.metadata.append({"id": d["id"], "text": d["text"], "metadata": d.get("metadata", {})})

        if faiss:
            if self.index is None:
                self.index = faiss.IndexFlatIP(self.settings.vector_dim)
            self.index.add(matrix)

        self._persist()

    async def similarity_search(self, query: str, top_k: int | None = None, filters: dict | None = None) -> list[dict]:
        if len(self.metadata) == 0:
            return []

        top_k = top_k or self.settings.retrieval_top_k
        query_emb = np.array((await llm_service.embed_texts([query]))[0], dtype=np.float32).reshape(1, -1)

        if faiss and self.index is not None:
            scores, indices = self.index.search(query_emb, min(top_k * 4, len(self.metadata)))
            candidates = [(int(i), float(s)) for i, s in zip(indices[0], scores[0]) if i >= 0]
        else:
            scores = (self.vectors @ query_emb.T).reshape(-1)
            order = np.argsort(scores)[::-1][: min(top_k * 4, len(scores))]
            candidates = [(int(i), float(scores[i])) for i in order]

        filtered: list[dict] = []
        for idx, score in candidates:
            row = self.metadata[idx]
            payload = {
                "id": row["id"],
                "text": row["text"],
                "metadata": row.get("metadata", {}),
                "score": score,
            }
            if self._passes_filters(payload, filters):
                filtered.append(payload)
            if len(filtered) >= top_k:
                break

        return filtered

    def _passes_filters(self, record: dict, filters: dict | None) -> bool:
        if not filters:
            return True
        metadata = record.get("metadata", {})
        for key, value in filters.items():
            if metadata.get(key) != value:
                return False
        return True


vector_store = VectorStore()
