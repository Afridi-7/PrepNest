import asyncpg

from app.core.security import hash_password
from app.db.pg_pool import get_pg_pool


class UserCrudService:
    async def create_user(self, *, email: str, password: str) -> dict:
        pool = get_pg_pool()
        hashed = hash_password(password)
        query = """
            INSERT INTO users (email, password_hash)
            VALUES ($1, $2)
            RETURNING id, email
        """
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, email, hashed)
        return dict(row)

    async def list_users(self) -> list[dict]:
        pool = get_pg_pool()
        query = "SELECT id, email FROM users ORDER BY id"
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [dict(row) for row in rows]

    async def get_user_by_id(self, *, user_id: int) -> dict | None:
        pool = get_pg_pool()
        query = "SELECT id, email FROM users WHERE id = $1"
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, user_id)
        return dict(row) if row else None

    async def delete_user(self, *, user_id: int) -> bool:
        pool = get_pg_pool()
        query = "DELETE FROM users WHERE id = $1 RETURNING id"
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, user_id)
        return row is not None


def is_unique_violation(error: Exception) -> bool:
    if isinstance(error, asyncpg.UniqueViolationError):
        return True

    sqlstate = getattr(error, "sqlstate", None)
    return sqlstate == "23505"
