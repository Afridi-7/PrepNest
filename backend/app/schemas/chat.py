from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None
    learning_level: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")
    stream: bool = False


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    used_agents: list[str]
    references: list[dict]
    visuals: list[dict]
