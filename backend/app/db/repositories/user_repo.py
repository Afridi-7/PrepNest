from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User

# ---------------------------------------------------------------------------
# New-signup free trial
# ---------------------------------------------------------------------------
# Every brand-new account is granted Pro access for this many days, free of
# charge. After it elapses, the user automatically falls back to the Free
# tier (because `is_currently_pro` checks `subscription_expires_at`). Set to
# 0 to disable.
SIGNUP_TRIAL_DAYS = 3


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

    @staticmethod
    def _apply_signup_trial(user: User) -> None:
        """Grant a free Pro trial to a freshly-created account.

        Uses the same `is_pro` + `subscription_expires_at` columns as paid
        Pro, so every existing Pro-gated feature works during the trial
        without any new code paths. `granted_by_admin=False` ensures admin
        revocation logic isn't confused with this auto-grant.
        """
        if SIGNUP_TRIAL_DAYS <= 0:
            return
        user.is_pro = True
        user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=SIGNUP_TRIAL_DAYS)
        user.granted_by_admin = False

    async def create(self, *, email: str, password_hash: str | None = None, full_name: str | None = None) -> User:
        user = User(email=email, password_hash=password_hash, full_name=full_name)
        self._apply_signup_trial(user)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def create_google_user(self, *, email: str, full_name: str | None, google_id: str) -> User:
        user = User(email=email, full_name=full_name, google_id=google_id, is_verified=True)
        self._apply_signup_trial(user)
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

    async def set_pro_status(self, user: User, is_pro: bool) -> User:
        user.is_pro = is_pro
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def grant_pro(
        self, user: User, *, expires_at: datetime, granted_by_admin: bool = True
    ) -> User:
        user.is_pro = True
        user.subscription_expires_at = expires_at
        user.granted_by_admin = granted_by_admin
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def revoke_pro(self, user: User) -> User:
        user.is_pro = False
        user.subscription_expires_at = None
        user.granted_by_admin = False
        await self.db.commit()
        await self.db.refresh(user)
        return user

    # ── Rewards & streak helpers ──────────────────────────────────────────
    @staticmethod
    def is_currently_pro(user: User) -> bool:
        """True if the user is admin, has a non-expired Pro grant, or any active Pro."""
        if user.is_admin:
            return True
        if not user.is_pro:
            return False
        # If subscription has an expiry, honour it
        if user.subscription_expires_at is not None:
            now = datetime.now(timezone.utc)
            exp = user.subscription_expires_at
            # Some DBs return naive datetimes; treat them as UTC.
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            return exp > now
        return True

    async def merge_preferences(self, user: User, patch: dict) -> User:
        """Shallow-merge a partial dict into preferences and persist."""
        user.preferences = {**(user.preferences or {}), **patch}
        # Tell SQLAlchemy the JSON dict mutated
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(user, "preferences")
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def list_all(self, *, skip: int = 0, limit: int = 100) -> list[User]:
        result = await self.db.execute(
            select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
