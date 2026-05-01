from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Conversation


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, title: str | None = None) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title or "New Conversation")
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def get_by_id(self, conversation_id: str, user_id: str) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at), desc(Conversation.created_at))
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def count_for_user(self, user_id: str) -> int:
        from sqlalchemy import func

        result = await self.db.execute(
            select(func.count(Conversation.id)).where(Conversation.user_id == user_id)
        )
        return int(result.scalar_one() or 0)

    async def rename_if_default(self, conversation: Conversation, new_title: str) -> None:
        if conversation.title == "New Conversation":
            conversation.title = new_title[:120]
            await self.db.commit()
