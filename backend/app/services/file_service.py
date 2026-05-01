import logging

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.repositories.file_repo import FileAssetRepository
from app.features.ai_tutor.rag.ingestion import ingest_file_to_vector_store
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


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
        """Upload a file and kick off ingestion.

        Phase 2: the API never blocks on parsing/embedding. We persist the
        FileAsset row immediately, mark it ``processing``, and hand the
        heavy work to a Celery worker. The client polls
        ``GET /files/{id}/status`` for completion.

        For local dev where no broker is running, we transparently fall
        back to inline ingestion so uploads still work end-to-end.
        """
        storage_path = await storage_service.save_upload(
            file, user_id=user_id, conversation_id=conversation_id
        )
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
                from app.features.ai_tutor.workers.tasks import ingest_file_task

                async_result = ingest_file_task.delay(file_asset.id)
                # Best-effort task id capture for status polling.
                try:
                    file_asset.task_id = getattr(async_result, "id", None)
                    await self.db.commit()
                except Exception:
                    await self.db.rollback()
                return {
                    "file_id": file_asset.id,
                    "conversation_id": conversation_id,
                    "filename": file_asset.filename,
                    "status": "processing",
                }
            except Exception as exc:
                logger.warning(
                    "Celery enqueue failed for file %s, falling back to inline ingest: %s",
                    file_asset.id,
                    exc,
                )

        ingestion_result = await ingest_file_to_vector_store(self.db, file_asset)
        return {
            "file_id": file_asset.id,
            "conversation_id": conversation_id,
            "filename": file_asset.filename,
            "status": ingestion_result.get("status", file_asset.status),
        }
