from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MCQ, Material, Note, PastPaper, Resource, Subject, Tip, Topic
from app.db.session import get_db_session
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
