from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    exam_type: str = Field(min_length=2, max_length=64)


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    exam_type: str | None = Field(default=None, min_length=2, max_length=64)


class SubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    exam_type: str
    created_at: datetime


class TopicCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    subject_id: int


class TopicUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    subject_id: int | None = None


class TopicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subject_id: int
    created_at: datetime


class MaterialCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    content: str = Field(min_length=1)
    type: Literal["notes", "past_paper"]
    topic_id: int


class MaterialUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    content: str | None = Field(default=None, min_length=1)
    type: Literal["notes", "past_paper"] | None = None
    topic_id: int | None = None


class MaterialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    type: str
    topic_id: int
    created_at: datetime


class PastPaperCreate(BaseModel):
    subject_id: int
    year: int = Field(ge=2000, le=2100)
    title: str | None = Field(default=None, min_length=2, max_length=255)
    content: str | None = Field(default=None, min_length=1)


class TipCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    content: str = Field(min_length=1)
    subject_id: int


class TipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    subject_id: int
    created_at: datetime


class USATCategoryRead(BaseModel):
    code: str
    title: str
    description: str


class MCQCreate(BaseModel):
    question: str = Field(min_length=1)
    option_a: str = Field(min_length=1)
    option_b: str = Field(min_length=1)
    option_c: str = Field(min_length=1)
    option_d: str = Field(min_length=1)
    correct_answer: Literal["A", "B", "C", "D"]
    explanation: str = Field(min_length=1)
    topic_id: int


class MCQUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    option_a: str | None = Field(default=None, min_length=1)
    option_b: str | None = Field(default=None, min_length=1)
    option_c: str | None = Field(default=None, min_length=1)
    option_d: str | None = Field(default=None, min_length=1)
    correct_answer: Literal["A", "B", "C", "D"] | None = None
    explanation: str | None = Field(default=None, min_length=1)
    topic_id: int | None = None


class MCQRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    explanation: str
    topic_id: int
    created_at: datetime
    subject_name: str | None = None


class AIChatRequest(BaseModel):
    question: str = Field(min_length=2)
    include_web: bool = True


class AIExplainRequest(BaseModel):
    topic: str = Field(min_length=2)
    include_web: bool = True


class AISolveRequest(BaseModel):
    prompt: str = Field(min_length=2)
    mode: Literal["mcq", "math", "essay"] = "mcq"
    include_web: bool = True


class AIResponse(BaseModel):
    answer: str
    context_materials: list[dict]
    context_mcqs: list[dict]
    web_results: list[dict]


# ── Resource schemas ────────────────────────────────────────────────────────

class ResourceCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    url: str = Field(min_length=1, max_length=2048)
    chapter_id: int


class ResourceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    url: str | None = Field(default=None, min_length=1, max_length=2048)


class ResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    url: str
    chapter_id: int
    created_at: datetime


# ── Subject-level Resource schemas ──────────────────────────────────────────

class SubjectResourceCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    url: str = Field(min_length=1, max_length=2048)
    subject_id: int


class SubjectResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    url: str
    subject_id: int
    created_at: datetime


# ── Note schemas ─────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    content: str = Field(min_length=1)
    subject_id: int | None = None
    chapter_id: int | None = None


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    subject_id: int | None
    chapter_id: int | None
    created_at: datetime


# ── PastPaper schemas ─────────────────────────────────────────────────────────

class PastPaperRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    file_path: str
    subject_id: int
    chapter_id: int | None
    created_at: datetime


# ── UserNote schemas ──────────────────────────────────────────────────────────

class UserNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    file_path: str
    subject_id: int
    user_id: str
    created_at: datetime


# ── Bulk subject data (single-request fetch for chapters page) ────────────────

class SubjectBulkData(BaseModel):
    subject: SubjectRead
    chapters: list[TopicRead]
    papers: list[PastPaperRead]
    tips: list[TipRead]
    resources: list[SubjectResourceRead]
    user_notes: list[UserNoteRead]


# ── ContactInfo schemas ───────────────────────────────────────────────────────

class ContactInfoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    bio: str
    image_url: str | None
    email: str | None
    github_url: str | None
    linkedin_url: str | None
    discord_url: str | None
    twitter_url: str | None
    whatsapp_url: str | None
    updated_at: datetime


class ContactInfoUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    bio: str | None = None
    image_url: str | None = None
    email: str | None = Field(default=None, max_length=255)
    github_url: str | None = None
    linkedin_url: str | None = None
    discord_url: str | None = None
    twitter_url: str | None = None
    whatsapp_url: str | None = None


