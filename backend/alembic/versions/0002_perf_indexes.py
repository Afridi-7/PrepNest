"""perf indexes, pgvector, ai_usage, document_chunks, file processing fields

Revision ID: 0002_perf_indexes
Revises: 0001_initial
Create Date: 2026-05-02 00:01:00

Phase 1 (indexes/pagination), Phase 3 (pgvector vector store), and Phase 5
(AI usage tracking) schema additions. All operations are guarded so the
migration can run safely on a database that was bootstrapped from
``create_all`` and may already contain some columns/indexes.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_perf_indexes"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def _has_table(bind, name: str) -> bool:
    insp = sa.inspect(bind)
    return name in insp.get_table_names()


def _has_index(bind, table: str, index_name: str) -> bool:
    insp = sa.inspect(bind)
    if not _has_table(bind, table):
        return False
    return any(ix["name"] == index_name for ix in insp.get_indexes(table))


def _create_index_if_missing(name: str, table: str, cols: list[str]) -> None:
    bind = op.get_bind()
    if not _has_table(bind, table):
        return
    if _has_index(bind, table, name):
        return
    op.create_index(name, table, cols)


# ── Migration ────────────────────────────────────────────────────────────


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = _is_postgres(bind)

    # 1) Composite / additional indexes for common query patterns.
    _create_index_if_missing("ix_messages_conversation_created", "messages", ["conversation_id", "created_at"])
    _create_index_if_missing("ix_conversations_user_updated", "conversations", ["user_id", "updated_at"])
    _create_index_if_missing("ix_file_assets_user_created", "file_assets", ["user_id", "created_at"])
    _create_index_if_missing("ix_file_assets_status", "file_assets", ["status"])
    _create_index_if_missing("ix_mcqs_topic_created", "mcqs", ["topic_id", "created_at"])
    _create_index_if_missing("ix_query_questions_user_created", "query_questions", ["user_id", "created_at"])
    _create_index_if_missing("ix_query_replies_question_created", "query_replies", ["question_id", "created_at"])
    _create_index_if_missing("ix_practice_results_user_created", "practice_results", ["user_id", "created_at"])
    _create_index_if_missing("ix_payments_user_status", "payments", ["user_id", "status"])
    _create_index_if_missing("ix_mock_tests_user_created", "mock_tests", ["user_id", "created_at"])

    # 2) FileAsset processing/error tracking columns (Phase 2).
    insp = sa.inspect(bind)
    if _has_table(bind, "file_assets"):
        cols = {c["name"] for c in insp.get_columns("file_assets")}
        if "task_id" not in cols:
            op.add_column("file_assets", sa.Column("task_id", sa.String(length=64), nullable=True))
        if "error_message" not in cols:
            op.add_column("file_assets", sa.Column("error_message", sa.Text(), nullable=True))
        if "processed_at" not in cols:
            op.add_column("file_assets", sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True))

    # 3) ai_usage table (Phase 5 – cost / token tracking).
    if not _has_table(bind, "ai_usage"):
        op.create_table(
            "ai_usage",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.String(length=36), nullable=False, index=True),
            sa.Column("conversation_id", sa.String(length=36), nullable=True, index=True),
            sa.Column("model", sa.String(length=64), nullable=False, index=True),
            sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="ok"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        )
        op.create_index("ix_ai_usage_user_created", "ai_usage", ["user_id", "created_at"])

    # 4) pgvector extension + document_chunks table (Phase 3).
    if is_pg:
        # Extension creation requires superuser on some managed Postgres
        # services – wrap in a try so the migration still succeeds and the
        # operator can enable the extension manually if needed.
        try:
            op.execute("CREATE EXTENSION IF NOT EXISTS vector")
            has_vector = True
        except Exception:
            has_vector = False

        if not _has_table(bind, "document_chunks"):
            embedding_col_sql = "embedding vector(1536)" if has_vector else "embedding bytea"
            op.execute(
                f"""
                CREATE TABLE document_chunks (
                    id            varchar(36) PRIMARY KEY,
                    user_id       varchar(36),
                    conversation_id varchar(36),
                    file_id       varchar(36),
                    source        varchar(64),
                    page          integer,
                    chunk_text    text NOT NULL,
                    {embedding_col_sql},
                    metadata_json jsonb DEFAULT '{{}}'::jsonb,
                    created_at    timestamptz NOT NULL DEFAULT now()
                )
                """
            )
            op.execute("CREATE INDEX ix_document_chunks_user_id ON document_chunks (user_id)")
            op.execute("CREATE INDEX ix_document_chunks_conversation_id ON document_chunks (conversation_id)")
            op.execute("CREATE INDEX ix_document_chunks_file_id ON document_chunks (file_id)")

            if has_vector:
                # IVFFlat is a good default; tune `lists` after data exists.
                # For < ~10k rows a flat scan is plenty; we still create the
                # index so growth is painless.
                try:
                    op.execute(
                        "CREATE INDEX ix_document_chunks_embedding "
                        "ON document_chunks USING ivfflat (embedding vector_cosine_ops) "
                        "WITH (lists = 100)"
                    )
                except Exception:
                    # IVFFlat needs data to train; ignore on empty tables.
                    pass


def downgrade() -> None:
    bind = op.get_bind()

    if _has_table(bind, "document_chunks"):
        op.execute("DROP TABLE IF EXISTS document_chunks")
    if _has_table(bind, "ai_usage"):
        op.drop_table("ai_usage")

    for name, table in (
        ("ix_messages_conversation_created", "messages"),
        ("ix_conversations_user_updated", "conversations"),
        ("ix_file_assets_user_created", "file_assets"),
        ("ix_file_assets_status", "file_assets"),
        ("ix_mcqs_topic_created", "mcqs"),
        ("ix_query_questions_user_created", "query_questions"),
        ("ix_query_replies_question_created", "query_replies"),
        ("ix_practice_results_user_created", "practice_results"),
        ("ix_payments_user_status", "payments"),
        ("ix_mock_tests_user_created", "mock_tests"),
    ):
        if _has_index(bind, table, name):
            op.drop_index(name, table_name=table)

    if _has_table(bind, "file_assets"):
        insp = sa.inspect(bind)
        cols = {c["name"] for c in insp.get_columns("file_assets")}
        for col in ("task_id", "error_message", "processed_at"):
            if col in cols:
                op.drop_column("file_assets", col)
