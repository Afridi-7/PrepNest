from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, rate_limit
from app.core.config import get_settings
from app.models import User
from app.db.repositories.conversation_repo import ConversationRepository
from app.db.session import get_db_session
from app.schemas.file import FileUploadResponse
from app.services.file_service import FileService

router = APIRouter(prefix="/files", tags=["files"])

# Allow-list of file types user-attachments can be (RAG ingestion targets).
# Anything outside this list is rejected to prevent users abusing storage as a
# generic CDN or uploading executable/HTML payloads.
_ALLOWED_UPLOAD_EXTENSIONS = {
    ".pdf", ".txt", ".md", ".markdown", ".csv",
    ".png", ".jpg", ".jpeg", ".webp", ".gif",
    ".doc", ".docx",
}
_ALLOWED_UPLOAD_MIME_PREFIXES = (
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "image/",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
)


def _is_allowed_upload(filename: str, content_type: str | None) -> bool:
    name = (filename or "").lower()
    if not any(name.endswith(ext) for ext in _ALLOWED_UPLOAD_EXTENSIONS):
        return False
    ctype = (content_type or "").lower()
    if ctype and not any(ctype.startswith(p) for p in _ALLOWED_UPLOAD_MIME_PREFIXES):
        return False
    return True


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(30, "files_upload")),
) -> FileUploadResponse:
    if not _is_allowed_upload(file.filename or "", file.content_type):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, text, markdown, CSV, images, Word documents.",
        )

    settings = get_settings()
    # Note: storage_service also enforces this, but checking up-front avoids
    # buffering huge payloads through the upload pipeline.
    if file.size is not None and file.size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size is {settings.max_upload_size_mb} MB",
        )

    conversation_repo = ConversationRepository(db)
    conversation = await conversation_repo.get_by_id(conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    service = FileService(db)
    result = await service.upload_and_index(
        file=file,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )
    return FileUploadResponse(**result)
