from datetime import datetime
from typing import Literal

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
