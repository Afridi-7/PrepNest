from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MCQ, Material, Subject, Tip, Topic
from app.db.session import get_db_session
from app.schemas.content import MCQRead, MaterialRead, SubjectRead, TipRead, TopicRead

router = APIRouter(tags=["content"])


@router.get("/subjects", response_model=list[SubjectRead])
async def list_subjects(db: AsyncSession = Depends(get_db_session)) -> list[SubjectRead]:
    result = await db.execute(select(Subject).order_by(Subject.created_at.desc()))
    return [SubjectRead.model_validate(item) for item in result.scalars().all()]


@router.get("/subjects/{subject_id}/topics", response_model=list[TopicRead])
async def list_topics(subject_id: int, db: AsyncSession = Depends(get_db_session)) -> list[TopicRead]:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    result = await db.execute(
        select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.created_at.desc())
    )
    return [TopicRead.model_validate(item) for item in result.scalars().all()]


@router.get("/topics/{topic_id}/materials", response_model=list[MaterialRead])
async def list_materials(topic_id: int, db: AsyncSession = Depends(get_db_session)) -> list[MaterialRead]:
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    result = await db.execute(
        select(Material).where(Material.topic_id == topic_id).order_by(Material.created_at.desc())
    )
    return [MaterialRead.model_validate(item) for item in result.scalars().all()]


@router.get("/topics/{topic_id}/mcqs", response_model=list[MCQRead])
async def list_mcqs(topic_id: int, db: AsyncSession = Depends(get_db_session)) -> list[MCQRead]:
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    result = await db.execute(select(MCQ).where(MCQ.topic_id == topic_id).order_by(MCQ.created_at.desc()))
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
