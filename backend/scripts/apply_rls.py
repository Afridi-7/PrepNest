"""One-shot script to apply Supabase RLS policies via asyncpg.

Reads DATABASE_URL from backend/.env and executes
backend/supabase_rls_policies.sql. Idempotent — safe to re-run.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import asyncpg


def load_env(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


async def main() -> int:
    root = Path(__file__).resolve().parents[1]
    load_env(root / ".env")

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1

    # asyncpg does not understand `sslmode=require` query param; strip it and
    # pass ssl=True instead.
    if "sslmode=" in dsn:
        from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

        parts = urlsplit(dsn)
        q = [(k, v) for k, v in parse_qsl(parts.query) if k != "sslmode"]
        dsn = urlunsplit(parts._replace(query=urlencode(q)))

    sql_path = root / "supabase_rls_policies.sql"
    sql = sql_path.read_text(encoding="utf-8")

    print(f"Connecting to {dsn.split('@')[-1]} ...")
    import ssl as _ssl
    ctx = _ssl.create_default_context()
    # Match `sslmode=require` semantics (encryption without CA verification),
    # which is what the backend already uses.
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    conn = await asyncpg.connect(dsn=dsn, ssl=ctx)
    try:
        await conn.execute(sql)
        print("RLS policies applied OK.")
        rows = await conn.fetch(
            """
            SELECT c.relname AS tablename,
                   c.relrowsecurity   AS rowsecurity,
                   c.relforcerowsecurity AS forcerowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
              AND c.relname IN (
                'users','conversations','messages','file_assets','user_notes',
                'mock_tests','practice_results','acknowledgments',
                'subjects','topics','materials','mcqs','tips','resources',
                'notes','past_papers','subject_resources','contact_info','essay_prompts'
              )
            ORDER BY c.relname;
            """
        )
        print(f"\n{'table':30s} rls   force")
        print("-" * 45)
        for r in rows:
            print(f"{r['tablename']:30s} {str(r['rowsecurity']):5s} {str(r['forcerowsecurity'])}")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
