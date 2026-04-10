"""
One-shot script: set is_admin=True for a given email.
Run from backend/ with the venv active:
    python scripts/promote_admin.py qkafridi4@gmail.com
"""
import asyncio
import sys
import os

# make sure app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import update
from app.db.session import SessionLocal
from app.db.models import User


async def promote(email: str) -> None:
    async with SessionLocal() as db:
        result = await db.execute(
            update(User)
            .where(User.email == email)
            .values(is_admin=True)
            .returning(User.id, User.email, User.is_admin)
        )
        row = result.fetchone()
        if row is None:
            print(f"[ERROR] No user found with email: {email}")
            return
        await db.commit()
        print(f"[OK] {row.email} (id={row.id}) is_admin={row.is_admin}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/promote_admin.py <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))
