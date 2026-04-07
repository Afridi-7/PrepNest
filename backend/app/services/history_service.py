from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.conversation_repo import ConversationRepository
from app.db.repositories.message_repo import MessageRepository


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.conversation_repo = ConversationRepository(db)
        self.message_repo = MessageRepository(db)

    async def list_conversations(self, user_id: str) -> list[dict]:
        rows = await self.conversation_repo.list_for_user(user_id)
        return [
            {
                "id": row.id,
                "title": row.title,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in rows
        ]

    async def get_conversation(self, user_id: str, conversation_id: str) -> dict | None:
        row = await self.conversation_repo.get_by_id(conversation_id, user_id)
        if not row:
            return None
        messages = await self.message_repo.list_for_conversation(conversation_id)
        return {
            "id": row.id,
            "title": row.title,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at,
                    "metadata": m.metadata_json or {},
                }
                for m in messages
            ],
        }
