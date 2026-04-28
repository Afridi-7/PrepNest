"""Pydantic schemas for the Query Room (student Q&A board)."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_TAG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,29}$")


class QueryOption(BaseModel):
    label: Literal["A", "B", "C", "D"]
    text: str = Field(min_length=1, max_length=300)


class QuestionCreate(BaseModel):
    title: str = Field(min_length=5, max_length=255)
    body: str = Field(min_length=1, max_length=5000)
    q_type: Literal["open", "mcq"] = "open"
    options: list[QueryOption] | None = None
    correct_label: Literal["A", "B", "C", "D"] | None = None
    tags: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("tags")
    @classmethod
    def _normalise_tags(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in v:
            if not isinstance(raw, str):
                continue
            t = raw.strip().lower().lstrip("#")
            if not t or t in seen:
                continue
            if not _TAG_RE.match(t):
                raise ValueError(
                    "Tags must be lowercase letters/digits/dashes (max 30 chars)."
                )
            seen.add(t)
            cleaned.append(t)
        return cleaned

    @model_validator(mode="after")
    def _validate_mcq(self) -> "QuestionCreate":
        if self.q_type == "mcq":
            if not self.options or len(self.options) != 4:
                raise ValueError("MCQ questions require exactly 4 options.")
            labels = [o.label for o in self.options]
            if labels != ["A", "B", "C", "D"]:
                raise ValueError("MCQ option labels must be A, B, C, D in order.")
            if self.correct_label is None:
                raise ValueError("MCQ questions require a correct_label.")
        else:
            # Force-clear MCQ-only fields for open questions.
            self.options = None
            self.correct_label = None
        return self


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=3000)


class AuthorMini(BaseModel):
    id: str
    name: str


class ReplyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    body: str
    is_accepted: bool
    upvotes: int
    has_upvoted: bool
    author: AuthorMini
    created_at: datetime


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    body: str
    q_type: str
    options: list[QueryOption] | None
    correct_label: str | None
    tags: list[str]
    solved: bool
    accepted_reply_id: str | None
    upvotes: int
    has_upvoted: bool
    reply_count: int
    author: AuthorMini
    created_at: datetime
    replies: list[ReplyRead] | None = None


class QuestionListResponse(BaseModel):
    items: list[QuestionRead]
    total: int


class TagCount(BaseModel):
    tag: str
    count: int


class QueryLeaderEntry(BaseModel):
    user_id: str
    user_name: str
    points: int
    posts: int
    replies: int
    accepted: int
    upvotes_received: int


class QueryLeaderboard(BaseModel):
    entries: list[QueryLeaderEntry]
    period_label: str = ""
    period_start: str = ""


class VoteResponse(BaseModel):
    upvotes: int
    has_upvoted: bool
