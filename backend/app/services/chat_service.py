import json
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.ai_tutor.agents.base import AgentContext
from app.features.ai_tutor.orchestration.orchestrator import orchestrator
from app.db.repositories.conversation_repo import ConversationRepository
from app.db.repositories.message_repo import MessageRepository
from app.db.repositories.user_repo import UserRepository


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
            user_name=user.full_name or "" if user else "",
            user_email=user.email or "" if user else "",
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

        # Emit an immediate status hint so the UI can show "Preparing answer…"
        # while we build agent context. This work normally takes <500 ms but
        # feels longer under cold-start conditions on Render Starter.
        yield f"data: {json.dumps({'type': 'status', 'phase': 'preparing', 'conversation_id': conversation_id})}\n\n"

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
            user_name=user.full_name or "" if user else "",
            user_email=user.email or "" if user else "",
        )

        try:
            token_stream, metadata = await orchestrator.stream(ctx)
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        collected = []
        first_token_sent = False
        try:
            async for token in token_stream:
                if not first_token_sent:
                    # Emit a single "generating" status the moment the model
                    # actually starts producing output. The frontend uses this
                    # to swap the "Preparing answer…" hint for a typing cursor
                    # the instant tokens are flowing.
                    yield f"data: {json.dumps({'type': 'status', 'phase': 'generating'})}\n\n"
                    first_token_sent = True
                collected.append(token)
                yield f"data: {json.dumps({'type': 'token', 'value': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

        answer = "".join(collected)
        if answer:
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
