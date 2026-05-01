from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, rate_limit
from app.api.pagination import DEFAULT_LIMIT, MAX_LIMIT, Page
from app.models import User
from app.db.session import get_db_session
from app.schemas.conversation import ConversationDetail, ConversationSummary, MessageResponse
from app.services.history_service import HistoryService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    limit: int = Query(50, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "conv_list")),
) -> list[ConversationSummary]:
    """Backward-compatible flat list. Newer clients should prefer the
    ``/conversations/page`` endpoint which returns a total count and a
    ``has_more`` flag."""
    service = HistoryService(db)
    rows = await service.list_conversations(current_user.id, limit=limit, offset=offset)
    return [ConversationSummary(**row) for row in rows]


@router.get("/page", response_model=Page[ConversationSummary])
async def list_conversations_page(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "conv_list_page")),
) -> Page[ConversationSummary]:
    """Paginated conversation list. Returns the standard ``Page`` envelope
    (items, total, limit, offset, has_more) so the frontend can render
    pagination controls without a second count call."""
    service = HistoryService(db)
    rows = await service.list_conversations(current_user.id, limit=limit, offset=offset)
    total = await service.count_conversations(current_user.id)
    return Page[ConversationSummary](
        items=[ConversationSummary(**row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=(offset + len(rows)) < total,
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation_detail(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "conv_detail")),
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
