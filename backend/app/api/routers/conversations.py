from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db_session
from app.schemas.conversation import ConversationDetail, ConversationSummary, MessageResponse
from app.services.history_service import HistoryService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[ConversationSummary]:
    service = HistoryService(db)
    rows = await service.list_conversations(current_user.id)
    return [ConversationSummary(**row) for row in rows]


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation_detail(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ConversationDetail:
    service = HistoryService(db)
    row = await service.get_conversation(current_user.id, conversation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationDetail(
        id=row["id"],
        title=row["title"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        messages=[
            MessageResponse(
                id=m["id"],
                role=m["role"],
                content=m["content"],
                created_at=m["created_at"],
                metadata=m["metadata"],
            )
            for m in row["messages"]
        ],
    )
