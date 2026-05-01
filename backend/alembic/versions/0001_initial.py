"""initial baseline

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-02 00:00:00

This migration adopts Alembic on top of the existing schema. It creates
every table currently declared on ``Base.metadata`` if it does not yet
exist, so a fresh database can be brought to a working state with
``alembic upgrade head`` alone.

For databases that were previously bootstrapped via ``Base.metadata.create_all``
(the legacy startup path), tables already exist; in that case stamp the
revision instead of upgrading::

    alembic stamp 0001_initial

Subsequent migrations contain the actual schema deltas.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.db.base import Base
import app.db.models  # noqa: F401  – register all model tables on metadata


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: emits CREATE TABLE only for tables that don't exist.
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    # The baseline is intentionally non-destructive — never drop user data.
    pass
