from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, is_user_pro
from app.db.models import Conversation, Message, User
from app.db.session import get_db_session
from app.schemas.content import AIChatRequest, AIExplainRequest, AIResponse, AISolveRequest
from app.services.ai_learning_service import AILearningService

router = APIRouter(prefix="/ai", tags=["ai-learning"])

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


@router.post("/chat", response_model=AIResponse)
async def ai_chat(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AIResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = AILearningService(db)
    return await service.run(prompt=payload.question, mode="chat", include_web=payload.include_web)


@router.post("/explain", response_model=AIResponse)
async def ai_explain(
    payload: AIExplainRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AIResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = AILearningService(db)
    prompt = f"Explain this topic in depth with examples: {payload.topic}."
    return await service.run(prompt=prompt, mode="explain", include_web=payload.include_web)


@router.post("/solve", response_model=AIResponse)
async def ai_solve(
    payload: AISolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AIResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = AILearningService(db)
    prompt = f"Solve this in {payload.mode} mode, step-by-step, and verify final answer: {payload.prompt}"
    return await service.run(prompt=prompt, mode=payload.mode, include_web=payload.include_web)


# ── Streaming variants ────────────────────────────────────────────────────────


@router.post("/chat/stream")
async def ai_chat_stream(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = AILearningService(db)
    return StreamingResponse(
        service.stream_run(prompt=payload.question, mode="chat", include_web=payload.include_web),
        media_type="text/event-stream",
    )


@router.post("/explain/stream")
async def ai_explain_stream(
    payload: AIExplainRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = AILearningService(db)
    prompt = f"Explain this topic in depth with examples: {payload.topic}."
    return StreamingResponse(
        service.stream_run(prompt=prompt, mode="explain", include_web=payload.include_web),
        media_type="text/event-stream",
    )


@router.post("/solve/stream")
async def ai_solve_stream(
    payload: AISolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    await _enforce_daily_message_limit(current_user, db)
    service = AILearningService(db)
    prompt = f"Solve this in {payload.mode} mode, step-by-step, and verify final answer: {payload.prompt}"
    return StreamingResponse(
        service.stream_run(prompt=prompt, mode=payload.mode, include_web=payload.include_web),
        media_type="text/event-stream",
    )
