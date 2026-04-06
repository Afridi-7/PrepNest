from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FileAsset
from app.db.repositories.file_repo import FileAssetRepository
from app.rag.chunking import build_chunk_documents
from app.rag.vector_store import vector_store
from app.tools.ocr_tool import extract_image_text
from app.tools.pdf_tool import extract_pdf_text


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

        await vector_store.add_documents(docs)
        await file_repo.mark_status(file_asset, "indexed", {"chunks": len(docs)})

        return {"status": "indexed", "chunks": len(docs)}
    except Exception as exc:
        await file_repo.mark_status(file_asset, "failed", {"reason": str(exc)})
        return {"status": "failed", "chunks": 0, "error": str(exc)}
