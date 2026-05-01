"""Reusable pagination primitives for list endpoints.

Two flavours are supported:

* **Offset/limit** — simple, jumps to arbitrary page; cheap on indexed
  ``ORDER BY pk`` queries up to ~10k rows. Use as a default.
* **Cursor (created_at, id)** — stable for very long, frequently-mutated
  feeds (query room, conversations, messages). Returns an opaque cursor
  the client passes back verbatim.

Default limit is **20**, hard maximum **100** (enforced at the FastAPI
layer via ``Query(..., le=100)``).
"""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession


T = TypeVar("T")


DEFAULT_LIMIT = 20
MAX_LIMIT = 100


# ── FastAPI query-parameter dependency ───────────────────────────────────


@dataclass(slots=True)
class PageParams:
    """Resolved offset/limit pagination parameters.

    Use as a ``Depends`` dependency::

        @router.get("/things")
        async def list_things(page: PageParams = Depends(PageParams.dep), ...):
            ...
    """

    limit: int
    offset: int

    @staticmethod
    def dep(
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT, description="Page size"),
        offset: int = Query(0, ge=0, description="Page offset"),
    ) -> "PageParams":
        return PageParams(limit=limit, offset=offset)


class Page(BaseModel, Generic[T]):
    """Standard offset/limit page envelope returned to clients."""

    items: list[T]
    total: int
    limit: int
    offset: int
    has_more: bool


async def paginate(
    db: AsyncSession,
    stmt: Select[Any],
    *,
    page: PageParams,
) -> tuple[Sequence[Any], int]:
    """Run ``stmt`` with ``LIMIT/OFFSET`` and return (rows, total_count).

    Performs a separate ``SELECT COUNT(*) FROM (stmt)`` so the page envelope
    can include a real ``total``. For very high-volume tables prefer
    cursor pagination (below) and skip the count.
    """
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)
    rows = (await db.execute(stmt.limit(page.limit).offset(page.offset))).scalars().all()
    return rows, total


# ── Cursor pagination (created_at, id) ───────────────────────────────────


def encode_cursor(created_at: datetime, item_id: Any) -> str:
    raw = json.dumps({"t": created_at.isoformat(), "i": str(item_id)}, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str] | None:
    try:
        padding = "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(cursor + padding).decode("utf-8")
        data = json.loads(raw)
        return datetime.fromisoformat(data["t"]), str(data["i"])
    except Exception:
        return None


@dataclass(slots=True)
class CursorParams:
    limit: int
    cursor: str | None

    @staticmethod
    def dep(
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
        cursor: str | None = Query(None, max_length=512),
    ) -> "CursorParams":
        return CursorParams(limit=limit, cursor=cursor)


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None
    has_more: bool


def apply_cursor(
    stmt: Select[Any],
    *,
    cursor: str | None,
    created_at_col,
    id_col,
) -> Select[Any]:
    """Append a `(created_at, id) < cursor` clause and DESC ordering.

    The ``id`` column is a tiebreaker for rows with the exact same timestamp,
    guaranteeing deterministic pagination order.
    """
    if cursor:
        decoded = decode_cursor(cursor)
        if decoded:
            ts, item_id = decoded
            stmt = stmt.where(
                or_(
                    created_at_col < ts,
                    and_(created_at_col == ts, id_col < item_id),
                )
            )
    return stmt.order_by(created_at_col.desc(), id_col.desc())
