"""Mock test generation and AI evaluation service.

Fetches MCQs + essay prompts per category blueprint, stores interactive
sessions, and evaluates with AI.
"""

from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MCQ, EssayPrompt, MockTest, Subject, Topic
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

# ── Blueprint ────────────────────────────────────────────────────────────────

SCIENCE_SUBJECTS: dict[str, list[str]] = {
    "USAT-E": ["Physics", "Mathematics", "Chemistry"],
    "USAT-M": ["Biology", "Chemistry", "Physics"],
    "USAT-CS": ["Mathematics", "Physics", "Computer Science"],
    "USAT-GS": ["Mathematics", "Physics", "Statistics / Economics"],
    "USAT-A": ["General Knowledge", "Pakistan Studies", "Islamic Studies"],
}

# Section definitions — same structure for every category.
# "__SCIENCE__" is replaced at runtime with the category-specific subjects.
MOCK_SECTIONS: list[dict] = [
    {"type": "mcq", "subject": "Verbal Reasoning", "count": 20, "label": "Section 1 — Verbal Reasoning"},
    {"type": "mcq", "subject": "Quantitative Reasoning", "count": 25, "label": "Section 2 — Quantitative Reasoning"},
    {"type": "mcq", "subject": "__SCIENCE__", "count": 30, "label": "Section 3 — Subject Knowledge"},
    {"type": "essay", "essay_type": "argumentative", "count": 1, "label": "Section 4A — Argumentative Essay"},
    {"type": "essay", "essay_type": "narrative", "count": 1, "label": "Section 4B — Narrative Essay"},
]

# ── Data containers ──────────────────────────────────────────────────────────

@dataclass
class MockSection:
    label: str
    mcqs: list[MCQ] = field(default_factory=list)
    essay_prompts: list[EssayPrompt] = field(default_factory=list)


# ── DB fetch ─────────────────────────────────────────────────────────────────

async def _fetch_mcqs_for_subject(
    db: AsyncSession,
    exam_type: str,
    subject_name: str,
    count: int,
) -> list[MCQ]:
    """Return up to *count* random MCQs for a subject within a category."""
    result = await db.execute(
        select(Subject.id).where(
            Subject.exam_type == exam_type,
            Subject.name.ilike(subject_name),
        )
    )
    subject_ids = [r[0] for r in result.all()]
    if not subject_ids:
        return []

    topic_sub = select(Topic.id).where(Topic.subject_id.in_(subject_ids)).scalar_subquery()
    result = await db.execute(
        select(MCQ)
        .where(MCQ.topic_id.in_(topic_sub))
        .order_by(MCQ.id)  # deterministic; shuffle in Python
    )
    all_mcqs = list(result.scalars().all())
    random.shuffle(all_mcqs)
    return all_mcqs[:count]


