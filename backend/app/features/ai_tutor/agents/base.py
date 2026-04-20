from dataclasses import dataclass, field


@dataclass
class AgentContext:
    user_id: str
    conversation_id: str
    query: str
    learning_level: str = "intermediate"
    recent_messages: list[dict] = field(default_factory=list)
    user_preferences: dict = field(default_factory=dict)
    attachments: list[dict] = field(default_factory=list)
    user_name: str = ""
    user_email: str = ""


@dataclass
class AgentOutput:
    name: str
    content: str = ""
    data: dict = field(default_factory=dict)
    references: list[dict] = field(default_factory=list)
    visuals: list[dict] = field(default_factory=list)
