import csv
import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.services.supabase_storage import upload_bytes, make_key
from app.db.models import MCQ, Material, Note, PastPaper, Resource, Subject, SubjectResource, Tip, Topic, User
from app.db.session import get_db_session
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
)

router = APIRouter(prefix="/admin", tags=["admin-content"])
settings = get_settings()

USAT_SEED_BLUEPRINT = [
    {
        "exam_type": "USAT-E",
        "subjects": [
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
        "subjects": [
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
        "subjects": [
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
        "subjects": [
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
        "subjects": [
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

                question = f"USAT sample MCQ: key concept from {topic_title}?"
                mcq_result = await db.execute(select(MCQ).where(MCQ.topic_id == topic.id, MCQ.question == question))
                if not mcq_result.scalars().first():
                    db.add(
                        MCQ(
                            question=question,
                            option_a="Core principle",
                            option_b="Secondary detail",
                            option_c="Unrelated statement",
                            option_d="Partially correct statement",
                            correct_answer="A",
                            explanation=f"The core principle is the most accurate answer for {topic_title}.",
                            topic_id=topic.id,
                        )
                    )
                    created_mcqs += 1

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
        final_content = upload_bytes(file_bytes, key, file.content_type)

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
        public_path = upload_bytes(content, key, file.content_type)
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
        file_path = upload_bytes(file_bytes, key, file.content_type)

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

MCQ_CSV_REQUIRED_COLUMNS = {"question", "option_a", "option_b", "option_c", "option_d", "correct_answer"}
MCQ_CSV_VALID_ANSWERS = {"A", "B", "C", "D"}


@router.post("/mcqs/upload-csv", status_code=status.HTTP_200_OK)
async def upload_mcq_csv(
    topic_id: int = Form(...),
    file: UploadFile = File(...),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bulk-upload MCQs from a CSV file.

    Expected CSV columns (case-insensitive):
        question, option_a, option_b, option_c, option_d, correct_answer, explanation (optional)
    """
    chapter = await db.get(Topic, topic_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    filename = file.filename or "mcqs.csv"
    is_csv = filename.lower().endswith(".csv") or (file.content_type or "").lower() in (
        "text/csv",
        "application/csv",
        "text/plain",
    )
    if not is_csv:
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    raw_bytes = await file.read()
    max_bytes = 10 * 1024 * 1024  # 10 MB max for CSV
    if len(raw_bytes) > max_bytes:
        raise HTTPException(status_code=400, detail="CSV file too large (max 10 MB)")

    try:
        text_content = raw_bytes.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text_content = raw_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no header row")

    normalized_fields = {f.strip().lower() for f in reader.fieldnames}
    missing_cols = MCQ_CSV_REQUIRED_COLUMNS - normalized_fields
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(sorted(missing_cols))}",
        )

    mcqs_to_insert: list[MCQ] = []
    skipped = 0
    row_num = 1

    for row in reader:
        row_num += 1
        # Normalize keys
        normalized_row = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        question = normalized_row.get("question", "")
        option_a = normalized_row.get("option_a", "")
        option_b = normalized_row.get("option_b", "")
        option_c = normalized_row.get("option_c", "")
        option_d = normalized_row.get("option_d", "")
        correct_answer = normalized_row.get("correct_answer", "").upper()
        explanation = normalized_row.get("explanation", "") or "See answer above."

        if not all([question, option_a, option_b, option_c, option_d]):
            skipped += 1
            continue

        if correct_answer not in MCQ_CSV_VALID_ANSWERS:
            skipped += 1
            continue

        mcqs_to_insert.append(
            MCQ(
                question=question,
                option_a=option_a,
                option_b=option_b,
                option_c=option_c,
                option_d=option_d,
                correct_answer=correct_answer,
                explanation=explanation,
                topic_id=topic_id,
            )
        )

    if not mcqs_to_insert:
        raise HTTPException(status_code=400, detail="No valid MCQ rows found in CSV")

    db.add_all(mcqs_to_insert)
    await db.commit()

    return {
        "created": len(mcqs_to_insert),
        "skipped": skipped,
        "total_rows": row_num - 1,
        "chapter_id": topic_id,
    }