async def _fetch_mcqs_for_subjects(
    db: AsyncSession,
    exam_type: str,
    subject_names: list[str],
    count: int,
) -> list[MCQ]:
    """Return up to *count* random MCQs split across multiple subjects."""
    per_subj = max(1, count // len(subject_names))
    remainder = count - per_subj * len(subject_names)
    collected: list[MCQ] = []
    for i, name in enumerate(subject_names):
        n = per_subj + (1 if i < remainder else 0)
        collected.extend(await _fetch_mcqs_for_subject(db, exam_type, name, n))
    random.shuffle(collected)
    return collected[:count]


async def _fetch_essay_prompts(
    db: AsyncSession,
    exam_type: str,
    essay_type: str,
    count: int,
) -> list[EssayPrompt]:
    result = await db.execute(
        select(EssayPrompt).where(
            EssayPrompt.essay_type == essay_type,
            (EssayPrompt.exam_type == exam_type) | (EssayPrompt.exam_type.is_(None)),
        )
    )
    prompts = list(result.scalars().all())
    random.shuffle(prompts)
    return prompts[:count]


# ── Assemble sections ────────────────────────────────────────────────────────

async def build_mock_sections(db: AsyncSession, category: str) -> list[MockSection]:
    """Build all mock-test sections for a given USAT category."""
    science_subjects = SCIENCE_SUBJECTS.get(category, [])
    sections: list[MockSection] = []

    for sec in MOCK_SECTIONS:
        ms = MockSection(label=sec["label"])

        if sec["type"] == "mcq":
            subj = sec["subject"]
            if subj == "__SCIENCE__":
                ms.mcqs = await _fetch_mcqs_for_subjects(db, category, science_subjects, sec["count"])
            else:
                ms.mcqs = await _fetch_mcqs_for_subject(db, category, subj, sec["count"])
        elif sec["type"] == "essay":
            ms.essay_prompts = await _fetch_essay_prompts(db, category, sec["essay_type"], sec["count"])

        sections.append(ms)

    return sections


# ── Interactive mock test generation ─────────────────────────────────────────

def _sections_to_json(sections: list[MockSection]) -> list[dict]:
    """Convert MockSection list to a JSON-serialisable snapshot."""
    result = []
    for sec in sections:
        s: dict = {"label": sec.label}
        if sec.mcqs:
            s["type"] = "mcq"
            s["questions"] = [
                {
                    "id": mcq.id,
                    "question": mcq.question,
                    "options": [mcq.option_a, mcq.option_b, mcq.option_c, mcq.option_d],
                    "correct_answer": mcq.correct_answer,
                    "explanation": mcq.explanation or "",
                    "subject": "",  # filled below
                }
                for mcq in sec.mcqs
            ]
            # Resolve subject names from section label
            label_lower = sec.label.lower()
            subject_name = (
                "Verbal Reasoning" if "verbal" in label_lower
                else "Quantitative Reasoning" if "quantitative" in label_lower
                else "Subject Knowledge"
            )
            for q in s["questions"]:
                q["subject"] = subject_name
        elif sec.essay_prompts:
            s["type"] = "essay"
            s["questions"] = [
                {
                    "id": ep.id,
                    "essay_type": ep.essay_type,
                    "prompt_text": ep.prompt_text,
                }
                for ep in sec.essay_prompts
            ]
        else:
            s["type"] = "empty"
            s["questions"] = []
        result.append(s)
    return result


async def generate_mock_test(
    db: AsyncSession, user_id: str, category: str
) -> MockTest:
    """Generate a new mock test, store the question snapshot, return the record."""
    sections = await build_mock_sections(db, category)
    sections_json = _sections_to_json(sections)

    mock_test = MockTest(
        user_id=user_id,
        category=category,
        sections_json=sections_json,
        status="in_progress",
    )
    db.add(mock_test)
    await db.flush()
    await db.commit()
    await db.refresh(mock_test)
    return mock_test


def format_sections_for_response(mock_test: MockTest) -> list[dict]:
    """Strip correct answers from the stored snapshot for the frontend."""
    clean_sections = []
    for sec in mock_test.sections_json:
        clean = {"label": sec["label"], "type": sec["type"], "questions": []}
        for q in sec.get("questions", []):
            if sec["type"] == "mcq":
                clean["questions"].append({
                    "id": q["id"],
                    "question": q["question"],
                    "options": q["options"],
                    "subject": q.get("subject", ""),
                })
            else:
                clean["questions"].append({
                    "id": q["id"],
                    "essay_type": q["essay_type"],
                    "prompt_text": q["prompt_text"],
                })
        clean_sections.append(clean)
    return clean_sections


# ── Evaluation ───────────────────────────────────────────────────────────────

async def evaluate_mock_test(
    db: AsyncSession, mock_test: MockTest, mcq_answers: dict[str, str], essay_answers: dict[str, str]
) -> dict:
    """Grade MCQs and AI-evaluate essays. Store results and return them."""

    mcq_results = []
    mcq_correct = 0
    mcq_total = 0

    essay_results = []
    essay_score_sum = 0.0
    essay_max_sum = 0.0

    for sec in mock_test.sections_json:
        if sec["type"] == "mcq":
            for q in sec["questions"]:
                qid = str(q["id"])
                mcq_total += 1
                selected = mcq_answers.get(qid)
                correct = q["correct_answer"]
                is_correct = selected is not None and selected.upper() == correct.upper()
                if is_correct:
                    mcq_correct += 1
                mcq_results.append({
                    "question_id": q["id"],
                    "question": q["question"],
                    "subject": q.get("subject", ""),
                    "selected": selected,
                    "correct": correct,
                    "is_correct": is_correct,
                    "explanation": q.get("explanation", ""),
                    "options": q.get("options", []),
                })
        elif sec["type"] == "essay":
            for q in sec["questions"]:
                qid = str(q["id"])
                user_essay = essay_answers.get(qid, "")
                essay_type = q["essay_type"]
                essay_max = 15.0 if essay_type == "argumentative" else 10.0
                essay_max_sum += essay_max
                if not user_essay.strip():
                    essay_results.append({
                        "question_id": q["id"],
                        "essay_type": essay_type,
                        "prompt": q["prompt_text"],
                        "user_answer": "",
                        "score": 0.0,
                        "max_score": essay_max,
                        "feedback": "No response submitted.",
                    })
                    continue

                score, feedback = await _evaluate_essay_with_ai(
                    essay_type, q["prompt_text"], user_essay, essay_max
                )
                essay_score_sum += score
                essay_results.append({
                    "question_id": q["id"],
                    "essay_type": essay_type,
                    "prompt": q["prompt_text"],
                    "user_answer": user_essay,
                    "score": score,
                    "max_score": essay_max,
                    "feedback": feedback,
                })

    total_score = mcq_correct + essay_score_sum
    max_score = mcq_total + essay_max_sum
    percentage = round((total_score / max_score) * 100, 1) if max_score > 0 else 0

    # Generate AI overall summary
    ai_summary = await _generate_mock_test_summary(
        category=mock_test.category,
        mcq_results=mcq_results,
        essay_results=essay_results,
        mcq_correct=mcq_correct,
        mcq_total=mcq_total,
        essay_score_sum=essay_score_sum,
        essay_max_sum=essay_max_sum,
        percentage=percentage,
    )

    result = {
        "mock_test_id": mock_test.id,
        "category": mock_test.category,
        "status": "evaluated",
        "total_score": round(total_score, 1),
        "max_score": round(max_score, 1),
        "percentage": percentage,
        "mcq_score": mcq_correct,
        "mcq_total": mcq_total,
        "essay_score": round(essay_score_sum, 1),
        "essay_total": round(essay_max_sum, 1),
        "mcq_results": mcq_results,
        "essay_results": essay_results,
        "ai_summary": ai_summary,
        "created_at": mock_test.created_at.isoformat() if mock_test.created_at else None,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    mock_test.answers_json = {"mcq": mcq_answers, "essay": essay_answers}
    mock_test.result_json = result
    mock_test.status = "evaluated"
    mock_test.submitted_at = datetime.now(timezone.utc)
    await db.commit()

    return result


async def _generate_mock_test_summary(
    *,
    category: str,
    mcq_results: list[dict],
    essay_results: list[dict],
    mcq_correct: int,
    mcq_total: int,
    essay_score_sum: float,
    essay_max_sum: float,
    percentage: float,
) -> dict | None:
    """Call LLM to produce an overall mock-test performance summary."""

    # Build subject-wise MCQ breakdown
    subject_stats: dict[str, dict] = {}
    for r in mcq_results:
        # Subject is not stored on result; derive from section label via question index
        subj = "General"
        subject_stats.setdefault(subj, {"correct": 0, "total": 0})
        subject_stats[subj]["total"] += 1
        if r["is_correct"]:
            subject_stats[subj]["correct"] += 1

    # Try to get per-subject data from the MCQ results
    # Group by looking at question subjects if available
    subject_stats_clean: dict[str, dict] = {}
    for r in mcq_results:
        subj = r.get("subject", "General")
        if not subj:
            subj = "General"
        subject_stats_clean.setdefault(subj, {"correct": 0, "total": 0})
        subject_stats_clean[subj]["total"] += 1
        if r["is_correct"]:
            subject_stats_clean[subj]["correct"] += 1

    subject_summary = "\n".join(
        f"- {subj}: {s['correct']}/{s['total']} correct ({round(s['correct']/s['total']*100) if s['total'] else 0}%)"
        for subj, s in subject_stats_clean.items()
    )

    essay_summary = "\n".join(
        f"- {e['essay_type'].capitalize()} essay: {e['score']}/{e['max_score']} "
        f"({'skipped' if not e.get('user_answer', '').strip() else 'submitted'})"
        for e in essay_results
    )

    system_prompt = (
        "You are a supportive but honest exam performance analyst for USAT/HAT exam prep. "
        "Given a student's mock test results, produce a helpful summary that identifies strengths, "
        "weaknesses, and gives a concrete study plan.\n\n"
        "Return ONLY valid JSON (no markdown, no code blocks) with this structure:\n"
        "{\n"
        '  "overall_verdict": "<2-3 sentence summary of overall performance>",\n'
        '  "performance_level": "<one of: Excellent, Good, Average, Needs Improvement, Critical>",\n'
        '  "strong_areas": [\n'
        '    {"area": "<subject or skill>", "detail": "<why this is a strength>"}\n'
        "  ],\n"
        '  "weak_areas": [\n'
        '    {"area": "<subject or skill>", "detail": "<what needs improvement and why>"}\n'
        "  ],\n"
        '  "study_plan": [\n'
        '    "<specific actionable recommendation 1>",\n'
        '    "<specific actionable recommendation 2>",\n'
        '    "<specific actionable recommendation 3>"\n'
        "  ],\n"
        '  "motivational_note": "<a short encouraging message>"\n'
        "}\n\n"
        "IMPORTANT:\n"
        "- Identify 2-4 strong areas and 2-4 weak areas based on the data.\n"
        "- Study plan should have 3-5 specific, actionable items.\n"
        "- Be specific: reference actual subjects and scores, not generic advice.\n"
        "- If essay was skipped, mention the importance of attempting it."
    )

    user_prompt = (
        f"Exam category: {category}\n"
        f"Overall score: {percentage}%\n\n"
        f"MCQ Performance ({mcq_correct}/{mcq_total}):\n{subject_summary}\n\n"
        f"Essay Performance ({essay_score_sum}/{essay_max_sum}):\n{essay_summary}\n\n"
        "Analyze and return JSON."
    )

    try:
        raw = await llm_service.complete(
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            temperature=0.4,
        )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(cleaned)
        return {
            "overall_verdict": str(data.get("overall_verdict", "")),
            "performance_level": str(data.get("performance_level", "Average")),
            "strong_areas": data.get("strong_areas", []),
            "weak_areas": data.get("weak_areas", []),
            "study_plan": data.get("study_plan", []),
            "motivational_note": str(data.get("motivational_note", "")),
        }
    except Exception as e:
        logger.warning("AI mock test summary generation failed: %s", e)
        return None


async def _evaluate_essay_with_ai(essay_type: str, prompt_text: str, user_essay: str, max_score: float = 10.0) -> tuple[float, str | dict]:
    """Use LLM to evaluate an essay. Returns (score, feedback).

    feedback is a rich dict with criteria scores, mistakes, and tips.
    Argumentative essays are scored out of 15, narrative out of 10.
    """
    criteria_arg = (
        '    "criteria": [\n'
        '      {"name": "Thesis & Argument Strength", "score": <0-5>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Evidence & Support", "score": <0-3>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Structure & Organization", "score": <0-3>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Language & Grammar", "score": <0-2>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Critical Thinking", "score": <0-2>, "comment": "<1-2 sentences>"}\n'
        "    ]"
    )
    criteria_nar = (
        '    "criteria": [\n'
        '      {"name": "Narrative & Storytelling", "score": <0-3>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Creativity & Imagination", "score": <0-2>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Structure & Flow", "score": <0-2>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Language & Grammar", "score": <0-2>, "comment": "<1-2 sentences>"},\n'
        '      {"name": "Emotional Impact", "score": <0-1>, "comment": "<1-2 sentences>"}\n'
        "    ]"
    )
    criteria_block = criteria_arg if essay_type == "argumentative" else criteria_nar

    system_prompt = (
        "You are an expert USAT/HAT essay examiner. You give brutally honest but encouraging feedback. "
        "Your job is to help students improve by identifying EXACT mistakes and giving actionable advice.\n\n"
        "Return ONLY valid JSON (no markdown, no code blocks) with this structure:\n"
        "{\n"
        f'    "score": <number 0-{max_score}>,\n'
        '    "overall_feedback": "<3-4 sentence overall assessment>",\n'
        f"{criteria_block},\n"
        '    "mistakes": [\n'
        '      {"type": "grammar|spelling|logic|structure|style|vocabulary|coherence", '
        '"quote": "<exact quote from essay>", "issue": "<what is wrong>", "fix": "<how to fix it>"}\n'
        "    ],\n"
        '    "strengths": ["<specific strength 1>", "<specific strength 2>"],\n'
        '    "improvement_tips": ["<actionable tip 1>", "<actionable tip 2>", "<actionable tip 3>"]\n'
        "}\n\n"
        "IMPORTANT:\n"
        "- In 'mistakes', quote the EXACT text from the essay that contains the error (max 15 words per quote).\n"
        "- Include 3-8 mistakes sorted by severity. Cover grammar, spelling, logic, and style issues.\n"
        "- 'strengths' should list 2-4 specific things the student did well.\n"
        "- 'improvement_tips' should give 3-5 concrete, actionable tips for next time.\n"
        "- Criteria scores must sum up to the overall score.\n"
        "- Be specific, not vague. Say 'Your thesis lacks a clear counter-argument' not 'Could be better'."
    )
    user_prompt = (
        f"Essay type: {essay_type}\n"
        f"Maximum score: {max_score}\n\n"
        f"Prompt given to the student:\n\"{prompt_text}\"\n\n"
        f"Student's essay:\n\"\"\"\n{user_essay[:4000]}\n\"\"\"\n\n"
        "Evaluate thoroughly and return JSON."
    )

    try:
        raw = await llm_service.complete(
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            temperature=0.3,
        )
        # Parse JSON from response
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(cleaned)
        score = min(max_score, max(0.0, float(data.get("score", 0))))

        # Build rich feedback dict
        feedback = {
            "overall_feedback": str(data.get("overall_feedback", "Evaluation complete.")),
            "criteria": data.get("criteria", []),
            "mistakes": data.get("mistakes", []),
            "strengths": data.get("strengths", []),
            "improvement_tips": data.get("improvement_tips", []),
        }
        return score, feedback
    except Exception as e:
        logger.warning("AI essay evaluation failed: %s", e)
        # Fallback: give a basic score based on length
        word_count = len(user_essay.split())
        if word_count < 50:
            return round(max_score * 0.2, 1), "Response is too short to evaluate properly. Aim for at least 200 words."
        elif word_count < 150:
            return round(max_score * 0.4, 1), "Response is somewhat brief. Consider developing your arguments further."
        else:
            return round(max_score * 0.5, 1), "Response meets minimum length. AI evaluation was unavailable — score is approximate."
