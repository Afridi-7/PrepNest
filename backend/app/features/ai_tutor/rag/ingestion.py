from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FileAsset
from app.db.repositories.file_repo import FileAssetRepository
from app.features.ai_tutor.rag.chunking import build_chunk_documents
from app.features.ai_tutor.rag.vector_store import vector_store
from app.features.ai_tutor.tools.ocr_tool import extract_image_text
from app.features.ai_tutor.tools.pdf_tool import extract_pdf_text
from app.services.pgvector_store import pgvector_store


async def ingest_file_to_vector_store(db: AsyncSession, file_asset: FileAsset) -> dict:
    file_repo = FileAssetRepository(db)

    try:
        path = Path(file_asset.storage_path)
        ext = path.suffix.lower()

        text = ""
        if ext == ".pdf":
            text = extract_pdf_text(str(path))
        elif ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp"}:
            text = extract_image_text(str(path))
        else:
            text = path.read_text(encoding="utf-8", errors="ignore")

        if not text.strip():
            file_asset.error_message = "No extractable text"
            file_asset.processed_at = datetime.now(timezone.utc)
            await file_repo.mark_status(file_asset, "failed", {"reason": "No extractable text"})
            return {"status": "failed", "chunks": 0}

        docs = build_chunk_documents(
            text=text,
            source_id=file_asset.id,
            source_type="file",
            base_metadata={
                "file_id": file_asset.id,
                "filename": file_asset.filename,
                "user_id": file_asset.user_id,
                "conversation_id": file_asset.conversation_id,
            },
        )

        # Phase 3: write embeddings to pgvector when available so all replicas
        # share one canonical store. If pgvector is not configured / not on
        # Postgres, we still keep the local FAISS path as a fallback so
        # development never breaks.
        pg_inserted = await pgvector_store.add_documents(docs, db=db)
        if pg_inserted == 0:
            await vector_store.add_documents(docs)

        file_asset.processed_at = datetime.now(timezone.utc)
        await file_repo.mark_status(file_asset, "ready", {"chunks": len(docs)})

        return {"status": "ready", "chunks": len(docs)}
    except Exception as exc:
        file_asset.error_message = str(exc)[:1024]
        file_asset.processed_at = datetime.now(timezone.utc)
        await file_repo.mark_status(file_asset, "failed", {"reason": str(exc)})
        return {"status": "failed", "chunks": 0, "error": str(exc)}
