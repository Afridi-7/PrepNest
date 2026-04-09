from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Subject
from app.db.session import get_db_session
from app.schemas.content import SubjectRead, USATCategoryRead

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
