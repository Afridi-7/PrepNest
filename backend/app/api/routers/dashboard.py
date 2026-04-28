import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import func, select, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user, rate_limit
from app.db.models import MCQ, Acknowledgment, ContactInfo, MockTest, PracticeResult, Subject, Topic, User
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.services.supabase_storage import async_upload_bytes
from app.schemas.content import (
    AcknowledgmentCreate,
    AcknowledgmentRead,
    AcknowledgmentUpdate,
    ContactInfoRead,
    ContactInfoUpdate,
    DashboardStats,
    DashboardSubjectStat,
    LeaderboardEntry,
    LeaderboardResponse,
    PreviousMonthWinner,
    SubjectAttemptedStat,
    UserRewards,
)

router = APIRouter(tags=["dashboard"])


# ── Dashboard stats ──────────────────────────────────────────────────────────

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "dash_stats")),
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

    # ── User-specific practice stats ──
    from app.db.session import database_url
    is_sqlite = database_url.startswith("sqlite")

    if is_sqlite:
        mcq_score_expr = func.coalesce(
            cast(func.json_extract(MockTest.result_json, "$.mcq_score"), Integer), 0
        )
        mcq_total_expr = func.coalesce(
            cast(func.json_extract(MockTest.result_json, "$.mcq_total"), Integer), 0
        )
    else:
        mcq_score_expr = func.coalesce(
            cast(MockTest.result_json.op("->>")('mcq_score'), Integer), 0
        )
        mcq_total_expr = func.coalesce(
            cast(MockTest.result_json.op("->>")('mcq_total'), Integer), 0
        )

    mock_row = (await db.execute(
        select(
            func.coalesce(func.sum(mcq_score_expr), 0).label("solved"),
            func.coalesce(func.sum(mcq_total_expr), 0).label("attempted"),
            func.count(MockTest.id).label("sessions"),
        ).where(MockTest.user_id == current_user.id, MockTest.status == "evaluated")
    )).one()

    practice_row = (await db.execute(
        select(
            func.coalesce(func.sum(PracticeResult.correct_answers), 0).label("solved"),
            func.coalesce(func.sum(PracticeResult.total_questions), 0).label("attempted"),
            func.count(PracticeResult.id).label("sessions"),
        ).where(PracticeResult.user_id == current_user.id)
    )).one()

    user_mcqs_solved = int(mock_row.solved) + int(practice_row.solved)
    user_mcqs_attempted = int(mock_row.attempted) + int(practice_row.attempted)
    user_tests_taken = int(mock_row.sessions) + int(practice_row.sessions)
    user_accuracy = round((user_mcqs_solved / user_mcqs_attempted * 100) if user_mcqs_attempted > 0 else 0.0, 1)

    # ── Per-subject attempted breakdown (practice results only) ──
    subj_label = func.coalesce(PracticeResult.subject_name, "General").label("subject_name")
    per_subject_rows = (await db.execute(
        select(
            subj_label,
            func.sum(PracticeResult.total_questions).label("attempted"),
            func.sum(PracticeResult.correct_answers).label("correct"),
        )
        .where(PracticeResult.user_id == current_user.id)
        .group_by(PracticeResult.subject_name)
        .order_by(func.sum(PracticeResult.total_questions).desc())
    )).all()

    subject_attempted = [
        SubjectAttemptedStat(
            subject_name=r.subject_name,
            attempted=int(r.attempted or 0),
            correct=int(r.correct or 0),
        )
        for r in per_subject_rows
    ]

    return DashboardStats(
        user_id=str(current_user.id),
        user_name=current_user.full_name or current_user.email.split("@")[0],
        is_pro=UserRepository.is_currently_pro(current_user),
        total_subjects=len(rows),
        total_topics=total_topics,
        total_mcqs=total_mcqs,
        subjects=subject_stats,
        mcqs_solved=user_mcqs_solved,
        mcqs_attempted=user_mcqs_attempted,
        tests_taken=user_tests_taken,
        accuracy=user_accuracy,
        subject_attempted=subject_attempted,
        rewards=_build_user_rewards(current_user),
    )


def _build_user_rewards(user: User) -> UserRewards:
    prefs = user.preferences or {}
    claimed = list(prefs.get("rewards_claimed") or [])
    expires_iso = None
    if user.subscription_expires_at is not None and 5 in claimed:
        exp = user.subscription_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > datetime.now(timezone.utc):
            expires_iso = exp.isoformat()
    return UserRewards(
        claimed=[int(x) for x in claimed if isinstance(x, int)],
        streak_savers=int(prefs.get("streak_savers") or 0),
        streak_current=int(prefs.get("streak_current") or 0),
        streak_best=int(prefs.get("streak_best") or 0),
        pro_trial_expires_at=expires_iso,
        is_elite=bool(prefs.get("elite_scholar")),
        consistency_badge=3 in claimed,
    )


# ── Leaderboard (public, no auth required) ──────────────────────────────────

