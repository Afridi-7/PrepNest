from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PendingSignup


class PendingSignupRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> PendingSignup | None:
        result = await self.db.execute(select(PendingSignup).where(PendingSignup.email == email))
        return result.scalar_one_or_none()

    async def get_by_token(self, token: str) -> PendingSignup | None:
        result = await self.db.execute(select(PendingSignup).where(PendingSignup.token == token))
        return result.scalar_one_or_none()

    async def create_or_refresh(
        self,
        *,
        email: str,
        password_hash: str,
        full_name: str | None = None,
        expires_in_minutes: int = 60,
    ) -> PendingSignup:
        existing = await self.get_by_email(email)
        now = datetime.now(timezone.utc)
        token = token_urlsafe(32)
        expires_at = now + timedelta(minutes=expires_in_minutes)

        if existing is None:
            pending = PendingSignup(
                email=email,
                password_hash=password_hash,
                full_name=full_name,
                token=token,
                expires_at=expires_at,
                verified_at=None,
            )
            self.db.add(pending)
            await self.db.commit()
            await self.db.refresh(pending)
            return pending

        existing.password_hash = password_hash
        existing.full_name = full_name
        existing.token = token
        existing.expires_at = expires_at
        existing.verified_at = None
        await self.db.commit()
        await self.db.refresh(existing)
        return existing

    async def mark_verified(self, pending: PendingSignup) -> PendingSignup:
        pending.verified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(pending)
        return pending