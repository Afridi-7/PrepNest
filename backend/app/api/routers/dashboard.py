import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import func, select, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.db.models import MCQ, ContactInfo, MockTest, PracticeResult, Subject, Topic, User
from app.db.session import get_db_session
from app.services.supabase_storage import async_upload_bytes, make_key
from app.schemas.content import (
    ContactInfoRead,
    ContactInfoUpdate,
    DashboardStats,
    DashboardSubjectStat,
    LeaderboardEntry,
    LeaderboardResponse,
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


# ── Leaderboard (public, no auth required) ──────────────────────────────────

@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    db: AsyncSession = Depends(get_db_session),
):
    """Top 10 users ranked by total MCQs solved correctly (mock tests + practice)."""
    from sqlalchemy import union_all, literal
    from app.db.session import database_url

    is_sqlite = database_url.startswith("sqlite")

    # ── Source 1: MCQ score from evaluated mock tests ──
    if is_sqlite:
        mcq_score_expr = func.coalesce(
            cast(func.json_extract(MockTest.result_json, "$.mcq_score"), Integer), 0
        )
    else:
        mcq_score_expr = func.coalesce(
            cast(MockTest.result_json.op("->>")("mcq_score"), Integer), 0
        )

    mock_sub = (
        select(
            MockTest.user_id,
            func.sum(mcq_score_expr).label("mcqs_solved"),
            func.count(MockTest.id).label("sessions"),
        )
        .where(MockTest.status == "evaluated")
        .group_by(MockTest.user_id)
        .subquery("mock_sub")
    )

    # ── Source 2: correct answers from practice results ──
    practice_sub = (
        select(
            PracticeResult.user_id,
            func.sum(PracticeResult.correct_answers).label("mcqs_solved"),
            func.count(PracticeResult.id).label("sessions"),
        )
        .group_by(PracticeResult.user_id)
        .subquery("practice_sub")
    )

    # ── Combine both sources per user ──
    stmt = (
        select(
            User.id.label("user_id"),
            User.full_name,
            User.email,
            (
                func.coalesce(mock_sub.c.mcqs_solved, 0)
                + func.coalesce(practice_sub.c.mcqs_solved, 0)
            ).label("mcqs_solved"),
            (
                func.coalesce(mock_sub.c.sessions, 0)
                + func.coalesce(practice_sub.c.sessions, 0)
            ).label("tests_taken"),
        )
        .outerjoin(mock_sub, User.id == mock_sub.c.user_id)
        .outerjoin(practice_sub, User.id == practice_sub.c.user_id)
        .where(
            (mock_sub.c.mcqs_solved.isnot(None))
            | (practice_sub.c.mcqs_solved.isnot(None))
        )
        .order_by(
            (
                func.coalesce(mock_sub.c.mcqs_solved, 0)
                + func.coalesce(practice_sub.c.mcqs_solved, 0)
            ).desc()
        )
        .limit(10)
    )

    rows = (await db.execute(stmt)).all()

    entries = []
    for rank, row in enumerate(rows, 1):
        name = row.full_name or row.email.split("@")[0]
        entries.append(
            LeaderboardEntry(
                rank=rank,
                user_name=name,
                mcqs_solved=row.mcqs_solved or 0,
                tests_taken=row.tests_taken,
            )
        )

    return LeaderboardResponse(
        entries=entries,
        updated_at=datetime.now(timezone.utc).isoformat(),
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
