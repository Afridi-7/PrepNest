"""AI Tutor module.

Consolidated package that groups tutor orchestration, specialist agents,
RAG components, and tool integrations under one namespace.
"""

from app.agents.ai_tutor.orchestration.orchestrator import orchestrator

__all__ = ["orchestrator"]
