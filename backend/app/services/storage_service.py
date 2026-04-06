import mimetypes
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def save_upload(self, file: UploadFile, user_id: str, conversation_id: str) -> str:
        safe_name = f"{uuid.uuid4()}_{file.filename or 'upload.bin'}"
        target_dir = self.settings.upload_dir_path / user_id / conversation_id
        target_dir.mkdir(parents=True, exist_ok=True)
        destination = target_dir / safe_name

        content = await file.read()
        max_bytes = self.settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(f"File too large. Max size is {self.settings.max_upload_size_mb} MB")

        destination.write_bytes(content)
        return str(destination)

    def detect_content_type(self, path: str, fallback: str | None = None) -> str | None:
        guessed, _ = mimetypes.guess_type(path)
        return guessed or fallback

    def as_path(self, storage_path: str) -> Path:
        return Path(storage_path)


storage_service = StorageService()
