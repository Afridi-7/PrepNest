import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt as jose_jwt
from sqlalchemy import func, select, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user, rate_limit
from app.core.config import get_settings
from app.db.models import MCQ, Acknowledgment, ContactInfo, MockTest, PracticeResult, Subject, Topic, User
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.services.cache_service import cache_service
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

_oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


async def _get_optional_user(
    token: Optional[str] = Depends(_oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db_session),
) -> Optional[User]:
    """Return current user if a valid token is present, else None."""
    if not token:
        return None
    settings = get_settings()
    try:
        payload = jose_jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub", "")
        if not user_id:
            return None
    except JWTError:
        return None
    return await db.get(User, user_id)


# ── Dashboard stats ──────────────────────────────────────────────────────────

_DASH_TTL = 45  # seconds — short enough to feel fresh, long enough to absorb stampedes


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "dash_stats")),
):
    cache_key = f"dash:{current_user.id}"
    cached = await cache_service.get_json(cache_key)
    if cached:
        return DashboardStats(**cached)

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

    result = DashboardStats(
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
    await cache_service.set_json(cache_key, result.model_dump(mode="json"), ttl_seconds=_DASH_TTL)
    return result


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
    current_user: Optional[User] = Depends(_get_optional_user),
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

    # ── Global parts: top 10 + previous winner ────────────────────────────
    # These are identical for every viewer in the same minute, so we cache
    # the heavy aggregation under a month-stamped key with a short TTL. The
    # period rolls over naturally on the 1st of every month because the
    # cache key includes ``period_start.strftime("%Y%m")``.
    period_key = period_start.strftime("%Y%m")
    cache_key = f"dashboard:leaderboard:global:{period_key}"
    cached_global = await cache_service.get_json(cache_key)

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

    if cached_global is not None:
        entries = [LeaderboardEntry(**e) for e in cached_global.get("entries", [])]
        prev_winner_dict = cached_global.get("previous_winner")
        prev_winner: PreviousMonthWinner | None = (
            PreviousMonthWinner(**prev_winner_dict) if prev_winner_dict else None
        )
    else:
        rows = (await db.execute(_build_top_query(period_start, period_end, 10))).all()

        entries = []
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

        prev_winner = None
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

        # 60 s TTL: short enough that practice rows show up quickly while still
        # absorbing large request bursts onto a single computation per minute.
        await cache_service.set_json(
            cache_key,
            {
                "entries": [e.model_dump(mode="json") for e in entries],
                "previous_winner": (
                    prev_winner.model_dump(mode="json") if prev_winner else None
                ),
            },
            ttl_seconds=60,
        )

    # ── Authed user's rank (if any) ────────────────────────────────────────
    # Computed in O(1) via a single COUNT(*) WHERE score > my_score, instead
    # of fetching the full ranked set and scanning it in Python.
    # Cached per-user with the same 60 s TTL as the global board so repeated
    # dashboard visits don't re-run 5 DB queries every time.
    my_rank: int | None = None
    my_entry: LeaderboardEntry | None = None
    if current_user is not None:
        user_rank_key = f"dashboard:leaderboard:user:{current_user.id}:{period_key}"
        cached_rank = await cache_service.get_json(user_rank_key)
        if cached_rank is not None:
            my_rank = cached_rank.get("my_rank")
            my_entry_dict = cached_rank.get("my_entry")
            my_entry = LeaderboardEntry(**my_entry_dict) if my_entry_dict else None
        else:
            # A dedicated, simpler scoring query for the current user. Reusing
            # _build_top_query's subquery machinery here would need materializing
            # the full ranked set; a direct aggregation is clearer and correct.
            mock_user_score = (
                select(func.coalesce(func.sum(mcq_score_expr), 0))
                .where(
                    MockTest.status == "evaluated",
                    MockTest.user_id == current_user.id,
                    MockTest.created_at >= period_start,
                    MockTest.created_at < period_end,
                )
                .scalar_subquery()
            )
            practice_user_score = (
                select(func.coalesce(func.sum(PracticeResult.correct_answers), 0))
                .where(
                    PracticeResult.user_id == current_user.id,
                    PracticeResult.created_at >= period_start,
                    PracticeResult.created_at < period_end,
                )
                .scalar_subquery()
            )
            mock_user_sessions = (
                select(func.count(MockTest.id))
                .where(
                    MockTest.status == "evaluated",
                    MockTest.user_id == current_user.id,
                    MockTest.created_at >= period_start,
                    MockTest.created_at < period_end,
                )
                .scalar_subquery()
            )
            practice_user_sessions = (
                select(func.count(PracticeResult.id))
                .where(
                    PracticeResult.user_id == current_user.id,
                    PracticeResult.created_at >= period_start,
                    PracticeResult.created_at < period_end,
                )
                .scalar_subquery()
            )
            my_score_row = (
                await db.execute(
                    select(
                        (mock_user_score + practice_user_score).label("score"),
                        (mock_user_sessions + practice_user_sessions).label("sessions"),
                    )
                )
            ).one()
            my_score = int(my_score_row.score or 0)
            my_sessions = int(my_score_row.sessions or 0)

            if my_score > 0:
                # Count users with strictly higher score → rank = that count + 1.
                ahead_subq = _build_top_query(period_start, period_end, 10_000).subquery()
                ahead_count = (
                    await db.execute(
                        select(func.count()).select_from(ahead_subq).where(
                            ahead_subq.c.mcqs_solved > my_score
                        )
                    )
                ).scalar_one()
                my_rank = int(ahead_count) + 1
                my_entry = LeaderboardEntry(
                    rank=my_rank,
                    user_id=str(current_user.id),
                    user_name=(current_user.full_name or current_user.email.split("@")[0]),
                    mcqs_solved=my_score,
                    tests_taken=my_sessions,
                )

            await cache_service.set_json(
                user_rank_key,
                {
                    "my_rank": my_rank,
                    "my_entry": my_entry.model_dump(mode="json") if my_entry else None,
                },
                ttl_seconds=60,
            )

    return LeaderboardResponse(
        entries=entries,
        updated_at=datetime.now(timezone.utc).isoformat(),
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
        period_label=period_start.strftime("%B %Y"),
        previous_winner=prev_winner,
        my_rank=my_rank,
        my_entry=my_entry,
    )


# ── Contact info (singleton row) ────────────────────────────────────────────

# Cache keys for contact + acknowledgments. Both are admin-edited so we
# explicitly invalidate from every write path. 1 h TTL is a backstop in
# case an invalidation is somehow missed (e.g. a future write path that
# forgets to call ``cache_service.delete``).
_CONTACT_CACHE_KEY = "dashboard:contact"
_ACK_CACHE_KEY = "dashboard:acknowledgments"
_CONTENT_CACHE_TTL = 3600


async def _invalidate_contact_cache() -> None:
    await cache_service.delete(_CONTACT_CACHE_KEY)


async def _invalidate_ack_cache() -> None:
    await cache_service.delete(_ACK_CACHE_KEY)


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
    cached = await cache_service.get_json(_CONTACT_CACHE_KEY)
    if cached is not None:
        return ContactInfoRead.model_validate(cached)
    row = await _get_or_create_contact(db)
    payload = ContactInfoRead.model_validate(row)
    await cache_service.set_json(
        _CONTACT_CACHE_KEY, payload.model_dump(mode="json"), ttl_seconds=_CONTENT_CACHE_TTL
    )
    return payload


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
    await _invalidate_contact_cache()
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
    await _invalidate_contact_cache()
    return row


# ── Acknowledgments (admin-managed people on Contact page) ──────────────────

@router.get("/acknowledgments", response_model=list[AcknowledgmentRead])
async def list_acknowledgments(db: AsyncSession = Depends(get_db_session)):
    cached = await cache_service.get_json(_ACK_CACHE_KEY)
    if cached is not None:
        return [AcknowledgmentRead.model_validate(item) for item in cached]
    rows = (await db.execute(
        select(Acknowledgment).order_by(Acknowledgment.display_order, Acknowledgment.id)
    )).scalars().all()
    payload = [AcknowledgmentRead.model_validate(r) for r in rows]
    await cache_service.set_json(
        _ACK_CACHE_KEY,
        [p.model_dump(mode="json") for p in payload],
        ttl_seconds=_CONTENT_CACHE_TTL,
    )
    return payload


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
    await _invalidate_ack_cache()
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
    await _invalidate_ack_cache()
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
    await _invalidate_ack_cache()


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
    await _invalidate_ack_cache()
    return row
