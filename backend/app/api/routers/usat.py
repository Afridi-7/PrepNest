from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.models import MCQ, Material, Note, PastPaper, Resource, Subject, Tip, Topic, UserNote
from app.db.session import get_db_session
from app.models import User
from app.schemas.content import (
    MCQRead,
    MaterialRead,
    NoteRead,
    PastPaperRead,
    ResourceRead,
    SubjectRead,
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
    "USAT-GS": {"title": "General Science", "description": "Math, Physics, Statistics / Economics"},
    "USAT-A": {"title": "Arts & Humanities", "description": "General Knowledge, Pakistan Studies, Islamic Studies"},
}


@router.get("/categories", response_model=list[USATCategoryRead])
async def list_usat_categories() -> list[USATCategoryRead]:
    return [
        USATCategoryRead(code=code, title=meta["title"], description=meta["description"])
        for code, meta in USAT_CATEGORIES.items()
    ]


@router.get("/{category}/subjects", response_model=list[SubjectRead])
async def list_usat_category_subjects(
    category: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[SubjectRead]:
    normalized_category = category.strip().upper()
    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.ilike(normalized_category))
        .order_by(Subject.name.asc(), Subject.created_at.desc())
    )

    return [SubjectRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects", response_model=list[SubjectRead])
async def list_all_usat_subjects(db: AsyncSession = Depends(get_db_session)) -> list[SubjectRead]:
    result = await db.execute(
        select(Subject)
        .where(Subject.exam_type.in_(list(USAT_CATEGORIES.keys())))
        .order_by(Subject.exam_type.asc(), Subject.name.asc())
    )
    return [SubjectRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects/{subject_id}/chapters", response_model=list[TopicRead])
async def list_subject_chapters(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[TopicRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.created_at.desc())
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
    limit: int = Query(default=30, ge=1, le=200),
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
    subject_id: int, db: AsyncSession = Depends(get_db_session)
) -> list[PastPaperRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(PastPaper).where(PastPaper.subject_id == subject_id).order_by(PastPaper.created_at.desc())
    )
    return [PastPaperRead.model_validate(p) for p in result.scalars().all()]


@router.get("/subjects/{subject_id}/practice-mcqs", response_model=list[MCQRead])
async def list_subject_practice_mcqs(
    subject_id: int,
    limit: int = Query(default=20, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
) -> list[MCQRead]:
    """Return random MCQs across all chapters of a subject (for Practice mode)."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic_ids_result = await db.execute(select(Topic.id).where(Topic.subject_id == subject_id))
    topic_ids = [row[0] for row in topic_ids_result.fetchall()]
    if not topic_ids:
        return []

    result = await db.execute(
        select(MCQ)
        .where(MCQ.topic_id.in_(topic_ids))
        .order_by(func.random())
        .limit(limit)
    )
    return [MCQRead.model_validate(m) for m in result.scalars().all()]


# ── User-uploaded PDF Notes ──────────────────────────────────────────────────

settings = get_settings()


@router.post("/subjects/{subject_id}/user-notes", response_model=UserNoteRead, status_code=201)
async def upload_user_note(
    subject_id: int,
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserNoteRead:
    if current_user.role != "admin":
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

    target_dir = settings.upload_dir_path / "user_notes" / current_user.id / str(subject_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{Path(filename).name}"
    destination = target_dir / safe_name
    destination.write_bytes(file_bytes)

    stored_path = f"/uploads/user_notes/{current_user.id}/{subject_id}/{safe_name}"

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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    note = await db.get(UserNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()


@router.get("/user-notes/{note_id}/view")
async def view_user_note_pdf(
    note_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
):
    """Serve the PDF inline (view-only). Auth via ?token= query param so iframes work."""
    from app.core.security import decode_access_token

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    note = await db.get(UserNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

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
        headers={"Content-Disposition": "inline"},
    )
