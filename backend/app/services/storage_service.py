import mimetypes
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings
from app.services.supabase_storage import upload_bytes, make_key


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def save_upload(self, file: UploadFile, user_id: str, conversation_id: str) -> str:
        content = await file.read()
        max_bytes = self.settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(f"File too large. Max size is {self.settings.max_upload_size_mb} MB")

        filename = file.filename or "upload.bin"
        key = make_key(f"{user_id}/{conversation_id}", filename)
        return upload_bytes(content, key, file.content_type)

    def detect_content_type(self, path: str, fallback: str | None = None) -> str | None:
        guessed, _ = mimetypes.guess_type(path)
        return guessed or fallback

    def as_path(self, storage_path: str) -> Path:
        return Path(storage_path)


storage_service = StorageService()
