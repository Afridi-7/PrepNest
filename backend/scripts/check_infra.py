"""Quick connectivity diagnostic — run from backend/ with the venv active."""
import asyncio
import sys

sys.path.insert(0, ".")

from app.core.config import get_settings  # noqa: E402

settings = get_settings()


# ── Redis ─────────────────────────────────────────────────────────────────────
async def check_redis() -> None:
    url = settings.redis_url
    print(f"\n=== Redis  ({url[:40]}...) ===")
    try:
        import redis.asyncio as r

        client = r.from_url(url, socket_connect_timeout=5)
        pong = await client.ping()
        info = await client.info("server")
        ver = info["redis_version"]
        print(f"  [OK]  ping={pong}  version={ver}")
        await client.close()
    except Exception as exc:
        print(f"  [FAIL]  {exc}")


# ── Postgres + pgvector ────────────────────────────────────────────────────────
async def check_pgvector() -> None:
    raw_url = settings.database_url
    # resolve_database_url converts to asyncpg; asyncpg wants plain psycopg DSN
    # so rebuild a plain postgresql:// URL for the asyncpg.connect() call
    dsn = (
        raw_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgres+asyncpg://", "postgresql://")
    )
    print(f"\n=== Postgres + pgvector  ({dsn[:55]}...) ===")
    try:
        import asyncpg

        conn = await asyncpg.connect(dsn, timeout=10)
        pg_ver = await conn.fetchval("SELECT version()")
        print(f"  [OK]  {pg_ver[:80]}")

        row = await conn.fetchrow(
            "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
        )
        if row:
            print(f"  [pgvector OK]  extension version={row['extversion']}")
        else:
            print("  [pgvector MISSING]  run in your DB:  CREATE EXTENSION vector;")

        await conn.close()
    except Exception as exc:
        print(f"  [FAIL]  {exc}")


if __name__ == "__main__":
    asyncio.run(check_redis())
    asyncio.run(check_pgvector())
    print()
