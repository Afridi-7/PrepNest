import random
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import daily_quota, get_current_user, rate_limit, is_user_pro
from app.core.config import get_settings
from app.services.cache_service import cache_service
from app.db.models import MCQ, EssayPrompt, Material, Note, PastPaper, Resource, Subject, SubjectResource, Tip, Topic, UserNote
from app.db.session import get_db_session
from app.models import User
from app.services.supabase_storage import async_upload_bytes, make_key
from app.schemas.content import (
    MCQRead,
    MaterialRead,
    NoteRead,
    PastPaperRead,
    PracticeResultCreate,
    ResourceRead,
    SubjectBulkData,
    SubjectRead,
    SubjectResourceRead,
    TipRead,
    TopicRead,
    USATCategoryRead,
    UserNoteRead,
)

router = APIRouter(prefix="/usat", tags=["usat"])

USAT_CATEGORIES: dict[str, dict[str, str]] = {
    "USAT-E": {"title": "Pre-Engineering", "description": "Physics, Mathematics, Chemistry"},
    "USAT-M": {"title": "Pre-Medical", "description": "Biology, Chemistry, Physics"},
    "USAT-CS": {"title": "Computer Science", "description": "Math, Physics, Computer Science"},
    "USAT-GS": {"title": "General Science", "description": "Mathematics, Statistics, Economics"},
    "USAT-A": {"title": "Arts & Humanities", "description": "Islamiat/Ethics, Pakistan Studies, General Knowledge"},
    "USAT-COM": {"title": "Commerce", "description": "Accounting, Commerce, Economics"},
}


_CATEGORIES_CACHE_KEY = "usat:categories"
_CATEGORIES_TTL = 3600  # 1 h — pure in-memory constant, no DB


@router.get("/categories", response_model=list[USATCategoryRead])
async def list_usat_categories() -> list[USATCategoryRead]:
    cached = await cache_service.get_json(_CATEGORIES_CACHE_KEY)
    if cached is not None:
        return [USATCategoryRead(**item) for item in cached]
    data = [
        USATCategoryRead(code=code, title=meta["title"], description=meta["description"])
        for code, meta in USAT_CATEGORIES.items()
    ]
    await cache_service.set_json(
        _CATEGORIES_CACHE_KEY,
        [item.model_dump(mode="json") for item in data],
        ttl_seconds=_CATEGORIES_TTL,
    )
    return data


import asyncio
import re

from jose import JWTError, jwt as jose_jwt

_oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


