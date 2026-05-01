"""Public site settings — currently social media links editable by admins."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.models import SiteSettings, User
from app.db.session import get_db_session
from app.services.cache_service import cache_service

router = APIRouter(prefix="/site", tags=["site"])

_DEFAULT_ID = "default"
# Cache key for the singleton row. Long TTL because admins rarely edit; the
# PUT handler explicitly invalidates so changes appear instantly.
_SETTINGS_CACHE_KEY = "site:settings:default"
_SETTINGS_CACHE_TTL = 86400  # 24h


class SiteSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    instagram_url: str | None = None
    facebook_url: str | None = None
    youtube_url: str | None = None
    tiktok_url: str | None = None
    linkedin_url: str | None = None


class SiteSettingsUpdate(BaseModel):
    instagram_url: HttpUrl | None = None
    facebook_url: HttpUrl | None = None
    youtube_url: HttpUrl | None = None
    tiktok_url: HttpUrl | None = None
    linkedin_url: HttpUrl | None = None


async def _get_or_create(session: AsyncSession) -> SiteSettings:
    row = (await session.execute(select(SiteSettings).where(SiteSettings.id == _DEFAULT_ID))).scalar_one_or_none()
    if row is None:
        row = SiteSettings(id=_DEFAULT_ID)
        session.add(row)
        await session.flush()
    return row


@router.get("/settings", response_model=SiteSettingsRead)
async def read_settings(session: AsyncSession = Depends(get_db_session)) -> SiteSettingsRead:
    # Hot path: served on every page load (Footer renders social icons). Cache
    # the JSON dict and re-validate cheaply via Pydantic on hit.
    cached = await cache_service.get_json(_SETTINGS_CACHE_KEY)
    if cached is not None:
        return SiteSettingsRead.model_validate(cached)
    row = await _get_or_create(session)
    await session.commit()
    result = SiteSettingsRead.model_validate(row)
    await cache_service.set_json(
        _SETTINGS_CACHE_KEY, result.model_dump(), ttl_seconds=_SETTINGS_CACHE_TTL
    )
    return result


@router.put("/settings", response_model=SiteSettingsRead)
async def update_settings(
    payload: SiteSettingsUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_admin),
) -> SiteSettingsRead:
    row = await _get_or_create(session)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        # Pydantic HttpUrl -> str for storage; allow null to clear.
        setattr(row, key, str(value) if value is not None else None)
    await session.commit()
    await session.refresh(row)
    # Bust the cache so the very next read returns fresh data.
    await cache_service.delete(_SETTINGS_CACHE_KEY)
    return SiteSettingsRead.model_validate(row)
