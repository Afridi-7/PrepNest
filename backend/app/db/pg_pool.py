import asyncpg
from sqlalchemy.engine import make_url

from app.core.config import get_settings

_pool: asyncpg.Pool | None = None


def _build_pool_dsn(database_url: str) -> str | None:
    url = make_url(database_url)
    if not url.drivername.startswith("postgres"):
        return None

    # asyncpg expects postgres/postgresql driver names, not SQLAlchemy's +asyncpg variant.
    if "+" in url.drivername or url.drivername == "postgres":
        url = url.set(drivername="postgresql")

    return url.render_as_string(hide_password=False)


async def init_pg_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        dsn = _build_pool_dsn(settings.database_url)

        if dsn:
            _pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=1,
                max_size=10,
            )
        else:
            _pool = await asyncpg.create_pool(
                host=settings.pg_host,
                port=settings.pg_port,
                database=settings.pg_database,
                user=settings.pg_user,
                password=settings.pg_password,
                min_size=1,
                max_size=10,
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
