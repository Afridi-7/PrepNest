import csv
import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.services.supabase_storage import async_upload_bytes, make_key
from app.db.models import MCQ, Material, Note, PastPaper, Resource, Subject, SubjectResource, Tip, Topic, User, EssayPrompt
from app.db.session import get_db_session
from app.db.repositories.user_repo import UserRepository
from app.schemas.content import (
    MCQCreate,
    MCQRead,
    MCQUpdate,
    MaterialCreate,
    MaterialRead,
    MaterialUpdate,
    NoteCreate,
    NoteRead,
    PastPaperCreate,
    PastPaperRead,
    ResourceCreate,
    ResourceRead,
    ResourceUpdate,
    SubjectCreate,
    SubjectRead,
    SubjectResourceCreate,
    SubjectResourceRead,
    SubjectUpdate,
    TipCreate,
    TipRead,
    TopicCreate,
    TopicRead,
    TopicUpdate,
    EssayPromptCreate,
    EssayPromptRead,
)

router = APIRouter(prefix="/admin", tags=["admin-content"])
settings = get_settings()

# Subjects shared across every USAT category (for mock tests)
_COMMON_SUBJECTS = [
    {
        "name": "Verbal Reasoning",
        "topics": ["General"],
        "tips": ["Read passages carefully and eliminate obviously wrong options first."],
    },
    {
        "name": "Quantitative Reasoning",
        "topics": ["General"],
        "tips": ["Practice mental math shortcuts and estimation techniques."],
    },
    {
        "name": "Argumentative Essay",
        "topics": ["General"],
        "tips": ["Structure your essay: clear thesis, supporting arguments, counter-argument, conclusion."],
    },
    {
        "name": "Narrative Essay",
        "topics": ["General"],
        "tips": ["Use vivid descriptions and a clear story arc with beginning, middle, and end."],
    },
]

USAT_SEED_BLUEPRINT = [
    {
        "exam_type": "USAT-E",
        "subjects": _COMMON_SUBJECTS + [
            {
                "name": "Physics",
                "topics": ["Mechanics", "Waves & Optics", "Thermodynamics"],
                "tips": ["Always draw force diagrams before solving numerical MCQs."],
            },
            {
                "name": "Mathematics",
                "topics": ["Algebra", "Trigonometry", "Coordinate Geometry"],
                "tips": ["Keep a formula sheet and revise identities daily for speed."],
            },
            {
                "name": "Chemistry",
                "topics": ["Stoichiometry", "Organic Chemistry", "Chemical Equilibrium"],
                "tips": ["Memorize reaction trends by grouping compounds, not isolated facts."],
            },
        ],
    },
    {
        "exam_type": "USAT-M",
        "subjects": _COMMON_SUBJECTS + [
            {
                "name": "Biology",
                "topics": ["Cell Biology", "Genetics", "Human Physiology"],
                "tips": ["Use active recall with diagrams for body systems and pathways."],
            },
            {
                "name": "Chemistry",
                "topics": ["Organic Chemistry", "Biochemistry", "Chemical Bonding"],
                "tips": ["Practice conversions and molarity questions under time pressure."],
            },
            {
                "name": "Physics",
                "topics": ["Kinematics", "Electricity", "Modern Physics"],
                "tips": ["Solve at least 15 mixed-concept MCQs every day."],
            },
        ],
    },
    {
        "exam_type": "USAT-CS",
        "subjects": _COMMON_SUBJECTS + [
            {
                "name": "Mathematics",
                "topics": ["Functions", "Probability", "Discrete Basics"],
                "tips": ["Prioritize pattern recognition for sequence and logic questions."],
            },
            {
                "name": "Physics",
                "topics": ["Motion", "Current Electricity", "Electromagnetism"],
                "tips": ["Track units at each step to avoid elimination mistakes."],
            },
            {
                "name": "Computer Science",
                "topics": ["Programming Fundamentals", "Data Representation", "Problem Solving"],
                "tips": ["Convert word problems into step-by-step pseudo-code first."],
            },
        ],
    },
    {
        "exam_type": "USAT-GS",
        "subjects": _COMMON_SUBJECTS + [
            {
                "name": "Mathematics",
                "topics": ["Arithmetic", "Algebra", "Word Problems"],
                "tips": ["Use approximation to quickly eliminate impossible options."],
            },
            {
                "name": "Physics",
                "topics": ["Basic Mechanics", "Heat & Temperature", "Light"],
                "tips": ["Focus on conceptual understanding before formula memorization."],
            },
            {
                "name": "Statistics / Economics",
                "topics": ["Descriptive Statistics", "Graphs", "Basic Economics"],
                "tips": ["Interpret charts first, then compute only what is necessary."],
            },
        ],
    },
    {
        "exam_type": "USAT-A",
        "subjects": _COMMON_SUBJECTS + [
            {
                "name": "General Knowledge",
                "topics": ["Current Affairs", "World Facts", "Pakistani Institutions"],
                "tips": ["Read reliable summaries daily and maintain a fact notebook."],
            },
            {
                "name": "Pakistan Studies",
                "topics": ["Pakistan Movement", "Constitutional Development", "Geography"],
                "tips": ["Build timeline charts for historical and constitutional events."],
            },
            {
                "name": "Islamic Studies",
                "topics": ["Seerah", "Quranic Studies", "Islamic Civilization"],
                "tips": ["Revise themes and references in short, consistent sessions."],
            },
        ],
    },
]


