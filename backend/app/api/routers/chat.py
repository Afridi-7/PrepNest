from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, is_user_pro, rate_limit
from app.models import User
from app.db.models import Conversation, Message
from app.db.session import get_db_session
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])

FREE_DAILY_MESSAGE_LIMIT = 5


async def _enforce_daily_message_limit(user: User, db: AsyncSession) -> None:
    """Raise 403 if a free user has already sent >= FREE_DAILY_MESSAGE_LIMIT messages today."""
    if is_user_pro(user):
        return
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count_result = await db.execute(
        select(func.count())
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.user_id == user.id,
            Message.role == "user",
            Message.created_at >= today_start,
        )
    )
    today_count = count_result.scalar() or 0
    if today_count >= FREE_DAILY_MESSAGE_LIMIT:
        raise HTTPException(
            status_code=403,
            detail=f"Free users can send up to {FREE_DAILY_MESSAGE_LIMIT} messages per day. Upgrade to Pro for unlimited!",
        )


@router.post("", response_model=ChatResponse)
async def chat_completion(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "chat_completion")),
) -> ChatResponse:
    await _enforce_daily_message_limit(current_user, db)
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
    _rl=Depends(rate_limit(30, "chat_stream")),
) -> StreamingResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = ChatService(db)
    generator = service.stream_response(
        user_id=current_user.id,
        message=payload.message,
        conversation_id=payload.conversation_id,
        learning_level=payload.learning_level,
        attachments=[a.model_dump() for a in payload.attachments] if payload.attachments else None,
    )
    return StreamingResponse(generator, media_type="text/event-stream")
