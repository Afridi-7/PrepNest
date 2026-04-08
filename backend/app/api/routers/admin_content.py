import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.db.models import MCQ, Material, Subject, Topic, User
from app.db.session import get_db_session
from app.schemas.content import (
    MCQCreate,
    MCQRead,
    MCQUpdate,
    MaterialCreate,
    MaterialRead,
    MaterialUpdate,
    SubjectCreate,
    SubjectRead,
    SubjectUpdate,
    TopicCreate,
    TopicRead,
    TopicUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin-content"])
settings = get_settings()

DEMO_SUBJECTS = [
    {
        "name": "English",
        "exam_type": "USAT",
        "topics": ["Reading Comprehension", "Grammar"],
    },
    {
        "name": "Mathematics",
        "exam_type": "USAT",
        "topics": ["Algebra", "Geometry"],
    },
    {
        "name": "Physics",
        "exam_type": "USAT",
        "topics": ["Mechanics", "Thermodynamics"],
    },
    {
        "name": "Chemistry",
        "exam_type": "USAT",
        "topics": ["Organic Chemistry", "Stoichiometry"],
    },
    {
        "name": "Biology",
        "exam_type": "USAT",
        "topics": ["Cell Biology", "Genetics"],
    },
]


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


@router.patch("/subjects/{subject_id}", response_model=SubjectRead)
async def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> SubjectRead:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(subject, key, value)
    await db.commit()
    await db.refresh(subject)
    return SubjectRead.model_validate(subject)


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.delete(subject)
    await db.commit()


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


@router.patch("/topics/{topic_id}", response_model=TopicRead)
async def update_topic(
    topic_id: int,
    payload: TopicUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> TopicRead:
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    updates = payload.model_dump(exclude_unset=True)
    if "subject_id" in updates and updates["subject_id"] is not None:
        subject = await db.get(Subject, updates["subject_id"])
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
    for key, value in updates.items():
        setattr(topic, key, value)
    await db.commit()
    await db.refresh(topic)
    return TopicRead.model_validate(topic)


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    await db.delete(topic)
    await db.commit()


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


@router.patch("/materials/{material_id}", response_model=MaterialRead)
async def update_material(
    material_id: int,
    payload: MaterialUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> MaterialRead:
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    updates = payload.model_dump(exclude_unset=True)
    if "topic_id" in updates and updates["topic_id"] is not None:
        topic = await db.get(Topic, updates["topic_id"])
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
    for key, value in updates.items():
        setattr(material, key, value)
    await db.commit()
    await db.refresh(material)
    return MaterialRead.model_validate(material)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(
    material_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    await db.delete(material)
    await db.commit()


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


@router.patch("/mcqs/{mcq_id}", response_model=MCQRead)
async def update_mcq(
    mcq_id: int,
    payload: MCQUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> MCQRead:
    mcq = await db.get(MCQ, mcq_id)
    if not mcq:
        raise HTTPException(status_code=404, detail="MCQ not found")

    updates = payload.model_dump(exclude_unset=True)
    if "topic_id" in updates and updates["topic_id"] is not None:
        topic = await db.get(Topic, updates["topic_id"])
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
    for key, value in updates.items():
        setattr(mcq, key, value)
    await db.commit()
    await db.refresh(mcq)
    return MCQRead.model_validate(mcq)


@router.delete("/mcqs/{mcq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcq(
    mcq_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    mcq = await db.get(MCQ, mcq_id)
    if not mcq:
        raise HTTPException(status_code=404, detail="MCQ not found")
    await db.delete(mcq)
    await db.commit()


@router.post("/materials/upload-pdfs", response_model=list[MaterialRead], status_code=status.HTTP_201_CREATED)
async def upload_material_pdfs(
    topic_id: int = Form(...),
    files: list[UploadFile] = File(...),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> list[MaterialRead]:
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    created_materials: list[Material] = []
    target_dir = settings.upload_dir_path / "content" / str(topic_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    for file in files:
        filename = file.filename or "document.pdf"
        is_pdf = filename.lower().endswith(".pdf") or (file.content_type or "").lower() == "application/pdf"
        if not is_pdf:
            raise HTTPException(status_code=400, detail=f"Only PDF files are allowed: {filename}")

        content = await file.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({filename}). Max size is {settings.max_upload_size_mb} MB",
            )

        safe_name = f"{uuid.uuid4()}_{Path(filename).name}"
        destination = target_dir / safe_name
        destination.write_bytes(content)

        public_path = f"/uploads/content/{topic_id}/{safe_name}"
        material = Material(
            title=Path(filename).stem,
            content=public_path,
            type="past_paper",
            topic_id=topic_id,
        )
        db.add(material)
        created_materials.append(material)

    await db.commit()
    for material in created_materials:
        await db.refresh(material)

    return [MaterialRead.model_validate(material) for material in created_materials]


@router.post("/seed-demo", status_code=status.HTTP_200_OK)
async def seed_demo_content(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    created_subjects = 0
    created_topics = 0
    created_materials = 0
    created_mcqs = 0

    for entry in DEMO_SUBJECTS:
        subject_result = await db.execute(
            select(Subject).where(Subject.name == entry["name"], Subject.exam_type == entry["exam_type"])
        )
        subject = subject_result.scalars().first()
        if not subject:
            subject = Subject(name=entry["name"], exam_type=entry["exam_type"])
            db.add(subject)
            await db.flush()
            created_subjects += 1

        for topic_title in entry["topics"]:
            topic_result = await db.execute(
                select(Topic).where(Topic.subject_id == subject.id, Topic.title == topic_title)
            )
            topic = topic_result.scalars().first()
            if not topic:
                topic = Topic(subject_id=subject.id, title=topic_title)
                db.add(topic)
                await db.flush()
                created_topics += 1

            material_title = f"{topic_title} Notes"
            material_result = await db.execute(
                select(Material).where(Material.topic_id == topic.id, Material.title == material_title)
            )
            if not material_result.scalars().first():
                db.add(
                    Material(
                        title=material_title,
                        content=f"Core concepts, examples, and revision pointers for {topic_title}.",
                        type="notes",
                        topic_id=topic.id,
                    )
                )
                created_materials += 1

            question = f"Sample MCQ for {topic_title}?"
            mcq_result = await db.execute(select(MCQ).where(MCQ.topic_id == topic.id, MCQ.question == question))
            if not mcq_result.scalars().first():
                db.add(
                    MCQ(
                        question=question,
                        option_a="Option A",
                        option_b="Option B",
                        option_c="Option C",
                        option_d="Option D",
                        correct_answer="A",
                        explanation=f"Sample explanation for {topic_title}.",
                        topic_id=topic.id,
                    )
                )
                created_mcqs += 1

    await db.commit()

    return {
        "created_subjects": created_subjects,
        "created_topics": created_topics,
        "created_materials": created_materials,
        "created_mcqs": created_mcqs,
    }


@router.post("/dedupe-subjects", status_code=status.HTTP_200_OK)
async def dedupe_subjects(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    subject_rows = await db.execute(select(Subject).order_by(Subject.created_at.asc(), Subject.id.asc()))
    subjects = list(subject_rows.scalars().all())

    grouped: dict[tuple[str, str], list[Subject]] = {}
    for subject in subjects:
        key = (subject.name.strip().lower(), subject.exam_type.strip().upper())
        grouped.setdefault(key, []).append(subject)

    removed_subjects = 0
    merged_topics = 0
    moved_materials = 0
    moved_mcqs = 0

    for _, group in grouped.items():
        if len(group) <= 1:
            continue

        keeper = group[0]
        duplicates = group[1:]

        for duplicate in duplicates:
            dup_topics_rows = await db.execute(
                select(Topic).where(Topic.subject_id == duplicate.id).order_by(Topic.created_at.asc(), Topic.id.asc())
            )
            dup_topics = list(dup_topics_rows.scalars().all())

            for dup_topic in dup_topics:
                keeper_topic_row = await db.execute(
                    select(Topic).where(Topic.subject_id == keeper.id, Topic.title == dup_topic.title)
                )
                keeper_topic = keeper_topic_row.scalars().first()

                if not keeper_topic:
                    dup_topic.subject_id = keeper.id
                    merged_topics += 1
                    continue

                mat_rows = await db.execute(select(Material).where(Material.topic_id == dup_topic.id))
                for material in mat_rows.scalars().all():
                    material.topic_id = keeper_topic.id
                    moved_materials += 1

                mcq_rows = await db.execute(select(MCQ).where(MCQ.topic_id == dup_topic.id))
                for mcq in mcq_rows.scalars().all():
                    mcq.topic_id = keeper_topic.id
                    moved_mcqs += 1

                await db.delete(dup_topic)

            await db.delete(duplicate)
            removed_subjects += 1

    await db.commit()

    return {
        "removed_subjects": removed_subjects,
        "merged_topics": merged_topics,
        "moved_materials": moved_materials,
        "moved_mcqs": moved_mcqs,
    }