# ── Acknowledgment schemas ────────────────────────────────────────────────────

class AcknowledgmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    image_url: str | None
    link_url: str | None
    display_order: int


class AcknowledgmentCreate(BaseModel):
    name: str = Field(max_length=255)
    link_url: str | None = None
    display_order: int = 0


class AcknowledgmentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    link_url: str | None = None
    display_order: int | None = None


# ── Dashboard schemas ─────────────────────────────────────────────────────────

class DashboardSubjectStat(BaseModel):
    id: int
    name: str
    topic_count: int
    mcq_count: int


class SubjectAttemptedStat(BaseModel):
    subject_name: str
    attempted: int
    correct: int


class UserRewards(BaseModel):
    claimed: list[int] = []
    streak_savers: int = 0
    streak_current: int = 0
    streak_best: int = 0
    pro_trial_expires_at: str | None = None
    is_elite: bool = False
    consistency_badge: bool = False


class DashboardStats(BaseModel):
    user_id: str
    user_name: str
    is_pro: bool = False
    total_subjects: int
    total_topics: int
    total_mcqs: int
    subjects: list[DashboardSubjectStat]
    # User-specific practice stats
    mcqs_solved: int = 0
    mcqs_attempted: int = 0
    tests_taken: int = 0
    accuracy: float = 0.0
    subject_attempted: list[SubjectAttemptedStat] = []
    rewards: UserRewards = UserRewards()


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    user_name: str
    mcqs_solved: int
    tests_taken: int


class PreviousMonthWinner(BaseModel):
    user_id: str
    user_name: str
    mcqs_solved: int
    month_label: str  # e.g. "March 2026"


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    updated_at: str
    period_start: str | None = None  # ISO-8601 — first day of current month (UTC)
    period_end: str | None = None    # ISO-8601 — first day of NEXT month (UTC, exclusive)
    period_label: str | None = None  # e.g. "April 2026"
    previous_winner: PreviousMonthWinner | None = None
    my_rank: int | None = None        # 1-based rank of the authed user, if any
    my_entry: LeaderboardEntry | None = None  # the authed user's own row (full stats)


class PracticeResultCreate(BaseModel):
    total_questions: int = Field(ge=1)
    correct_answers: int = Field(ge=0)
    category: str | None = None
    subject_name: str | None = None


class PracticeResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total_questions: int
    correct_answers: int


# ── EssayPrompt schemas ──────────────────────────────────────────────────────

class EssayPromptCreate(BaseModel):
    essay_type: Literal["argumentative", "narrative"]
    prompt_text: str = Field(min_length=10)
    exam_type: str | None = Field(default=None, max_length=64)


class EssayPromptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    essay_type: str
    prompt_text: str
    exam_type: str | None
    created_at: datetime


# ── MockTest schemas ─────────────────────────────────────────────────────────

class MockTestMCQQuestion(BaseModel):
    id: int
    question: str
    options: list[str]  # [A, B, C, D]
    subject: str


class MockTestEssayQuestion(BaseModel):
    id: int
    essay_type: str
    prompt_text: str


class MockTestSection(BaseModel):
    label: str
    type: str  # "mcq" or "essay"
    questions: list[MockTestMCQQuestion | MockTestEssayQuestion]


class MockTestGenerated(BaseModel):
    mock_test_id: str
    category: str
    sections: list[MockTestSection]
    total_mcqs: int
    total_essays: int
    pdf_url: str | None = None


class MockTestSubmit(BaseModel):
    mcq_answers: dict[str, str]  # { "question_id": "A"|"B"|"C"|"D" }
    essay_answers: dict[str, str]  # { "question_id": "essay text" }


class MCQResult(BaseModel):
    question_id: int
    question: str
    subject: str | None = None
    selected: str | None
    correct: str
    is_correct: bool
    explanation: str
    options: list[str] | None = None


class EssayResult(BaseModel):
    question_id: int
    essay_type: str
    prompt: str
    user_answer: str
    score: float  # argumentative out of 15, narrative out of 10
    max_score: float
    feedback: Any  # str (legacy) or dict with rich evaluation


class MockTestResult(BaseModel):
    mock_test_id: str
    category: str
    status: str
    total_score: float
    max_score: float
    percentage: float
    mcq_score: int
    mcq_total: int
    essay_score: float
    essay_total: float
    mcq_results: list[MCQResult]
    essay_results: list[EssayResult]
    ai_summary: Any | None = None
    created_at: str
    submitted_at: str | None
