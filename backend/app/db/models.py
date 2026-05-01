import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pro: Mapped[bool] = mapped_column(Boolean, default=False)
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    granted_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    verification_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reset_password_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    reset_password_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reset_password_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="New Conversation")
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")
    files: Mapped[list["FileAsset"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32), index=True)
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class FileAsset(Base):
    __tablename__ = "file_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(512))
    # Lifecycle: "uploaded" → "pending" → "processing" → "ready"/"indexed"
    # → terminal "failed". Older rows may use the legacy values
    # ("uploaded", "indexed") and are still valid; new code should prefer
    # the canonical set above.
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="files")


class SiteSettings(Base):
    """Singleton-style key/value table for editable public site config (social links, etc.)."""

    __tablename__ = "site_settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default="default")
    instagram_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    facebook_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    youtube_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tiktok_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    exam_type: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topics: Mapped[list["Topic"]] = relationship(back_populates="subject", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped[Subject] = relationship(back_populates="topics")
    materials: Mapped[list["Material"]] = relationship(back_populates="topic", cascade="all, delete-orphan")
    mcqs: Mapped[list["MCQ"]] = relationship(back_populates="topic", cascade="all, delete-orphan")
    resources: Mapped[list["Resource"]] = relationship(back_populates="chapter", cascade="all, delete-orphan")
    notes: Mapped[list["Note"]] = relationship(back_populates="chapter", cascade="all, delete-orphan", foreign_keys="Note.chapter_id")


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(64), index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topic: Mapped[Topic] = relationship(back_populates="materials")


class MCQ(Base):
    __tablename__ = "mcqs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question: Mapped[str] = mapped_column(Text)
    option_a: Mapped[str] = mapped_column(Text)
    option_b: Mapped[str] = mapped_column(Text)
    option_c: Mapped[str] = mapped_column(Text)
    option_d: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(String(1), index=True)
    explanation: Mapped[str] = mapped_column(Text)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topic: Mapped[Topic] = relationship(back_populates="mcqs")


class Tip(Base):
    __tablename__ = "tips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[str] = mapped_column(Text)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped[Subject] = relationship()


class Resource(Base):
    """Chapter-level resource links (Google Drive, PDFs, external URLs, etc.)."""

    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    url: Mapped[str] = mapped_column(Text)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chapter: Mapped["Topic"] = relationship(back_populates="resources")


class Note(Base):
    """Flexible notes: linked to a subject, a chapter, or both."""

    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[str] = mapped_column(Text)
    subject_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    chapter_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped["Subject | None"] = relationship(foreign_keys=[subject_id])
    chapter: Mapped["Topic | None"] = relationship(back_populates="notes", foreign_keys=[chapter_id])


class PastPaper(Base):
    """Dedicated past papers table with proper subject + optional chapter association."""

    __tablename__ = "past_papers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    file_path: Mapped[str] = mapped_column(Text)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped["Subject"] = relationship()
    chapter: Mapped["Topic | None"] = relationship()


class UserNote(Base):
    """User-uploaded PDF notes scoped to a subject. View-only (no download)."""

    __tablename__ = "user_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    file_path: Mapped[str] = mapped_column(Text)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SubjectResource(Base):
    """Subject-level resource links (URLs, docs, external references, etc.)."""

    __tablename__ = "subject_resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    url: Mapped[str] = mapped_column(Text)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped["Subject"] = relationship()


class ContactInfo(Base):
    """Singleton row holding public contact / social links (admin-editable)."""

    __tablename__ = "contact_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), default="PrepNest Team")
    bio: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    discord_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EssayPrompt(Base):
    """Essay prompts for mock tests. exam_type=NULL means shared across all categories."""

    __tablename__ = "essay_prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    essay_type: Mapped[str] = mapped_column(String(64), index=True)  # "argumentative", "narrative"
    prompt_text: Mapped[str] = mapped_column(Text)
    exam_type: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MockTest(Base):
    """Stores a generated mock test session with question snapshot and results."""

    __tablename__ = "mock_tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    sections_json: Mapped[dict] = mapped_column(JSON)  # question snapshot
    answers_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # user answers
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # evaluation result
    status: Mapped[str] = mapped_column(String(32), default="in_progress")  # in_progress, submitted, evaluated
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PracticeResult(Base):
    """Stores a completed practice quiz session result."""

    __tablename__ = "practice_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    total_questions: Mapped[int] = mapped_column(Integer)
    correct_answers: Mapped[int] = mapped_column(Integer)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subject_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Acknowledgment(Base):
    """People acknowledged on the Contact page (admin-managed)."""

    __tablename__ = "acknowledgments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    link_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Query Room (student Q&A board) ────────────────────────────────────────────


class QueryQuestion(Base):
    """A student-posted question or MCQ on the public Query Room board."""

    __tablename__ = "query_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    q_type: Mapped[str] = mapped_column(String(16), default="open")  # "open" | "mcq"
    options_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_label: Mapped[str | None] = mapped_column(String(1), nullable=True)
    tags_json: Mapped[list] = mapped_column(JSON, default=list)
    solved: Mapped[bool] = mapped_column(Boolean, default=False)
    accepted_reply_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class QueryReply(Base):
    """A reply / answer to a QueryQuestion."""

    __tablename__ = "query_replies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id: Mapped[str] = mapped_column(ForeignKey("query_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QueryQuestionVote(Base):
    """One row per (user, question) upvote pair. Composite primary key
    enforces 'one vote per user per question'."""

    __tablename__ = "query_question_votes"

    question_id: Mapped[str] = mapped_column(
        ForeignKey("query_questions.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QueryReplyVote(Base):
    """One row per (user, reply) upvote pair."""

    __tablename__ = "query_reply_votes"

    reply_id: Mapped[str] = mapped_column(
        ForeignKey("query_replies.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Subscription / payments (Safepay) ────────────────────────────────────────


class Payment(Base):
    """A single subscription payment attempt.

    Lifecycle:
      - row created with ``status="pending"`` when the user starts checkout
      - ``status="paid"`` (and ``paid_at`` set) when the webhook confirms it
      - ``status="failed"`` on declined / abandoned / expired tracker
      - ``status="refunded"`` if the merchant later issues a refund

    The Payment row does NOT itself grant Pro — it is the audit trail. Pro
    activation goes through ``UserRepository.grant_pro`` with the same
    expires_at we record here, so existing Pro logic is the single source
    of truth.
    """

    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_code: Mapped[str] = mapped_column(String(64), index=True)
    amount_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="PKR")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    safepay_tracker: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    safepay_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WebhookEvent(Base):
    """Idempotency log for Safepay (and future) webhooks.

    Each incoming webhook MUST carry a stable event id; we insert that id
    here inside the same transaction that activates the subscription. A
    duplicate delivery (Safepay retries on non-2xx) raises an integrity
    error which we catch and treat as a no-op success — the subscription
    has already been processed.
    """

    __tablename__ = "webhook_events"

    event_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), default="safepay", index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── AI usage / cost tracking (Phase 5) ────────────────────────────────────


class AiUsage(Base):
    """Per-call OpenAI usage record.

    Written by the AI tutor pipeline after every chat completion / embedding
    call. Used both for daily quota enforcement (free vs pro tiers can be
    capped on token spend, not just call count) and for admin analytics.

    All fields are denormalised on purpose so analytics queries don't need to
    join through ``messages`` / ``conversations``.
    """

    __tablename__ = "ai_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    model: Mapped[str] = mapped_column(String(64), index=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ok")  # "ok" | "error" | "timeout"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


# ── pgvector document chunks (Phase 3) ────────────────────────────────────
# This is a deliberately minimal SQLAlchemy declaration. The real table is
# created with the proper ``vector(N)`` column type by Alembic migration
# 0002_perf_indexes (which also creates the IVFFlat index). The ORM mapping
# here is only used for non-vector reads (e.g. fetching chunk_text by id);
# vector similarity itself goes through ``app.services.pgvector_store``,
# which executes raw SQL with pgvector operators.


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    file_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_text: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Note: ``embedding`` column is created by Alembic (vector(N) on Postgres,
    # bytea fallback elsewhere) and is intentionally not mapped here.
