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


@router.get("/categories", response_model=list[USATCategoryRead])
async def list_usat_categories() -> list[USATCategoryRead]:
    return [
        USATCategoryRead(code=code, title=meta["title"], description=meta["description"])
        for code, meta in USAT_CATEGORIES.items()
    ]


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

    # Only pro users (or admins) can see past papers
    user_is_pro = current_user is not None and is_user_pro(current_user)

    return SubjectBulkData(
        subject=SubjectRead.model_validate(matched),
        chapters=[TopicRead.model_validate(t) for t in chapters_q.scalars().all()],
        papers=[PastPaperRead.model_validate(p) for p in papers_q.scalars().all()] if user_is_pro else [],
        tips=[TipRead.model_validate(t) for t in tips_q.scalars().all()],
        resources=[SubjectResourceRead.model_validate(r) for r in resources_q.scalars().all()],
        user_notes=[UserNoteRead.model_validate(n) for n in notes_q.scalars().all()],
    )


@router.get("/{category}/subjects", response_model=list[SubjectRead])
async def list_usat_category_subjects(
    category: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[SubjectRead]:
    normalized_category = _validate_category(category)
    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.ilike(normalized_category))
        .order_by(Subject.id.asc())
    )

    return [SubjectRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects", response_model=list[SubjectRead])
async def list_all_usat_subjects(db: AsyncSession = Depends(get_db_session)) -> list[SubjectRead]:
    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.in_(list(USAT_CATEGORIES.keys())))
        .order_by(Subject.exam_type.asc(), Subject.id.asc())
    )
    return [SubjectRead.model_validate(item) for item in result.scalars().all()]


@router.get("/all-topics", response_model=list[TopicRead])
async def list_all_topics(db: AsyncSession = Depends(get_db_session)) -> list[TopicRead]:
    """Return every topic (chapter) across all USAT subjects in one request."""
    result = await db.execute(
        select(Topic)
        .join(Subject, Topic.subject_id == Subject.id)
        .where(Subject.exam_type.in_(list(USAT_CATEGORIES.keys())))
        .order_by(Topic.subject_id.asc(), Topic.created_at.desc())
    )
    return [TopicRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects/{subject_id}/chapters", response_model=list[TopicRead])
async def list_subject_chapters(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[TopicRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.id.asc())
    )
    return [TopicRead.model_validate(item) for item in result.scalars().all()]


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
    """
    normalized_category = _validate_category(category)

    # Resolve subject IDs to filter on
    if subject_ids:
        try:
            ids = [int(s.strip()) for s in subject_ids.split(",") if s.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="subject_ids must be comma-separated integers")
        # Verify they belong to the stated category
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

    topic_subq = select(Topic.id).where(Topic.subject_id.in_(valid_ids)).scalar_subquery()
    result = await db.execute(
        select(MCQ)
        .where(MCQ.topic_id.in_(topic_subq))
        .order_by(func.random())
        .limit(limit)
    )
    mcqs = []
    for m in result.scalars().all():
        mcq = MCQRead.model_validate(m)
        sid = topic_subj_map.get(m.topic_id)
        mcq.subject_name = subj_name_map.get(sid) if sid else None
        mcqs.append(mcq)
    return mcqs


@router.get("/subjects/{subject_id}/practice-mcqs", response_model=list[MCQRead])
async def list_subject_practice_mcqs(
    subject_id: int,
    limit: int = Query(default=20, ge=1, le=75),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "practice")),
) -> list[MCQRead]:
    """Return random MCQs across all chapters of a subject (for Practice mode)."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic_subq = select(Topic.id).where(Topic.subject_id == subject_id).scalar_subquery()
    result = await db.execute(
        select(MCQ)
        .where(MCQ.topic_id.in_(topic_subq))
        .order_by(func.random())
        .limit(limit)
    )
    return [MCQRead.model_validate(m) for m in result.scalars().all()]


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

