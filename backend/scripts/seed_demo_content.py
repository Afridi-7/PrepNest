import asyncio
from sqlalchemy import select

from app.db.models import MCQ, Material, Subject, Topic
from app.db.session import SessionLocal

SEED_DATA = [
    {
        "name": "English",
        "exam_type": "USAT",
        "topics": [
            {
                "title": "Reading Comprehension",
                "materials": [
                    {"title": "Reading Strategies", "content": "Skimming, scanning, and inference techniques.", "type": "notes"},
                    {"title": "USAT English Past Paper 2024", "content": "Upload PDF from admin panel for this topic.", "type": "past_paper"},
                ],
                "mcqs": [
                    {
                        "question": "What is the main purpose of skimming?",
                        "option_a": "Read every word",
                        "option_b": "Get overall idea quickly",
                        "option_c": "Memorize text",
                        "option_d": "Translate passage",
                        "correct_answer": "B",
                        "explanation": "Skimming is used for fast overall understanding.",
                    }
                ],
            }
        ],
    },
    {
        "name": "Mathematics",
        "exam_type": "USAT",
        "topics": [
            {
                "title": "Algebra",
                "materials": [
                    {"title": "Algebra Fundamentals", "content": "Linear equations, identities, and simplification.", "type": "notes"}
                ],
                "mcqs": [
                    {
                        "question": "If 2x + 5 = 13, x equals?",
                        "option_a": "3",
                        "option_b": "4",
                        "option_c": "5",
                        "option_d": "6",
                        "correct_answer": "B",
                        "explanation": "2x = 8 so x = 4.",
                    }
                ],
            },
            {
                "title": "Geometry",
                "materials": [
                    {"title": "Geometry Quick Notes", "content": "Triangles, circles, and area formulas.", "type": "notes"}
                ],
                "mcqs": [],
            },
        ],
    },
    {
        "name": "Physics",
        "exam_type": "USAT",
        "topics": [
            {
                "title": "Mechanics",
                "materials": [
                    {"title": "Newton Laws Notes", "content": "Forces, acceleration, and momentum.", "type": "notes"}
                ],
                "mcqs": [],
            }
        ],
    },
]


async def seed() -> None:
    async with SessionLocal() as db:
        for subject_data in SEED_DATA:
            subject_result = await db.execute(
                select(Subject).where(
                    Subject.name == subject_data["name"],
                    Subject.exam_type == subject_data["exam_type"],
                )
            )
            subject = subject_result.scalar_one_or_none()
            if not subject:
                subject = Subject(name=subject_data["name"], exam_type=subject_data["exam_type"])
                db.add(subject)
                await db.flush()

            for topic_data in subject_data["topics"]:
                topic_result = await db.execute(
                    select(Topic).where(Topic.title == topic_data["title"], Topic.subject_id == subject.id)
                )
                topic = topic_result.scalar_one_or_none()
                if not topic:
                    topic = Topic(title=topic_data["title"], subject_id=subject.id)
                    db.add(topic)
                    await db.flush()

                for material_data in topic_data["materials"]:
                    material_result = await db.execute(
                        select(Material).where(Material.title == material_data["title"], Material.topic_id == topic.id)
                    )
                    if not material_result.scalar_one_or_none():
                        db.add(
                            Material(
                                title=material_data["title"],
                                content=material_data["content"],
                                type=material_data["type"],
                                topic_id=topic.id,
                            )
                        )

                for mcq_data in topic_data["mcqs"]:
                    mcq_result = await db.execute(
                        select(MCQ).where(MCQ.question == mcq_data["question"], MCQ.topic_id == topic.id)
                    )
                    if not mcq_result.scalar_one_or_none():
                        db.add(MCQ(topic_id=topic.id, **mcq_data))

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
    print("Seed complete")
