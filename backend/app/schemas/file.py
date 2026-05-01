from datetime import datetime

from pydantic import BaseModel


class FileUploadResponse(BaseModel):
    file_id: str
    conversation_id: str
    filename: str
    status: str


class FileAssetResponse(BaseModel):
    id: str
    filename: str
    content_type: str | None
    status: str
    url: str
    metadata: dict
    created_at: datetime


class FileStatusResponse(BaseModel):
    """Lightweight status payload for the upload progress poller."""

    id: str
    status: str  # "pending" | "processing" | "ready" | "indexed" | "failed"
    error: str | None = None
    processed_at: datetime | None = None