async def _seed_usat_blueprint(db: AsyncSession) -> dict:
    created_subjects = 0
    created_topics = 0
    created_materials = 0
    created_mcqs = 0
    created_tips = 0
    created_past_papers = 0

    for category in USAT_SEED_BLUEPRINT:
        exam_type = category["exam_type"]
        for subject_entry in category["subjects"]:
            subject_name = subject_entry["name"]
            subject_result = await db.execute(
                select(Subject).where(Subject.name == subject_name, Subject.exam_type == exam_type)
            )
            subject = subject_result.scalars().first()
            if not subject:
                subject = Subject(name=subject_name, exam_type=exam_type)
                db.add(subject)
                await db.flush()
                created_subjects += 1

            topic_result = await db.execute(
                select(Topic).where(Topic.subject_id == subject.id, Topic.title == "Past Papers")
            )
            past_paper_topic = topic_result.scalars().first()
            if not past_paper_topic:
                past_paper_topic = Topic(subject_id=subject.id, title="Past Papers")
                db.add(past_paper_topic)
                await db.flush()
                created_topics += 1

            for year in [2023, 2024]:
                past_paper_title = f"{subject.name} Past Paper {year}"
                past_paper_result = await db.execute(
                    select(Material).where(
                        Material.topic_id == past_paper_topic.id,
                        Material.type == "past_paper",
                        Material.title == past_paper_title,
                    )
                )
                if not past_paper_result.scalars().first():
                    db.add(
                        Material(
                            title=past_paper_title,
                            content=f"Past paper resource and solution outline for {subject.name} ({year}).",
                            type="past_paper",
                            topic_id=past_paper_topic.id,
                        )
                    )
                    created_past_papers += 1

            for topic_title in subject_entry["topics"]:
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
                            content=f"Structured revision notes for {topic_title} in {subject.name} ({exam_type}).",
                            type="notes",
                            topic_id=topic.id,
                        )
                    )
                    created_materials += 1

                # No placeholder MCQs — real MCQs are uploaded via CSV

            for tip_text in subject_entry.get("tips", []):
                tip_result = await db.execute(
                    select(Tip).where(Tip.subject_id == subject.id, Tip.title == "Study Tip")
                )
                existing_tip = tip_result.scalars().first()
                if not existing_tip:
                    db.add(Tip(title="Study Tip", content=tip_text, subject_id=subject.id))
                    created_tips += 1

    await db.commit()

    return {
        "created_subjects": created_subjects,
        "created_topics": created_topics,
        "created_materials": created_materials,
        "created_mcqs": created_mcqs,
        "created_tips": created_tips,
        "created_past_papers": created_past_papers,
    }


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


