from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.models import MCQ, Material, Subject, Topic, User
from app.db.session import get_db_session
from app.schemas.content import (
    MCQCreate,
    MCQRead,
    MaterialCreate,
    MaterialRead,
    SubjectCreate,
    SubjectRead,
    TopicCreate,
    TopicRead,
)

router = APIRouter(prefix="/admin", tags=["admin-content"])


@router.post("/subjects", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
async def create_subject(
    payload: SubjectCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> SubjectRead:
    subject = Subject(name=payload.name, exam_type=payload.exam_type)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return SubjectRead.model_validate(subject)


@router.post("/topics", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
async def create_topic(
    payload: TopicCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> TopicRead:
    subject = await db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic = Topic(title=payload.title, subject_id=payload.subject_id)
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return TopicRead.model_validate(topic)


@router.post("/materials", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
async def create_material(
    payload: MaterialCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> MaterialRead:
    topic = await db.get(Topic, payload.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    material = Material(
        title=payload.title,
        content=payload.content,
        type=payload.type,
        topic_id=payload.topic_id,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return MaterialRead.model_validate(material)


@router.post("/mcqs", response_model=MCQRead, status_code=status.HTTP_201_CREATED)
async def create_mcq(
    payload: MCQCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> MCQRead:
    topic = await db.get(Topic, payload.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    mcq = MCQ(
        question=payload.question,
        option_a=payload.option_a,
        option_b=payload.option_b,
        option_c=payload.option_c,
        option_d=payload.option_d,
        correct_answer=payload.correct_answer,
        explanation=payload.explanation,
        topic_id=payload.topic_id,
    )
    db.add(mcq)
    await db.commit()
    await db.refresh(mcq)
    return MCQRead.model_validate(mcq)
