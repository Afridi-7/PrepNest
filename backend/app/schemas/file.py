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