@router.post("/past-papers", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
async def create_past_paper(
    subject_id: int = Form(...),
    year: int = Form(...),
    title: str | None = Form(default=None),
    content: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> MaterialRead:
    payload = PastPaperCreate(
        subject_id=subject_id,
        year=year,
        title=title,
        content=content,
    )

    subject = await db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic_result = await db.execute(
        select(Topic).where(Topic.subject_id == payload.subject_id, Topic.title == "Past Papers")
    )
    topic = topic_result.scalars().first()
    if not topic:
        topic = Topic(title="Past Papers", subject_id=payload.subject_id)
        db.add(topic)
        await db.flush()

    final_content = payload.content
    if file is not None:
        filename = file.filename or f"past-paper-{payload.year}.pdf"
        is_pdf = filename.lower().endswith(".pdf") or (file.content_type or "").lower() == "application/pdf"
        if not is_pdf:
            raise HTTPException(status_code=400, detail="Only PDF files are allowed for past papers")

        file_bytes = await file.read()
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size is {settings.max_upload_size_mb} MB",
            )

        key = make_key(f"past_papers/{payload.subject_id}", filename)
        try:
            final_content = await async_upload_bytes(file_bytes, key, file.content_type)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"File upload failed: {exc}")

    if not final_content:
        raise HTTPException(status_code=400, detail="Either content or file is required")

    final_title = payload.title or f"{subject.name} Past Paper {payload.year}"
    material = Material(
        title=final_title,
        content=final_content,
        type="past_paper",
        topic_id=topic.id,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return MaterialRead.model_validate(material)


@router.post("/tips", response_model=TipRead, status_code=status.HTTP_201_CREATED)
async def create_tip(
    payload: TipCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> TipRead:
    subject = await db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    tip = Tip(title=payload.title, content=payload.content, subject_id=payload.subject_id)
    db.add(tip)
    await db.commit()
    await db.refresh(tip)
    return TipRead.model_validate(tip)


@router.delete("/tips/{tip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tip(
    tip_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    tip = await db.get(Tip, tip_id)
    if not tip:
        raise HTTPException(status_code=404, detail="Tip not found")
    await db.delete(tip)
    await db.commit()


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

    existing_result = await db.execute(
        select(MCQ).where(MCQ.topic_id == payload.topic_id, MCQ.question == payload.question)
    )
    existing_mcq = existing_result.scalars().first()
    if existing_mcq:
        return MCQRead.model_validate(existing_mcq)

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

        key = make_key(f"content/{topic_id}", filename)
        try:
            public_path = await async_upload_bytes(content, key, file.content_type)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"File upload failed ({filename}): {exc}")
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
    return await _seed_usat_blueprint(db)


@router.post("/seed-usat", status_code=status.HTTP_200_OK)
async def seed_usat_content(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await _seed_usat_blueprint(db)


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


@router.delete("/purge-placeholder-mcqs", status_code=status.HTTP_200_OK)
async def purge_placeholder_mcqs(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Delete all auto-generated placeholder MCQs created by the seed function."""
    result = await db.execute(
        delete(MCQ).where(MCQ.question.like("USAT sample MCQ: key concept from %"))
    )
    await db.commit()
    return {"deleted": result.rowcount}


# ── Resource CRUD ─────────────────────────────────────────────────────────────

@router.post("/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
async def create_resource(
    payload: ResourceCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> ResourceRead:
    chapter = await db.get(Topic, payload.chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    resource = Resource(title=payload.title, url=payload.url, chapter_id=payload.chapter_id)
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return ResourceRead.model_validate(resource)


@router.patch("/resources/{resource_id}", response_model=ResourceRead)
async def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> ResourceRead:
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(resource, key, value)
    await db.commit()
    await db.refresh(resource)
    return ResourceRead.model_validate(resource)


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    await db.delete(resource)
    await db.commit()


# ── Subject Resource CRUD ─────────────────────────────────────────────────────

@router.post("/subject-resources", response_model=SubjectResourceRead, status_code=status.HTTP_201_CREATED)
async def create_subject_resource(
    payload: SubjectResourceCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> SubjectResourceRead:
    subject = await db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    resource = SubjectResource(title=payload.title, url=payload.url, subject_id=payload.subject_id)
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return SubjectResourceRead.model_validate(resource)


@router.delete("/subject-resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject_resource(
    resource_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    resource = await db.get(SubjectResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Subject resource not found")
    await db.delete(resource)
    await db.commit()


# ── Note CRUD ─────────────────────────────────────────────────────────────────

@router.post("/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> NoteRead:
    if payload.subject_id is None and payload.chapter_id is None:
        raise HTTPException(status_code=400, detail="Either subject_id or chapter_id is required")

    if payload.subject_id is not None:
        subject = await db.get(Subject, payload.subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")

    if payload.chapter_id is not None:
        chapter = await db.get(Topic, payload.chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")

    note = Note(
        title=payload.title,
        content=payload.content,
        subject_id=payload.subject_id,
        chapter_id=payload.chapter_id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteRead.model_validate(note)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()


# ── PastPaper CRUD (new dedicated table) ─────────────────────────────────────

@router.post("/papers", response_model=PastPaperRead, status_code=status.HTTP_201_CREATED)
async def create_paper(
    subject_id: int = Form(...),
    title: str = Form(...),
    chapter_id: int | None = Form(default=None),
    url: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> PastPaperRead:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if chapter_id is not None:
        chapter = await db.get(Topic, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")

    file_path: str | None = url

    if file is not None:
        filename = file.filename or "past-paper.pdf"
        is_pdf = filename.lower().endswith(".pdf") or (file.content_type or "").lower() == "application/pdf"
        if not is_pdf:
            raise HTTPException(status_code=400, detail="Only PDF files are allowed for past papers")

        file_bytes = await file.read()
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size is {settings.max_upload_size_mb} MB",
            )

        key = make_key(f"papers/{subject_id}", filename)
        try:
            file_path = await async_upload_bytes(file_bytes, key, file.content_type)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"File upload failed: {exc}")

    if not file_path:
        raise HTTPException(status_code=400, detail="Either a PDF file or a URL is required")

    paper = PastPaper(
        title=title,
        file_path=file_path,
        subject_id=subject_id,
        chapter_id=chapter_id,
    )
    db.add(paper)
    await db.commit()
    await db.refresh(paper)
    return PastPaperRead.model_validate(paper)


@router.delete("/papers/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_paper(
    paper_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    paper = await db.get(PastPaper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Past paper not found")
    await db.delete(paper)
    await db.commit()


# ── MCQ CSV Bulk Upload ───────────────────────────────────────────────────────

MCQ_CSV_REQUIRED_COLUMNS = {"question", "option1", "option2", "option3", "option4", "correct_answer", "subject", "chapter"}
MCQ_CSV_VALID_ANSWERS = {"A", "B", "C", "D"}
ALL_USAT_EXAM_TYPES = ["USAT-E", "USAT-M", "USAT-CS", "USAT-GS", "USAT-A"]

# Aliases: maps alternate column names -> canonical name
MCQ_COLUMN_ALIASES: dict[str, str] = {
    "question_text": "question",
    "question text": "question",
    "sentence": "question",
    "stem": "question",
    "q": "question",
    "option_1": "option1",
    "option_2": "option2",
    "option_3": "option3",
    "option_4": "option4",
    "opt1": "option1",
    "opt2": "option2",
    "opt3": "option3",
    "opt4": "option4",
    "a": "option1",
    "b": "option2",
    "c": "option3",
    "d": "option4",
    "choice_a": "option1",
    "choice_b": "option2",
    "choice_c": "option3",
    "choice_d": "option4",
    "answer": "correct_answer",
    "correct": "correct_answer",
    "key": "correct_answer",
    "ans": "correct_answer",
    "topic": "chapter",
    "chapter_name": "chapter",
    "chapter name": "chapter",
    "unit": "chapter",
    "section": "chapter",
    "category": "subject",
    "subject_name": "subject",
    "sub": "subject",
    "exp": "explanation",
    "explain": "explanation",
    "rationale": "explanation",
    "reasoning": "explanation",
}


@router.post("/mcqs/upload-csv", status_code=status.HTTP_200_OK)
async def upload_mcq_csv(
    file: UploadFile = File(...),
    exam_type: str = Form("USAT-E"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bulk-upload MCQs from a CSV file.

    Expected CSV columns (case-insensitive):
        question, option1, option2, option3, option4, correct_answer, subject, chapter, explanation (optional)

    Subjects and chapters are auto-resolved (created if they don't exist).
    """
    filename = file.filename or "mcqs.csv"
    is_csv = filename.lower().endswith(".csv") or (file.content_type or "").lower() in (
        "text/csv",
        "application/csv",
        "text/plain",
    )
    if not is_csv:
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    raw_bytes = await file.read()
    max_bytes = 100 * 1024 * 1024  # 100 MB max for CSV
    if len(raw_bytes) > max_bytes:
        raise HTTPException(status_code=400, detail="CSV file too large (max 100 MB)")

    try:
        text_content = raw_bytes.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text_content = raw_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no header row")

    # Build a mapping from original field name -> canonical name (applying aliases)
    field_map: dict[str, str] = {}
    for raw_field in reader.fieldnames:
        normalized = raw_field.strip().lower()
        canonical = MCQ_COLUMN_ALIASES.get(normalized, normalized)
        field_map[raw_field] = canonical

    canonical_fields = set(field_map.values())
    missing_cols = MCQ_CSV_REQUIRED_COLUMNS - canonical_fields
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(sorted(missing_cols))}. "
                   f"Found columns: {', '.join(sorted(canonical_fields))}",
        )

    # Determine which exam types to target
    exam_type_normalized = exam_type.strip().upper()
    _VALID_UPLOAD_TYPES = frozenset(ALL_USAT_EXAM_TYPES)
    if exam_type_normalized not in _VALID_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid exam_type '{exam_type}'. Must be one of: {', '.join(sorted(_VALID_UPLOAD_TYPES))}")
    target_exam_types = [exam_type_normalized]

    # Cache resolved subjects & chapters per exam_type to avoid repeated DB lookups
    subject_cache: dict[tuple[str, str], Subject] = {}  # (exam_type, subject_name_lower) -> Subject
    topic_cache: dict[tuple[int, str], Topic] = {}  # (subject_id, chapter_title_lower) -> Topic

    async def resolve_topic_for(subject_name: str, chapter_title: str, et: str) -> int:
        """Return topic_id for the given exam_type, creating subject/topic if needed."""
        s_key = (et, subject_name.lower())
        if s_key not in subject_cache:
            result = await db.execute(
                select(Subject).where(
                    Subject.name.ilike(subject_name),
                    Subject.exam_type == et,
                )
            )
            subject = result.scalars().first()
            if not subject:
                subject = Subject(name=subject_name.strip(), exam_type=et)
                db.add(subject)
                await db.flush()
            subject_cache[s_key] = subject

        subj = subject_cache[s_key]
        t_key = (subj.id, chapter_title.lower())
        if t_key not in topic_cache:
            result = await db.execute(
                select(Topic).where(
                    Topic.subject_id == subj.id,
                    Topic.title.ilike(chapter_title),
                )
            )
            topic = result.scalars().first()
            if not topic:
                topic = Topic(title=chapter_title.strip(), subject_id=subj.id)
                db.add(topic)
                await db.flush()
            topic_cache[t_key] = topic

        return topic_cache[t_key].id

    mcqs_to_insert: list[MCQ] = []
    skipped = 0
    row_num = 1

    for row in reader:
        row_num += 1
        # Normalize keys using field_map (applies aliases to canonical names)
        normalized_row: dict[str, str] = {}
        for raw_key, val in row.items():
            canonical_key = field_map.get(raw_key, raw_key.strip().lower())
            # Keep the last value if there are collisions after aliasing
            normalized_row[canonical_key] = (val or "").strip()

        question = normalized_row.get("question", "")
        option1 = normalized_row.get("option1", "")
        option2 = normalized_row.get("option2", "")
        option3 = normalized_row.get("option3", "")
        option4 = normalized_row.get("option4", "")
        correct_answer = normalized_row.get("correct_answer", "").upper()
        subject_name = normalized_row.get("subject", "")
        chapter_title = normalized_row.get("chapter", "")
        explanation = normalized_row.get("explanation", "") or "See answer above."

        if not all([question, option1, option2, option3, option4, subject_name, chapter_title]):
            skipped += 1
            continue

        if correct_answer not in MCQ_CSV_VALID_ANSWERS:
            skipped += 1
            continue

        row_added = False
        for et in target_exam_types:
            topic_id = await resolve_topic_for(subject_name, chapter_title, et)

            dup_result = await db.execute(
                select(MCQ).where(MCQ.topic_id == topic_id, MCQ.question == question)
            )
            if dup_result.scalars().first():
                continue

            mcqs_to_insert.append(
                MCQ(
                    question=question,
                    option_a=option1,
                    option_b=option2,
                    option_c=option3,
                    option_d=option4,
                    correct_answer=correct_answer,
                    explanation=explanation,
                    topic_id=topic_id,
                )
            )
            row_added = True

        if not row_added:
            skipped += 1

    if not mcqs_to_insert:
        raise HTTPException(
            status_code=400,
            detail=f"No valid MCQ rows found in CSV. {skipped} row(s) were skipped due to missing fields, invalid answer values, or all duplicates.",
        )

    db.add_all(mcqs_to_insert)
    await db.commit()

    return {
        "created": len(mcqs_to_insert),
        "skipped": skipped,
        "total_rows": row_num - 1,
    }


# ── Essay Prompt CRUD ─────────────────────────────────────────────────────────

ESSAY_CSV_REQUIRED_COLUMNS = {"essay_type", "prompt_text"}
ESSAY_VALID_TYPES = {"argumentative", "narrative"}


@router.post("/essay-prompts", response_model=EssayPromptRead, status_code=status.HTTP_201_CREATED)
async def create_essay_prompt(
    payload: EssayPromptCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> EssayPromptRead:
    prompt = EssayPrompt(
        essay_type=payload.essay_type,
        prompt_text=payload.prompt_text,
        exam_type=payload.exam_type.strip().upper() if payload.exam_type else None,
    )
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    return EssayPromptRead.model_validate(prompt)


@router.get("/essay-prompts", response_model=list[EssayPromptRead])
async def list_essay_prompts(
    essay_type: str | None = None,
    exam_type: str | None = None,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> list[EssayPromptRead]:
    q = select(EssayPrompt).order_by(EssayPrompt.created_at.desc())
    if essay_type:
        q = q.where(EssayPrompt.essay_type == essay_type.lower())
    if exam_type:
        q = q.where(
            (EssayPrompt.exam_type == exam_type.strip().upper()) | (EssayPrompt.exam_type.is_(None))
        )
    result = await db.execute(q)
    return [EssayPromptRead.model_validate(p) for p in result.scalars().all()]


@router.delete("/essay-prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_essay_prompt(
    prompt_id: int,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    prompt = await db.get(EssayPrompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Essay prompt not found")
    await db.delete(prompt)
    await db.commit()


@router.post("/essay-prompts/upload-csv", status_code=status.HTTP_200_OK)
async def upload_essay_csv(
    file: UploadFile = File(...),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bulk-upload essay prompts from a CSV file.

    Expected columns: essay_type, prompt_text, exam_type (optional — leave blank for shared)
    """
    filename = file.filename or "essays.csv"
    is_csv = filename.lower().endswith(".csv") or (file.content_type or "").lower() in (
        "text/csv", "application/csv", "text/plain",
    )
    if not is_csv:
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    raw_bytes = await file.read()
    if len(raw_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="CSV too large (max 10 MB)")

    try:
        text_content = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text_content = raw_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV is empty or has no header row")

    normalized_fields = {f.strip().lower() for f in reader.fieldnames}
    missing = ESSAY_CSV_REQUIRED_COLUMNS - normalized_fields
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(sorted(missing))}")

    prompts: list[EssayPrompt] = []
    skipped = 0
    row_num = 0

    for row in reader:
        row_num += 1
        nr = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        essay_type = nr.get("essay_type", "").lower()
        prompt_text = nr.get("prompt_text", "")
        exam_type = nr.get("exam_type", "").strip().upper() or None

        if essay_type not in ESSAY_VALID_TYPES or len(prompt_text) < 10:
            skipped += 1
            continue

        prompts.append(EssayPrompt(essay_type=essay_type, prompt_text=prompt_text, exam_type=exam_type))

    if not prompts:
        raise HTTPException(status_code=400, detail="No valid essay prompt rows found")

    db.add_all(prompts)
    await db.commit()
    return {"created": len(prompts), "skipped": skipped, "total_rows": row_num}


# ── Temporary: MCQ deduplication ──────────────────────────────────────────────

@router.post("/dedup-mcqs")
async def dedup_mcqs(
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(get_current_admin),
):
    """Delete duplicate MCQs that share the same four options within a topic.
    Keeps the MCQ with the lowest id in each group."""
    result = await db.execute(select(MCQ).order_by(MCQ.id.asc()))
    all_mcqs = result.scalars().all()

    groups: dict[tuple, list] = defaultdict(list)
    for mcq in all_mcqs:
        opts = sorted(
            s.strip().lower()
            for s in (mcq.option_a, mcq.option_b, mcq.option_c, mcq.option_d)
        )
        key = (mcq.topic_id, tuple(opts))
        groups[key].append(mcq)

    to_delete_ids: list[int] = []
    for group in groups.values():
        if len(group) <= 1:
            continue
        dupes = group[1:]
        to_delete_ids.extend(m.id for m in dupes)

    if to_delete_ids:
        await db.execute(delete(MCQ).where(MCQ.id.in_(to_delete_ids)))
        await db.commit()

    return {
        "total_before": len(all_mcqs),
        "duplicates_deleted": len(to_delete_ids),
        "total_after": len(all_mcqs) - len(to_delete_ids),
    }


@router.get("/mcq-stats")
async def mcq_stats(
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(get_current_admin),
):
    from sqlalchemy import func as sa_func
    result = await db.execute(
        select(Subject.name, Topic.title, sa_func.count(MCQ.id))
        .join(Topic, Topic.subject_id == Subject.id)
        .join(MCQ, MCQ.topic_id == Topic.id)
        .group_by(Subject.name, Topic.title)
        .order_by(Subject.name, Topic.title)
    )
    rows = result.all()
    return [{"subject": s, "chapter": c, "mcqs": n} for s, c, n in rows]


# ═══════════════════════════════ GRANT / REVOKE PRO ═══════════════════════════════

from datetime import timedelta, timezone
from app.schemas.user_crud import GrantProByEmailRequest, GrantProResponse, RevokeProByEmailRequest


@router.post("/grant-pro-by-email", response_model=GrantProResponse)
async def grant_pro_by_email(
    body: GrantProByEmailRequest,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> GrantProResponse:
    """Admin-only: grant Pro subscription to a user by email."""
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from datetime import datetime as _dt

    expires_at = _dt.now(timezone.utc) + timedelta(days=body.days)
    await repo.grant_pro(user, expires_at=expires_at, granted_by_admin=True)

    return GrantProResponse(
        email=user.email,
        expires_at=expires_at,
        message=f"Pro access granted for {body.days} days",
    )


@router.post("/revoke-pro-by-email")
async def revoke_pro_by_email(
    body: RevokeProByEmailRequest,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Admin-only: revoke Pro subscription from a user by email."""
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await repo.revoke_pro(user)
    return {"success": True, "email": user.email, "message": "Pro access revoked"}