async def get_optional_user(
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
    user = await db.get(User, user_id)
    return user

def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


_VALID_CATEGORIES = frozenset(USAT_CATEGORIES.keys())


def _validate_category(category: str) -> str:
    """Normalize and validate a USAT category code."""
    normalized = category.strip().upper()
    if normalized not in _VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    return normalized


@router.get("/{category}/subject-by-slug/{slug}/bulk", response_model=SubjectBulkData)
async def get_subject_bulk_data(
    category: str,
    slug: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_optional_user),
) -> SubjectBulkData:
    """Return subject + chapters + papers + tips + resources + user-notes in ONE request."""
    normalized_category = _validate_category(category)

    # ── Cache layer ──────────────────────────────────────────────────────
    # The "static" portion (subject + chapters + tips + resources) and the
    # "papers" portion are cached separately because past papers are gated
    # by Pro status. user-notes are also per-user-but-shared-by-subject
    # (admin-uploaded community notes), so we cache them with the static
    # block. Without this every navigation to a subject page ran 5 SQL
    # queries — the dominant source of "ages to load" complaints.
    static_key = f"usat:bulk:{normalized_category}:{slug}:static"
    papers_key = f"usat:bulk:{normalized_category}:{slug}:papers"

    user_is_pro = current_user is not None and is_user_pro(current_user)

    cached_static = await cache_service.get_json(static_key)
    cached_papers = (
        await cache_service.get_json(papers_key) if user_is_pro else None
    )
    if cached_static is not None and (not user_is_pro or cached_papers is not None):
        return SubjectBulkData(
            subject=SubjectRead(**cached_static["subject"]),
            chapters=[TopicRead(**t) for t in cached_static["chapters"]],
            papers=[PastPaperRead(**p) for p in (cached_papers or [])] if user_is_pro else [],
            tips=[TipRead(**t) for t in cached_static["tips"]],
            resources=[SubjectResourceRead(**r) for r in cached_static["resources"]],
            user_notes=[UserNoteRead(**n) for n in cached_static["user_notes"]],
        )

    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.ilike(normalized_category))
    )
    subjects = result.scalars().all()
    matched = next((s for s in subjects if _slugify(s.name) == slug), None)
    if not matched:
        raise HTTPException(status_code=404, detail="Subject not found")

    sid = matched.id
    chapters_q, papers_q, tips_q, resources_q, notes_q = await asyncio.gather(
        db.execute(select(Topic).where(Topic.subject_id == sid).order_by(Topic.id.asc())),
        db.execute(select(PastPaper).where(PastPaper.subject_id == sid).order_by(PastPaper.created_at.desc())),
        db.execute(select(Tip).where(Tip.subject_id == sid).order_by(Tip.created_at.desc())),
        db.execute(select(SubjectResource).where(SubjectResource.subject_id == sid).order_by(SubjectResource.created_at.desc())),
        db.execute(select(UserNote).where(UserNote.subject_id == sid).order_by(UserNote.created_at.desc())),
    )

    subject_payload = SubjectRead.model_validate(matched)
    chapters_payload = [TopicRead.model_validate(t) for t in chapters_q.scalars().all()]
    papers_payload = [PastPaperRead.model_validate(p) for p in papers_q.scalars().all()]
    tips_payload = [TipRead.model_validate(t) for t in tips_q.scalars().all()]
    resources_payload = [SubjectResourceRead.model_validate(r) for r in resources_q.scalars().all()]
    notes_payload = [UserNoteRead.model_validate(n) for n in notes_q.scalars().all()]

    # Persist to cache (5 min TTL — content is admin-managed and updates are
    # invalidated explicitly on writes via _invalidate_subject_bulk_cache).
    await cache_service.set_json(
        static_key,
        {
            "subject": subject_payload.model_dump(mode="json"),
            "chapters": [c.model_dump(mode="json") for c in chapters_payload],
            "tips": [t.model_dump(mode="json") for t in tips_payload],
            "resources": [r.model_dump(mode="json") for r in resources_payload],
            "user_notes": [n.model_dump(mode="json") for n in notes_payload],
        },
        ttl_seconds=_BULK_CACHE_TTL,
    )
    await cache_service.set_json(
        papers_key,
        [p.model_dump(mode="json") for p in papers_payload],
        ttl_seconds=_BULK_CACHE_TTL,
    )

    return SubjectBulkData(
        subject=subject_payload,
        chapters=chapters_payload,
        papers=papers_payload if user_is_pro else [],
        tips=tips_payload,
        resources=resources_payload,
        user_notes=notes_payload,
    )


_BULK_CACHE_TTL = 300  # 5 min


async def _invalidate_subject_bulk_cache(category: str, slug: str) -> None:
    """Drop the cached bulk payload after a write (chapter/tip/paper/etc)."""
    try:
        await cache_service.delete(f"usat:bulk:{category}:{slug}:static")
        await cache_service.delete(f"usat:bulk:{category}:{slug}:papers")
    except Exception:
        # Cache invalidation must never break a write path.
        pass


_CATEGORY_SUBJECTS_TTL = 300  # 5 min — rarely changes


@router.get("/{category}/subjects", response_model=list[SubjectRead])
async def list_usat_category_subjects(
    category: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[SubjectRead]:
    normalized_category = _validate_category(category)
    cache_key = f"usat:subjects:{normalized_category}"
    cached = await cache_service.get_json(cache_key)
    if cached is not None:
        return [SubjectRead(**item) for item in cached]
    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.ilike(normalized_category))
        .order_by(Subject.id.asc())
    )
    data = [SubjectRead.model_validate(item) for item in result.scalars().all()]
    await cache_service.set_json(
        cache_key,
        [item.model_dump(mode="json") for item in data],
        ttl_seconds=_CATEGORY_SUBJECTS_TTL,
    )
    return data


_ALL_SUBJECTS_CACHE_KEY = "usat:all_subjects"


@router.get("/subjects", response_model=list[SubjectRead])
async def list_all_usat_subjects(db: AsyncSession = Depends(get_db_session)) -> list[SubjectRead]:
    cached = await cache_service.get_json(_ALL_SUBJECTS_CACHE_KEY)
    if cached is not None:
        return [SubjectRead(**item) for item in cached]
    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.in_(list(USAT_CATEGORIES.keys())))
        .order_by(Subject.exam_type.asc(), Subject.id.asc())
    )
    data = [SubjectRead.model_validate(item) for item in result.scalars().all()]
    await cache_service.set_json(
        _ALL_SUBJECTS_CACHE_KEY,
        [item.model_dump(mode="json") for item in data],
        ttl_seconds=_CATEGORY_SUBJECTS_TTL,
    )
    return data


