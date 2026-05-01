import asyncio
import logging

from sqlalchemy import select

from app.models import FileAsset
from app.db.session import SessionLocal
from app.features.ai_tutor.rag.ingestion import ingest_file_to_vector_store
from app.features.ai_tutor.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="tasks.ingest_file",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=3,
    acks_late=True,
)
def ingest_file_task(file_id: str) -> dict:
    """Parse, chunk, embed, and index an uploaded file.

    Errors automatically retry with exponential backoff up to 3 times. The
    underlying ``ingest_file_to_vector_store`` writes a "failed" status on
    the FileAsset on terminal failure, so the API always has a definitive
    end-state to report to the user.
    """

    async def _runner() -> dict:
        async with SessionLocal() as session:
            result = await session.execute(select(FileAsset).where(FileAsset.id == file_id))
            file_asset = result.scalar_one_or_none()
            if not file_asset:
                logger.warning("ingest_file_task: file %s not found", file_id)
                return {"status": "failed", "error": "file not found"}
            return await ingest_file_to_vector_store(session, file_asset)

    return asyncio.run(_runner())
