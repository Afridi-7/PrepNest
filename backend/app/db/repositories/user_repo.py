from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_reset_token_hash(self, token_hash: str) -> User | None:
        result = await self.db.execute(select(User).where(User.reset_password_token_hash == token_hash))
        return result.scalar_one_or_none()

    async def get_by_google_id(self, google_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.google_id == google_id))
        return result.scalar_one_or_none()

    async def create(self, *, email: str, password_hash: str | None = None, full_name: str | None = None) -> User:
        user = User(email=email, password_hash=password_hash, full_name=full_name)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def create_google_user(self, *, email: str, full_name: str | None, google_id: str) -> User:
        user = User(email=email, full_name=full_name, google_id=google_id, is_verified=True)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def set_verified(self, user: User) -> User:
        user.is_verified = True
        user.verification_token = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def set_verification_token(self, user: User, token: str) -> User:
        user.verification_token = token
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def link_google_id(self, user: User, google_id: str) -> User:
        user.google_id = google_id
        user.is_verified = True
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def set_password_reset_token(
        self,
        user: User,
        *,
        token_hash: str,
        expires_at: datetime,
        requested_at: datetime | None = None,
    ) -> User:
        user.reset_password_token_hash = token_hash
        user.reset_password_token_expires_at = expires_at
        user.reset_password_requested_at = requested_at or datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def clear_password_reset_token(self, user: User) -> User:
        user.reset_password_token_hash = None
        user.reset_password_token_expires_at = None
        user.reset_password_requested_at = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_password(self, user: User, password_hash: str) -> User:
        user.password_hash = password_hash
        user.reset_password_token_hash = None
        user.reset_password_token_expires_at = None
        user.reset_password_requested_at = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_preferences(self, user: User, preferences: dict) -> User:
        user.preferences = {**(user.preferences or {}), **preferences}
        await self.db.commit()
        await self.db.refresh(user)
        return user
