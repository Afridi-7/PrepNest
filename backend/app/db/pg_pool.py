import asyncpg
from sqlalchemy.engine import make_url

from app.core.config import get_settings

_pool: asyncpg.Pool | None = None

# Supabase free tier caps total connections at 15.
# SQLAlchemy (session.py) holds up to 10 (5 pool + 5 overflow).
# Leave 5 for asyncpg, starting with 2 idle and growing on demand.
_MIN_POOL = 2
_MAX_POOL = 5


def _build_pool_dsn(database_url: str) -> tuple[str, bool] | None:
    """Return (dsn, needs_ssl) or None if the URL is not a postgres URL."""
    url = make_url(database_url)
    if not url.drivername.startswith("postgres"):
        return None

    # asyncpg expects postgres/postgresql driver names, not SQLAlchemy's +asyncpg variant.
    if "+" in url.drivername or url.drivername == "postgres":
        url = url.set(drivername="postgresql")

    # Strip the sslmode query param — asyncpg handles SSL via its own `ssl`
    # argument, not the URL. Leaving `?sslmode=require` in the DSN causes
    # asyncpg to raise "invalid option: sslmode".
    query = {k: v for k, v in (url.query or {}).items() if k != "sslmode"}
    needs_ssl = url.query.get("sslmode", "disable") not in ("disable", "allow") if url.query else False
    url = url.set(query=query)

    return url.render_as_string(hide_password=False), needs_ssl


async def init_pg_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        result = _build_pool_dsn(settings.database_url)

        if result:
            dsn, needs_ssl = result
            _pool = await asyncpg.create_pool(
                dsn=dsn,
                ssl="require" if needs_ssl else None,
                min_size=_MIN_POOL,
                max_size=_MAX_POOL,
            )
        else:
            _pool = await asyncpg.create_pool(
                host=settings.pg_host,
                port=settings.pg_port,
                database=settings.pg_database,
                user=settings.pg_user,
                password=settings.pg_password,
                min_size=_MIN_POOL,
                max_size=_MAX_POOL,
            )
    return _pool


def get_pg_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("PostgreSQL pool is not initialized")
    return _pool


async def close_pg_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
