from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.models import User
from app.db.session import get_db_session
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat_completion(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    service = ChatService(db)
    result = await service.create_response(
        user_id=current_user.id,
        message=payload.message,
        conversation_id=payload.conversation_id,
        learning_level=payload.learning_level,
        attachments=[a.model_dump() for a in payload.attachments] if payload.attachments else None,
    )
    return ChatResponse(**result)


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    service = ChatService(db)
    generator = service.stream_response(
        user_id=current_user.id,
        message=payload.message,
        conversation_id=payload.conversation_id,
        learning_level=payload.learning_level,
        attachments=[a.model_dump() for a in payload.attachments] if payload.attachments else None,
    )
    return StreamingResponse(generator, media_type="text/event-stream")
