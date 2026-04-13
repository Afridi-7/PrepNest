import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.db.models import MCQ, ContactInfo, Subject, Topic, User
from app.db.session import get_db_session
from app.services.supabase_storage import async_upload_bytes, make_key
from app.schemas.content import (
    ContactInfoRead,
    ContactInfoUpdate,
    DashboardStats,
    DashboardSubjectStat,
)

router = APIRouter(tags=["dashboard"])


# ── Dashboard stats ──────────────────────────────────────────────────────────

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Single aggregation query instead of N+1 loop
    topic_count_sq = (
        select(Topic.subject_id, func.count(Topic.id).label("topic_count"))
        .group_by(Topic.subject_id)
        .subquery()
    )
    mcq_count_sq = (
        select(Topic.subject_id, func.count(MCQ.id).label("mcq_count"))
        .join(MCQ, MCQ.topic_id == Topic.id)
        .group_by(Topic.subject_id)
        .subquery()
    )
    stmt = (
        select(
            Subject.id,
            Subject.name,
            func.coalesce(topic_count_sq.c.topic_count, 0).label("topic_count"),
            func.coalesce(mcq_count_sq.c.mcq_count, 0).label("mcq_count"),
        )
        .outerjoin(topic_count_sq, Subject.id == topic_count_sq.c.subject_id)
        .outerjoin(mcq_count_sq, Subject.id == mcq_count_sq.c.subject_id)
        .order_by(Subject.name)
    )
    rows = (await db.execute(stmt)).all()

    subject_stats: list[DashboardSubjectStat] = []
    total_topics = 0
    total_mcqs = 0

    for row in rows:
        tc = row.topic_count
        mc = row.mcq_count
        total_topics += tc
        total_mcqs += mc
        subject_stats.append(
            DashboardSubjectStat(id=row.id, name=row.name, topic_count=tc, mcq_count=mc)
        )

    return DashboardStats(
        user_name=current_user.full_name or current_user.email.split("@")[0],
        total_subjects=len(rows),
        total_topics=total_topics,
        total_mcqs=total_mcqs,
        subjects=subject_stats,
    )


# ── Contact info (singleton row) ────────────────────────────────────────────

async def _get_or_create_contact(db: AsyncSession) -> ContactInfo:
    result = await db.execute(select(ContactInfo).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        row = ContactInfo(name="PrepNest Team", bio="We help students prepare for USAT and beyond.")
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/contact", response_model=ContactInfoRead)
async def get_contact_info(db: AsyncSession = Depends(get_db_session)):
    return await _get_or_create_contact(db)


@router.put("/contact", response_model=ContactInfoRead)
async def update_contact_info(
    payload: ContactInfoUpdate,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    row = await _get_or_create_contact(db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/contact/image", response_model=ContactInfoRead)
async def upload_contact_image(
    file: UploadFile = File(...),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB.")
    ext = (file.filename or "img.png").rsplit(".", 1)[-1]
    safe_name = f"contact_{uuid.uuid4().hex[:12]}.{ext}"
    key = f"visuals/{safe_name}"
    image_url = await async_upload_bytes(content, key, file.content_type)
    row = await _get_or_create_contact(db)
    row.image_url = image_url
    await db.commit()
    await db.refresh(row)
    return row
