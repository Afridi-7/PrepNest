from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Message


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        conversation_id: str,
        role: str,
        content: str,
        metadata_json: dict | None = None,
        token_count: int | None = None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            metadata_json=metadata_json or {},
            token_count=token_count,
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def list_for_conversation(self, conversation_id: str, limit: int = 100) -> list[Message]:
        # Subquery grabs the N most recent rows; outer query re-sorts ASC (avoids Python .reverse())
        sub = (
            select(Message.id)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
            .subquery()
        )
        result = await self.db.execute(
            select(Message)
            .where(Message.id.in_(select(sub.c.id)))
            .order_by(asc(Message.created_at))
        )
        return list(result.scalars().all())

    async def list_recent_for_conversation(self, conversation_id: str, limit: int = 12) -> list[Message]:
        sub = (
            select(Message.id)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
            .subquery()
        )
        result = await self.db.execute(
            select(Message)
            .where(Message.id.in_(select(sub.c.id)))
            .order_by(asc(Message.created_at))
        )
        return list(result.scalars().all())
