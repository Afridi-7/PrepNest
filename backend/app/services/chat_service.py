import json
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import AgentContext
from app.agents.ai_tutor.orchestration.orchestrator import orchestrator
from app.repositories.conversation_repo import ConversationRepository
from app.repositories.message_repo import MessageRepository
from app.repositories.user_repo import UserRepository


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.conversation_repo = ConversationRepository(db)
        self.message_repo = MessageRepository(db)
        self.user_repo = UserRepository(db)

    async def _ensure_conversation(self, *, user_id: str, conversation_id: str | None, initial_title: str) -> str:
        if conversation_id:
            existing = await self.conversation_repo.get_by_id(conversation_id, user_id)
            if existing:
                return existing.id
        created = await self.conversation_repo.create(user_id=user_id, title=initial_title)
        return created.id

    async def create_response(
        self,
        *,
        user_id: str,
        message: str,
        conversation_id: str | None,
        learning_level: str | None,
        attachments: list[dict] | None = None,
    ) -> dict:
        conversation_id = await self._ensure_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
            initial_title=message[:80],
        )

        await self.message_repo.create(conversation_id=conversation_id, role="user", content=message)

        user = await self.user_repo.get_by_id(user_id)
        recent_messages = await self.message_repo.list_recent_for_conversation(conversation_id)
        ctx = AgentContext(
            user_id=user_id,
            conversation_id=conversation_id,
            query=message,
            learning_level=learning_level or (user.preferences.get("learning_level") if user and user.preferences else "intermediate"),
            recent_messages=[{"role": m.role, "content": m.content} for m in recent_messages],
            user_preferences=user.preferences if user else {},
            attachments=attachments or [],
        )

        result = await orchestrator.run(ctx)

        await self.message_repo.create(
            conversation_id=conversation_id,
            role="assistant",
            content=result["answer"],
            metadata_json={"used_agents": result["used_agents"], "references": result["references"], "visuals": result["visuals"]},
        )

        return {
            "conversation_id": conversation_id,
            "answer": result["answer"],
            "used_agents": result["used_agents"],
            "references": result["references"],
            "visuals": result["visuals"],
        }

    async def stream_response(
        self,
        *,
        user_id: str,
        message: str,
        conversation_id: str | None,
        learning_level: str | None,
        attachments: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        conversation_id = await self._ensure_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
            initial_title=message[:80],
        )

        await self.message_repo.create(conversation_id=conversation_id, role="user", content=message)

        user = await self.user_repo.get_by_id(user_id)
        recent_messages = await self.message_repo.list_recent_for_conversation(conversation_id)
        ctx = AgentContext(
            user_id=user_id,
            conversation_id=conversation_id,
            query=message,
            learning_level=learning_level or (user.preferences.get("learning_level") if user and user.preferences else "intermediate"),
            recent_messages=[{"role": m.role, "content": m.content} for m in recent_messages],
            user_preferences=user.preferences if user else {},
            attachments=attachments or [],
        )

        token_stream, metadata = await orchestrator.stream(ctx)

        collected = []
        async for token in token_stream:
            collected.append(token)
            yield f"data: {json.dumps({'type': 'token', 'value': token})}\n\n"

        answer = "".join(collected)
        await self.message_repo.create(
            conversation_id=conversation_id,
            role="assistant",
            content=answer,
            metadata_json={"used_agents": metadata["used_agents"], "references": metadata["references"], "visuals": metadata["visuals"]},
        )

        done_payload = {
            "type": "done",
            "conversation_id": conversation_id,
            "used_agents": metadata["used_agents"],
            "references": metadata["references"],
            "visuals": metadata["visuals"],
        }
        yield f"data: {json.dumps(done_payload)}\n\n"
