"""Public site settings — currently social media links editable by admins."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.models import SiteSettings, User
from app.db.session import get_db_session

router = APIRouter(prefix="/site", tags=["site"])

_DEFAULT_ID = "default"


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
    row = await _get_or_create(session)
    await session.commit()
    return SiteSettingsRead.model_validate(row)


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
    return SiteSettingsRead.model_validate(row)
