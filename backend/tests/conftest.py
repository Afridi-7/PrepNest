"""Pytest bootstrap — runs BEFORE any test module imports.

This file MUST live in `backend/tests/` so pytest discovers it before
collecting `test_*.py` files. Its job is to guarantee the test suite
NEVER touches the production Supabase Postgres instance referenced in
`.env`.

We force `DATABASE_URL` (and a couple of related env vars) to safe
local-only values, then disable any `.env` override coming from
pydantic-settings by clearing the cached `Settings` singleton.
"""
from __future__ import annotations

import os
from pathlib import Path

# 1. Force a dedicated SQLite test database (separate from the dev DB so we
#    never touch the developer's working data and never inherit a stale
#    schema). The app's startup hook runs `Base.metadata.create_all`, so a
#    deleted/missing file will be re-created with the current schema.
_TEST_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"
if _TEST_DB_PATH.exists():
    try:
        _TEST_DB_PATH.unlink()
    except PermissionError:
        # On Windows the dev server may hold the file open; fall back to
        # truncating so the next create_all rebuilds the tables.
        pass
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB_PATH.as_posix()}"

# 2. Make sure no real third-party API keys are read from `.env` during tests.
os.environ["RESEND_API_KEY"] = ""
os.environ["RESEND_FROM_EMAIL"] = ""
os.environ["OPENAI_API_KEY"] = ""
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["GOOGLE_CLIENT_SECRET"] = ""

# 3. Stable, deterministic JWT secret for tests so login/verify flows work.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-do-not-use-in-prod")

# 4. Pydantic-settings loads `.env` lazily via an LRU cache. Clear the cache
#    so the first call to `get_settings()` from inside the test process re-
#    reads from `os.environ` (where our overrides above take precedence).
try:  # pragma: no cover - defensive: only fails if config layout changes
    from app.core.config import get_settings

    get_settings.cache_clear()
except Exception:
    pass


# 5. Create the schema in the test DB up-front. Using `TestClient(app)`
#    without `with` does NOT fire FastAPI's startup hook, so we cannot rely
#    on the app's own `Base.metadata.create_all`. We do it here once per
#    pytest session via a synchronous sqlite engine.
def _create_test_schema() -> None:
    from sqlalchemy import create_engine

    from app.db.base import Base
    from app.db import models  # noqa: F401 — register model classes on Base

    sync_url = f"sqlite:///{_TEST_DB_PATH.as_posix()}"
    sync_engine = create_engine(sync_url)
    try:
        Base.metadata.create_all(sync_engine)
    finally:
        sync_engine.dispose()


_create_test_schema()
