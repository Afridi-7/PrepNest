def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> list[str]:
    if not text.strip():
        return []

    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end]
        chunks.append(chunk.strip())
        if end >= n:
            break
        start = max(0, end - overlap)
    return [c for c in chunks if c]


def build_chunk_documents(
    *,
    text: str,
    source_id: str,
    source_type: str,
    base_metadata: dict | None = None,
) -> list[dict]:
    docs: list[dict] = []
    for idx, chunk in enumerate(chunk_text(text)):
        docs.append(
            {
                "id": f"{source_id}_chunk_{idx}",
                "text": chunk,
                "metadata": {
                    **(base_metadata or {}),
                    "source_id": source_id,
                    "source_type": source_type,
                    "chunk_index": idx,
                },
            }
        )
    return docs
