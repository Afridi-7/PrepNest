import asyncio

from sqlalchemy import select

from app.db.models import FileAsset
from app.db.session import SessionLocal
from app.rag.ingestion import ingest_file_to_vector_store
from app.workers.celery_app import celery_app


@celery_app.task(name="tasks.ingest_file")
def ingest_file_task(file_id: str) -> dict:
    async def _runner() -> dict:
        async with SessionLocal() as session:
            result = await session.execute(select(FileAsset).where(FileAsset.id == file_id))
            file_asset = result.scalar_one_or_none()
            if not file_asset:
                return {"status": "failed", "error": "file not found"}
            return await ingest_file_to_vector_store(session, file_asset)

    return asyncio.run(_runner())
