from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url

from app.core.config import get_settings

settings = get_settings()


def resolve_database_url(database_url: str) -> str:
    url = make_url(database_url)

    if url.drivername.startswith("postgres") and url.host in {"localhost", "127.0.0.1", "::1"}:
        return "sqlite+aiosqlite:///./prepnest_ai_tutor.db"

    if url.drivername in {"postgresql", "postgres"} or url.drivername.startswith("postgresql+"):
        return url.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)

    return database_url


engine = create_async_engine(resolve_database_url(settings.database_url), pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, autoflush=False, expire_on_commit=False, class_=AsyncSession)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
