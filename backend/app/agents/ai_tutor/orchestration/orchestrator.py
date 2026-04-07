"""AI Tutor orchestrator export.

This keeps a dedicated AI tutor namespace while preserving runtime behavior
by re-exporting the existing orchestrator implementation.
"""

from app.agents.orchestrator import AgentOrchestrator, orchestrator

__all__ = ["AgentOrchestrator", "orchestrator"]