@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "leaderboard")),
):
    """Top 10 users for the current month, ranked by MCQs solved correctly.

    The board automatically resets at 00:00 UTC on the 1st of every month
    because we only count rows whose ``created_at`` falls inside the current
    month. The previous month's #1 winner is returned alongside the current
    standings so the UI can show a small "Last month's champion" tile.
    """
    from app.db.session import database_url

    is_sqlite = database_url.startswith("sqlite")

    # ── Current-month window (UTC) ─────────────────────────────────────────
    now = datetime.now(timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if period_start.month == 12:
        period_end = period_start.replace(year=period_start.year + 1, month=1)
    else:
        period_end = period_start.replace(month=period_start.month + 1)

    # ── Previous month window for the "last month's winner" tile ───────────
    if period_start.month == 1:
        prev_start = period_start.replace(year=period_start.year - 1, month=12)
    else:
        prev_start = period_start.replace(month=period_start.month - 1)
    prev_end = period_start  # exclusive upper bound = start of current month

    if is_sqlite:
        mcq_score_expr = func.coalesce(
            cast(func.json_extract(MockTest.result_json, "$.mcq_score"), Integer), 0
        )
    else:
        mcq_score_expr = func.coalesce(
            cast(MockTest.result_json.op("->>")("mcq_score"), Integer), 0
        )

    def _build_top_query(window_start: datetime, window_end: datetime, limit: int):
        mock_sub = (
            select(
                MockTest.user_id,
                func.sum(mcq_score_expr).label("mcqs_solved"),
                func.count(MockTest.id).label("sessions"),
            )
            .where(
                MockTest.status == "evaluated",
                MockTest.created_at >= window_start,
                MockTest.created_at < window_end,
            )
            .group_by(MockTest.user_id)
            .subquery()
        )

        practice_sub = (
            select(
                PracticeResult.user_id,
                func.sum(PracticeResult.correct_answers).label("mcqs_solved"),
                func.count(PracticeResult.id).label("sessions"),
            )
            .where(
                PracticeResult.created_at >= window_start,
                PracticeResult.created_at < window_end,
            )
            .group_by(PracticeResult.user_id)
            .subquery()
        )

        total_solved = (
            func.coalesce(mock_sub.c.mcqs_solved, 0)
            + func.coalesce(practice_sub.c.mcqs_solved, 0)
        )

        return (
            select(
                User.id.label("user_id"),
                User.full_name,
                User.email,
                total_solved.label("mcqs_solved"),
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
            .order_by(total_solved.desc())
            .limit(limit)
        )

    rows = (await db.execute(_build_top_query(period_start, period_end, 10))).all()

    entries: list[LeaderboardEntry] = []
    for rank, row in enumerate(rows, 1):
        name = row.full_name or row.email.split("@")[0]
        entries.append(
            LeaderboardEntry(
                rank=rank,
                user_id=str(row.user_id),
                user_name=name,
                mcqs_solved=row.mcqs_solved or 0,
                tests_taken=row.tests_taken,
            )
        )

    # ── Previous month #1 ──────────────────────────────────────────────────
    prev_winner: PreviousMonthWinner | None = None
    prev_rows = (await db.execute(_build_top_query(prev_start, prev_end, 1))).all()
    if prev_rows:
        prev_row = prev_rows[0]
        prev_name = prev_row.full_name or prev_row.email.split("@")[0]
        prev_winner = PreviousMonthWinner(
            user_id=str(prev_row.user_id),
            user_name=prev_name,
            mcqs_solved=prev_row.mcqs_solved or 0,
            month_label=prev_start.strftime("%B %Y"),
        )

    return LeaderboardResponse(
        entries=entries,
        updated_at=datetime.now(timezone.utc).isoformat(),
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
        period_label=period_start.strftime("%B %Y"),
        previous_winner=prev_winner,
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


# ── Acknowledgments (admin-managed people on Contact page) ──────────────────

@router.get("/acknowledgments", response_model=list[AcknowledgmentRead])
async def list_acknowledgments(db: AsyncSession = Depends(get_db_session)):
    rows = (await db.execute(
        select(Acknowledgment).order_by(Acknowledgment.display_order, Acknowledgment.id)
    )).scalars().all()
    return rows


@router.post("/acknowledgments", response_model=AcknowledgmentRead, status_code=status.HTTP_201_CREATED)
async def create_acknowledgment(
    payload: AcknowledgmentCreate,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    row = Acknowledgment(name=payload.name, link_url=payload.link_url, display_order=payload.display_order)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/acknowledgments/{ack_id}", response_model=AcknowledgmentRead)
async def update_acknowledgment(
    ack_id: int,
    payload: AcknowledgmentUpdate,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    row = (await db.execute(select(Acknowledgment).where(Acknowledgment.id == ack_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Acknowledgment not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/acknowledgments/{ack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_acknowledgment(
    ack_id: int,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    row = (await db.execute(select(Acknowledgment).where(Acknowledgment.id == ack_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Acknowledgment not found")
    await db.delete(row)
    await db.commit()


@router.post("/acknowledgments/{ack_id}/image", response_model=AcknowledgmentRead)
async def upload_acknowledgment_image(
    ack_id: int,
    file: UploadFile = File(...),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    row = (await db.execute(select(Acknowledgment).where(Acknowledgment.id == ack_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Acknowledgment not found")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB.")
    ext = (file.filename or "img.png").rsplit(".", 1)[-1]
    safe_name = f"ack_{uuid.uuid4().hex[:12]}.{ext}"
    key = f"visuals/{safe_name}"
    image_url = await async_upload_bytes(content, key, file.content_type)
    row.image_url = image_url
    await db.commit()
    await db.refresh(row)
    return row