_ALL_TOPICS_CACHE_KEY = "usat:all_topics"


@router.get("/all-topics", response_model=list[TopicRead])
async def list_all_topics(db: AsyncSession = Depends(get_db_session)) -> list[TopicRead]:
    """Return every topic (chapter) across all USAT subjects in one request."""
    cached = await cache_service.get_json(_ALL_TOPICS_CACHE_KEY)
    if cached is not None:
        return [TopicRead(**item) for item in cached]
    result = await db.execute(
        select(Topic)
        .join(Subject, Topic.subject_id == Subject.id)
        .where(Subject.exam_type.in_(list(USAT_CATEGORIES.keys())))
        .order_by(Topic.subject_id.asc(), Topic.created_at.desc())
    )
    data = [TopicRead.model_validate(item) for item in result.scalars().all()]
    await cache_service.set_json(
        _ALL_TOPICS_CACHE_KEY,
        [item.model_dump(mode="json") for item in data],
        ttl_seconds=_CATEGORY_SUBJECTS_TTL,
    )
    return data


@router.get("/subjects/{subject_id}/chapters", response_model=list[TopicRead])
async def list_subject_chapters(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[TopicRead]:
    cache_key = f"usat:chapters:{subject_id}"
    cached = await cache_service.get_json(cache_key)
    if cached is not None:
        return [TopicRead(**item) for item in cached]
    # Verify subject exists while fetching chapters in one query
    result = await db.execute(
        select(Topic)
        .join(Subject, Subject.id == Topic.subject_id)
        .where(Topic.subject_id == subject_id)
        .order_by(Topic.id.asc())
    )
    rows = result.scalars().all()
    # Confirm the subject exists (rows can be empty for a valid subject with no topics)
    subject_check = await db.execute(select(Subject.id).where(Subject.id == subject_id))
    if subject_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    data = [TopicRead.model_validate(item) for item in rows]
    await cache_service.set_json(
        cache_key,
        [item.model_dump(mode="json") for item in data],
        ttl_seconds=_CATEGORY_SUBJECTS_TTL,
    )
    return data


@router.get("/chapters/{chapter_id}/materials", response_model=list[MaterialRead])
async def list_chapter_materials(chapter_id: int, db: AsyncSession = Depends(get_db_session)) -> list[MaterialRead]:
    chapter = await db.get(Topic, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    result = await db.execute(
        select(Material).where(Material.topic_id == chapter_id).order_by(Material.created_at.desc())
    )
    return [MaterialRead.model_validate(item) for item in result.scalars().all()]


@router.get("/chapters/{chapter_id}/mcqs", response_model=list[MCQRead])
async def list_chapter_mcqs(
    chapter_id: int,
    limit: int = Query(default=20, ge=1, le=20),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
) -> list[MCQRead]:
    chapter = await db.get(Topic, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    result = await db.execute(
        select(MCQ)
        .where(MCQ.topic_id == chapter_id)
        .order_by(MCQ.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return [MCQRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects/{subject_id}/materials", response_model=list[MaterialRead])
async def list_subject_materials(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[MaterialRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(Material)
        .join(Topic, Topic.id == Material.topic_id)
        .where(Topic.subject_id == subject_id, Material.type == "notes")
        .order_by(Material.created_at.desc())
    )
    return [MaterialRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects/{subject_id}/past-papers", response_model=list[MaterialRead])
async def list_subject_past_papers(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[MaterialRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(Material)
        .join(Topic, Topic.id == Material.topic_id)
        .where(Topic.subject_id == subject_id, Material.type == "past_paper")
        .order_by(Material.created_at.desc())
    )
    return [MaterialRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects/{subject_id}/tips", response_model=list[TipRead])
async def list_subject_tips(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[TipRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(select(Tip).where(Tip.subject_id == subject_id).order_by(Tip.created_at.desc()))
    return [TipRead.model_validate(item) for item in result.scalars().all()]


# ── New dedicated endpoints (Resource / Note / PastPaper tables) ─────────────

@router.get("/chapters/{chapter_id}/resources", response_model=list[ResourceRead])
async def list_chapter_resources(
    chapter_id: int, db: AsyncSession = Depends(get_db_session)
) -> list[ResourceRead]:
    chapter = await db.get(Topic, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    result = await db.execute(
        select(Resource).where(Resource.chapter_id == chapter_id).order_by(Resource.created_at.desc())
    )
    return [ResourceRead.model_validate(r) for r in result.scalars().all()]


@router.get("/subjects/{subject_id}/resources", response_model=list[SubjectResourceRead])
async def list_subject_resources(
    subject_id: int, db: AsyncSession = Depends(get_db_session)
) -> list[SubjectResourceRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(SubjectResource).where(SubjectResource.subject_id == subject_id).order_by(SubjectResource.created_at.desc())
    )
    return [SubjectResourceRead.model_validate(r) for r in result.scalars().all()]


@router.get("/subjects/{subject_id}/notes", response_model=list[NoteRead])
async def list_subject_notes(
    subject_id: int, db: AsyncSession = Depends(get_db_session)
) -> list[NoteRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(Note)
        .where(Note.subject_id == subject_id, Note.chapter_id.is_(None))
        .order_by(Note.created_at.desc())
    )
    return [NoteRead.model_validate(n) for n in result.scalars().all()]


@router.get("/chapters/{chapter_id}/notes", response_model=list[NoteRead])
async def list_chapter_notes(
    chapter_id: int, db: AsyncSession = Depends(get_db_session)
) -> list[NoteRead]:
    chapter = await db.get(Topic, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    result = await db.execute(
        select(Note).where(Note.chapter_id == chapter_id).order_by(Note.created_at.desc())
    )
    return [NoteRead.model_validate(n) for n in result.scalars().all()]


@router.get("/subjects/{subject_id}/papers", response_model=list[PastPaperRead])
async def list_subject_papers(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[PastPaperRead]:
    if not is_user_pro(current_user):
        raise HTTPException(status_code=403, detail="Past papers require a Pro subscription.")
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(PastPaper).where(PastPaper.subject_id == subject_id).order_by(PastPaper.created_at.desc())
    )
    return [PastPaperRead.model_validate(p) for p in result.scalars().all()]


@router.get("/{category}/practice-mcqs", response_model=list[MCQRead])
async def list_category_practice_mcqs(
    category: str,
    limit: int = Query(default=20, ge=1, le=75),
    subject_ids: str | None = Query(default=None, description="Comma-separated subject IDs to filter"),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "practice")),
) -> list[MCQRead]:
    """Return random MCQs for an entire category or specific subjects within it.

    - If `subject_ids` is provided, only MCQs from those subjects are included.
    - Otherwise, MCQs from ALL subjects in the category are returned.
    One request replaces N per-subject calls from the frontend.
    Uses a fast two-step random selection (fetch IDs → shuffle → fetch rows)
    to avoid the full-table sort that ORDER BY random() causes on large pools.
    """
    normalized_category = _validate_category(category)

    # Resolve subject IDs to filter on
    if subject_ids:
        try:
            ids = [int(s.strip()) for s in subject_ids.split(",") if s.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="subject_ids must be comma-separated integers")
        result = await db.execute(
            select(Subject.id).where(Subject.exam_type == normalized_category, Subject.id.in_(ids))
        )
        valid_ids = [row[0] for row in result.all()]
        if not valid_ids:
            return []
    else:
        result = await db.execute(
            select(Subject.id).where(Subject.exam_type == normalized_category)
        )
        valid_ids = [row[0] for row in result.all()]
        if not valid_ids:
            return []

    # Build topic_id → subject_name map for response enrichment
    subj_result = await db.execute(
        select(Subject.id, Subject.name).where(Subject.id.in_(valid_ids))
    )
    subj_name_map: dict[int, str] = {row[0]: row[1] for row in subj_result.all()}

    topic_result = await db.execute(
        select(Topic.id, Topic.subject_id).where(Topic.subject_id.in_(valid_ids))
    )
    topic_subj_map: dict[int, int] = {row[0]: row[1] for row in topic_result.all()}

    # Fast random selection: fetch only IDs (index-only), shuffle in Python,
    # then fetch the chosen rows by primary key. Avoids ORDER BY random() which
    # forces a full sequential scan + sort on large MCQ tables.
    topic_ids = list(topic_subj_map.keys())
    if not topic_ids:
        return []

    id_rows = await db.execute(
        select(MCQ.id).where(MCQ.topic_id.in_(topic_ids))
    )
    all_ids = [r[0] for r in id_rows.all()]
    if not all_ids:
        return []
    random.shuffle(all_ids)
    chosen_ids = all_ids[:limit]

    result = await db.execute(
        select(MCQ).where(MCQ.id.in_(chosen_ids))
    )
    mcqs = []
    for m in result.scalars().all():
        mcq = MCQRead.model_validate(m)
        sid = topic_subj_map.get(m.topic_id)
        mcq.subject_name = subj_name_map.get(sid) if sid else None
        mcqs.append(mcq)
    random.shuffle(mcqs)  # re-shuffle since IN clause returns in arbitrary order
    return mcqs


@router.get("/subjects/{subject_id}/practice-mcqs", response_model=list[MCQRead])
async def list_subject_practice_mcqs(
    subject_id: int,
    limit: int = Query(default=20, ge=1, le=75),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "practice")),
) -> list[MCQRead]:
    """Return random MCQs across all chapters of a subject (for Practice mode).
    Uses fast ID-shuffle approach to avoid ORDER BY random() table scan.
    """
    topic_ids_q = await db.execute(
        select(Topic.id).where(Topic.subject_id == subject_id)
    )
    topic_ids = [r[0] for r in topic_ids_q.all()]
    if not topic_ids:
        # subject either doesn't exist or has no topics
        subject_check = await db.execute(select(Subject.id).where(Subject.id == subject_id))
        if subject_check.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Subject not found")
        return []

    id_rows = await db.execute(
        select(MCQ.id).where(MCQ.topic_id.in_(topic_ids))
    )
    all_ids = [r[0] for r in id_rows.all()]
    if not all_ids:
        return []
    random.shuffle(all_ids)
    chosen_ids = all_ids[:limit]

    result = await db.execute(
        select(MCQ).where(MCQ.id.in_(chosen_ids))
    )
    mcqs = list(result.scalars().all())
    random.shuffle(mcqs)
    return [MCQRead.model_validate(m) for m in mcqs]


# ── Practice result submission ───────────────────────────────────────────────

@router.get("/practice-status", response_model=dict)
async def get_practice_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Return how many practice tests the user has taken today and their pro status."""
    from app.db.models import PracticeResult
    from datetime import datetime, timezone

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count_result = await db.execute(
        select(func.count()).select_from(PracticeResult).where(
            PracticeResult.user_id == current_user.id,
            PracticeResult.created_at >= today_start,
        )
    )
    today_count = count_result.scalar() or 0
    return {
        "tests_today": today_count,
        "is_pro": is_user_pro(current_user),
    }


@router.post("/practice-results", status_code=201)
async def submit_practice_result(
    payload: PracticeResultCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Persist a completed practice quiz result for leaderboard tracking."""
    from app.db.models import PracticeResult
    from datetime import datetime, timezone

    if payload.correct_answers > payload.total_questions:
        raise HTTPException(status_code=422, detail="correct_answers cannot exceed total_questions")

    # Free users: max 1 practice test per day, max 10 MCQs per test
    if not is_user_pro(current_user):
        if payload.total_questions > 10:
            raise HTTPException(status_code=403, detail="Free users can only take tests with up to 10 MCQs. Upgrade to Pro for more!")
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        count_result = await db.execute(
            select(func.count()).select_from(PracticeResult).where(
                PracticeResult.user_id == current_user.id,
                PracticeResult.created_at >= today_start,
            )
        )
        today_count = count_result.scalar() or 0
        if today_count >= 1:
            raise HTTPException(status_code=403, detail="Free users can take only 1 practice test per day. Upgrade to Pro for unlimited!")

    row = PracticeResult(
        user_id=current_user.id,
        total_questions=payload.total_questions,
        correct_answers=payload.correct_answers,
        category=payload.category,
        subject_name=payload.subject_name,
    )
    db.add(row)
    await db.commit()
    await cache_service.delete(f"dash:{current_user.id}")
    return {"ok": True}


# ── User-uploaded PDF Notes ──────────────────────────────────────────────────

settings = get_settings()


@router.post("/subjects/{subject_id}/user-notes", response_model=UserNoteRead, status_code=201)
async def upload_user_note(
    subject_id: int,
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(30, "upload")),
) -> UserNoteRead:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    filename = file.filename or "note.pdf"
    is_pdf = filename.lower().endswith(".pdf") or (file.content_type or "").lower() == "application/pdf"
    if not is_pdf:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_bytes = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.max_upload_size_mb} MB")

    key = make_key(f"user_notes/{current_user.id}/{subject_id}", filename)
    try:
        stored_path = await async_upload_bytes(file_bytes, key, file.content_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"File upload failed: {exc}")

    user_note = UserNote(
        title=title,
        file_path=stored_path,
        subject_id=subject_id,
        user_id=current_user.id,
    )
    db.add(user_note)
    await db.commit()
    await db.refresh(user_note)
    return UserNoteRead.model_validate(user_note)


@router.get("/subjects/{subject_id}/user-notes", response_model=list[UserNoteRead])
async def list_user_notes(
    subject_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> list[UserNoteRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(UserNote)
        .where(UserNote.subject_id == subject_id)
        .order_by(UserNote.created_at.desc())
    )
    return [UserNoteRead.model_validate(n) for n in result.scalars().all()]


@router.delete("/user-notes/{note_id}", status_code=204)
async def delete_user_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    note = await db.get(UserNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    # IDOR check: only the owner or an admin can delete
    if note.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")
    await db.delete(note)
    await db.commit()


@router.get("/user-notes/{note_id}/view")
async def view_user_note_pdf(
    note_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "pdf_view")),
):
    """Serve the PDF inline (view-only). Auth via ?token= query param so iframes work."""
    from app.core.security import decode_access_token
    from fastapi.responses import RedirectResponse

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    note = await db.get(UserNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # If stored as a Supabase/external URL, redirect to it
    if note.file_path.startswith("http://") or note.file_path.startswith("https://"):
        return RedirectResponse(
            url=note.file_path,
            headers={"Referrer-Policy": "no-referrer"},
        )

    # Resolve absolute path from stored relative path
    relative = note.file_path.lstrip("/")
    if relative.startswith("uploads/"):
        relative = relative[len("uploads/"):]
    abs_path = settings.upload_dir_path / relative

    if not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(abs_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/user-notes/{note_id}/url")
async def get_user_note_url(
    note_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "pdf_url")),
):
    """Return the direct PDF URL as JSON so the frontend can skip the 307 redirect.

    Auth is still enforced via ?token= query param — identical to /view.
    """
    from app.core.security import decode_access_token

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    note = await db.get(UserNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # External (Supabase) URL — return directly
    if note.file_path.startswith("http://") or note.file_path.startswith("https://"):
        return {"url": note.file_path}

    # Local file — fall back to the /view redirect endpoint
    return {"url": f"/api/usat/user-notes/{note_id}/view?token={token}"}


# ── Essay Practice ───────────────────────────────────────────────────────────

@router.get("/essay-prompts/random")
async def get_random_essay_prompt(
    essay_type: str = Query(..., description="argumentative or narrative"),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "essay_prompt")),
):
    """Return a random essay prompt of the given type."""
    if essay_type not in ("argumentative", "narrative"):
        raise HTTPException(status_code=400, detail="essay_type must be 'argumentative' or 'narrative'")

    result = await db.execute(
        select(EssayPrompt)
        .where(EssayPrompt.essay_type == essay_type)
        .order_by(func.random())
        .limit(1)
    )
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="No essay prompts found for this type")

    return {
        "id": prompt.id,
        "essay_type": prompt.essay_type,
        "prompt_text": prompt.prompt_text,
        "max_score": 15.0 if essay_type == "argumentative" else 10.0,
    }


@router.post("/essay-evaluate")
async def evaluate_essay(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(20, "essay_eval")),
    _q=Depends(daily_quota(50, "essay_eval")),
):
    """Evaluate a standalone essay submission with AI.

    Expects: { essay_type, prompt_text, user_essay }
    Returns: { score, max_score, feedback }
    """
    essay_type = payload.get("essay_type", "")
    prompt_text = payload.get("prompt_text", "")
    user_essay = payload.get("user_essay", "")

    if essay_type not in ("argumentative", "narrative"):
        raise HTTPException(status_code=400, detail="essay_type must be 'argumentative' or 'narrative'")
    if not prompt_text.strip():
        raise HTTPException(status_code=400, detail="prompt_text is required")
    if not user_essay.strip():
        raise HTTPException(status_code=400, detail="user_essay is required")

    max_score = 15.0 if essay_type == "argumentative" else 10.0

    from app.services.mock_test_service import _evaluate_essay_with_ai
    score, feedback = await _evaluate_essay_with_ai(essay_type, prompt_text, user_essay, max_score)

    return {
        "score": score,
        "max_score": max_score,
        "feedback": feedback,
        "essay_type": essay_type,
    }

