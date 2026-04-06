from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FileAsset


class FileAssetRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        conversation_id: str,
        user_id: str,
        filename: str,
        storage_path: str,
        content_type: str | None,
        metadata_json: dict | None = None,
    ) -> FileAsset:
        file_asset = FileAsset(
            conversation_id=conversation_id,
            user_id=user_id,
            filename=filename,
            storage_path=storage_path,
            content_type=content_type,
            metadata_json=metadata_json or {},
        )
        self.db.add(file_asset)
        await self.db.commit()
        await self.db.refresh(file_asset)
        return file_asset

    async def get_by_id(self, file_id: str, user_id: str) -> FileAsset | None:
        result = await self.db.execute(
            select(FileAsset).where(FileAsset.id == file_id, FileAsset.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def mark_status(self, file_asset: FileAsset, status: str, metadata_json: dict | None = None) -> FileAsset:
        file_asset.status = status
        if metadata_json:
            file_asset.metadata_json = {**(file_asset.metadata_json or {}), **metadata_json}
        await self.db.commit()
        await self.db.refresh(file_asset)
        return file_asset

    async def list_for_conversation(self, conversation_id: str) -> list[FileAsset]:
        result = await self.db.execute(
            select(FileAsset)
            .where(FileAsset.conversation_id == conversation_id)
            .order_by(desc(FileAsset.created_at))
        )
        return list(result.scalars().all())
