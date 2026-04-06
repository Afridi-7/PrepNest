from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.repositories.file_repo import FileAssetRepository
from app.rag.ingestion import ingest_file_to_vector_store
from app.services.storage_service import storage_service


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.file_repo = FileAssetRepository(db)
        self.settings = get_settings()

    async def upload_and_index(
        self,
        *,
        file: UploadFile,
        user_id: str,
        conversation_id: str,
    ) -> dict:
        storage_path = await storage_service.save_upload(file, user_id=user_id, conversation_id=conversation_id)
        file_asset = await self.file_repo.create(
            conversation_id=conversation_id,
            user_id=user_id,
            filename=file.filename or "upload.bin",
            storage_path=storage_path,
            content_type=file.content_type,
            metadata_json={"uploaded_via": "api"},
        )

        await self.file_repo.mark_status(file_asset, "processing")
        if self.settings.enable_celery_ingestion:
            try:
                from app.workers.tasks import ingest_file_task

                ingest_file_task.delay(file_asset.id)
                return {
                    "file_id": file_asset.id,
                    "conversation_id": conversation_id,
                    "filename": file_asset.filename,
                    "status": "queued",
                }
            except Exception:
                # Fall back to inline indexing if worker/broker is unavailable.
                pass

        ingestion_result = await ingest_file_to_vector_store(self.db, file_asset)

        return {
            "file_id": file_asset.id,
            "conversation_id": conversation_id,
            "filename": file_asset.filename,
            "status": ingestion_result.get("status", file_asset.status),
        }
