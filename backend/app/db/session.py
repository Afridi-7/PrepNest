from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url

from app.core.config import get_settings

settings = get_settings()


# Hosts that we treat as "local development" — for these we keep behaviour
# permissive (no SSL enforcement, no fallback). Anything else is treated as a
# remote production database and gets SSL + sane pool limits.
_LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "::1", "db", "postgres"}


def resolve_database_url(database_url: str) -> tuple[str, dict[str, object]]:
    url = make_url(database_url)
    connect_args: dict[str, object] = {}

    if url.drivername.startswith("postgres") and url.host in {"localhost", "127.0.0.1", "::1"}:
        return "sqlite+aiosqlite:///./prepnest_ai_tutor.db", connect_args

    if url.drivername in {"postgresql", "postgres"} or url.drivername.startswith("postgresql+"):
        sslmode = url.query.get("sslmode")
        if sslmode is not None:
            url = url.difference_update_query(["sslmode"])
            sslmode_value = str(sslmode).strip().lower()
            valid_ssl_modes = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
            if sslmode_value in valid_ssl_modes:
                # asyncpg accepts libpq-style SSL mode strings.
                # Using mode strings preserves expected behavior for "require"
                # (encrypted connection without strict CA verification).
                connect_args["ssl"] = sslmode_value

        # Defence-in-depth: if connecting to a non-local Postgres host and the
        # caller didn't explicitly set sslmode, force an encrypted connection.
        # This prevents an accidental misconfiguration from sending DB
        # credentials in plain text over the public internet.
        if "ssl" not in connect_args and url.host and url.host.lower() not in _LOCAL_DB_HOSTS:
            connect_args["ssl"] = "require"

        return url.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False), connect_args

    return database_url, connect_args


database_url, connect_args = resolve_database_url(settings.database_url)

# `pool_pre_ping` validates connections before use (avoids "connection closed"
# errors after the DB drops idle conns). `pool_recycle` proactively rotates
# connections every 30 min so a stale pool can't accumulate. `pool_size` /
# `max_overflow` cap concurrent DB connections — without this a traffic spike
# can exhaust the database's max_connections limit and bring the site down.
_engine_kwargs: dict[str, object] = {
    "pool_pre_ping": True,
    "connect_args": connect_args,
}
if not database_url.startswith("sqlite"):
    _engine_kwargs.update({
        # Supabase free tier: 15 connections total.
        # asyncpg pool takes another 5, so cap SQLAlchemy at 5 idle + 5 overflow.
        "pool_size": 5,
        "max_overflow": 5,
        "pool_recycle": 1800,
        "pool_timeout": 30,
    })

engine = create_async_engine(database_url, **_engine_kwargs)
SessionLocal = async_sessionmaker(engine, autoflush=False, expire_on_commit=False, class_=AsyncSession)

# Alias for use in non-FastAPI contexts (e.g. orchestrator agents)
async_session_factory = SessionLocal


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
