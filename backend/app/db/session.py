from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url

from app.core.config import get_settings

settings = get_settings()


def resolve_database_url(database_url: str) -> tuple[str, dict[str, object]]:
    url = make_url(database_url)
    connect_args: dict[str, object] = {}

    if url.drivername.startswith("postgres") and url.host in {"localhost", "127.0.0.1", "::1"}:
        return "sqlite+aiosqlite:///./prepnest_ai_tutor.db", connect_args

    if url.drivername in {"postgresql", "postgres"} or url.drivername.startswith("postgresql+"):
        sslmode = url.query.get("sslmode")
        if sslmode is not None:
            url = url.difference_update_query(["sslmode"])
            if sslmode in {"require", "verify-ca", "verify-full"}:
                connect_args["ssl"] = True
            elif sslmode == "disable":
                connect_args["ssl"] = False

        return url.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False), connect_args

    return database_url, connect_args


database_url, connect_args = resolve_database_url(settings.database_url)
engine = create_async_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = async_sessionmaker(engine, autoflush=False, expire_on_commit=False, class_=AsyncSession)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
