from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db_session
from app.schemas.content import AIChatRequest, AIExplainRequest, AIResponse, AISolveRequest
from app.services.ai_learning_service import AILearningService

router = APIRouter(prefix="/ai", tags=["ai-learning"])


@router.post("/chat", response_model=AIResponse)
async def ai_chat(
    payload: AIChatRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AIResponse:
    service = AILearningService(db)
    return await service.run(prompt=payload.question, mode="chat", include_web=payload.include_web)


@router.post("/explain", response_model=AIResponse)
async def ai_explain(
    payload: AIExplainRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AIResponse:
    service = AILearningService(db)
    prompt = f"Explain this topic in depth with examples: {payload.topic}."
    return await service.run(prompt=prompt, mode="explain", include_web=payload.include_web)


@router.post("/solve", response_model=AIResponse)
async def ai_solve(
    payload: AISolveRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AIResponse:
    service = AILearningService(db)
    prompt = f"Solve this in {payload.mode} mode, step-by-step, and verify final answer: {payload.prompt}"
    return await service.run(prompt=prompt, mode=payload.mode, include_web=payload.include_web)
