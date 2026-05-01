import logging
import sys
from contextvars import ContextVar
from typing import Optional

# ContextVar holding the per-request correlation ID. Middleware sets it on
# every incoming request; the logging.Filter below copies it onto every
# LogRecord so any module that does `logger.info(...)` automatically gets
# the request ID without having to pass it around.
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


class RequestIdFilter(logging.Filter):
    """Inject the current request's correlation ID into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get() or "-"
        return True


def get_request_id() -> Optional[str]:
    """Return the correlation ID for the current request, or None."""
    return request_id_ctx.get()


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | rid=%(request_id)s | %(message)s"
        )
    )

    root = logging.getLogger()
    # Replace any pre-existing handlers (e.g. uvicorn's) so our request-ID
    # aware format wins. basicConfig is a no-op once handlers exist, so we
    # configure the root logger explicitly.
    for h in list(root.handlers):
        root.removeHandler(h)
    root.addHandler(handler)
    root.setLevel(level)

    # Route uvicorn's own loggers through the root handler so they also
    # carry the request ID without producing duplicate lines.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True
