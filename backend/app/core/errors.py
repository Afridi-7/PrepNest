"""Application-level error codes and exceptions.

Goal: give the frontend a stable, machine-readable ``code`` to switch on,
without changing the human-readable ``detail`` string that existing clients
(and tests) already depend on.

The HTTP error envelope returned by the registered exception handler is::

    { "detail": "<human message>", "code": "<machine code>" }

Existing routers that ``raise HTTPException(detail="...")`` are unaffected;
this module is purely additive and only takes effect for endpoints that
explicitly raise :class:`AppError`.
"""

from __future__ import annotations

from typing import Any


class ErrorCode:
    """String constants for stable, machine-readable error codes."""

    PRO_REQUIRED = "pro_required"
    NOT_FOUND = "not_found"
    FORBIDDEN = "forbidden"
    UNAUTHORIZED = "unauthorized"
    RATE_LIMITED = "rate_limited"
    QUOTA_EXCEEDED = "quota_exceeded"
    VALIDATION_FAILED = "validation_failed"
    CONFLICT = "conflict"


class AppError(Exception):
    """Domain exception that carries an HTTP status, code, and message.

    Use ``raise AppError.pro_required()`` etc. The registered exception
    handler in :mod:`app.main` converts these into JSON responses.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        extras: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.extras = extras or {}

    # ── Constructors for the common cases ─────────────────────────────────

    @classmethod
    def pro_required(
        cls, message: str = "This feature requires a Pro subscription."
    ) -> "AppError":
        return cls(403, ErrorCode.PRO_REQUIRED, message)

    @classmethod
    def not_found(cls, message: str = "Not found.") -> "AppError":
        return cls(404, ErrorCode.NOT_FOUND, message)

    @classmethod
    def forbidden(cls, message: str = "Forbidden.") -> "AppError":
        return cls(403, ErrorCode.FORBIDDEN, message)

    @classmethod
    def unauthorized(cls, message: str = "Not authenticated.") -> "AppError":
        return cls(401, ErrorCode.UNAUTHORIZED, message)
