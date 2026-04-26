"""Unit tests for the DB URL resolver in app.db.session.

These cover the SSL-enforcement and SQLite-fallback logic without opening
any real DB connections.
"""
from __future__ import annotations

from app.db.session import resolve_database_url


def test_local_postgres_falls_back_to_sqlite() -> None:
    """A `postgres://localhost/...` URL is rewritten to a local SQLite URL
    so dev environments don't accidentally need a Postgres server running."""
    url, connect_args = resolve_database_url(
        "postgresql://user:pass@localhost:5432/prepnest"
    )
    assert url.startswith("sqlite+aiosqlite:")
    assert connect_args == {}


def test_remote_postgres_forces_ssl_when_not_specified() -> None:
    """Defence-in-depth: any non-local Postgres host must use SSL even if
    the URL didn't include `?sslmode=...`."""
    url, connect_args = resolve_database_url(
        "postgresql://user:pass@db.example.com:5432/prepnest"
    )
    assert url.startswith("postgresql+asyncpg://")
    assert connect_args.get("ssl") == "require"


def test_remote_postgres_respects_explicit_sslmode() -> None:
    url, connect_args = resolve_database_url(
        "postgresql://user:pass@db.example.com:5432/prepnest?sslmode=verify-full"
    )
    assert connect_args.get("ssl") == "verify-full"
    # The sslmode query param must be stripped from the URL since asyncpg
    # consumes it via connect_args, not the URL.
    assert "sslmode" not in url


def test_remote_postgres_invalid_sslmode_is_ignored() -> None:
    """Garbage `sslmode` values shouldn't be passed through silently — the
    fallback default-SSL path must kick in instead."""
    url, connect_args = resolve_database_url(
        "postgresql://user:pass@db.example.com:5432/prepnest?sslmode=banana"
    )
    assert connect_args.get("ssl") == "require"
    assert "sslmode" not in url


def test_supabase_pooler_host_is_treated_as_remote() -> None:
    url, connect_args = resolve_database_url(
        "postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    )
    assert connect_args.get("ssl") == "require"
    assert url.startswith("postgresql+asyncpg://")


def test_non_postgres_url_is_returned_unchanged() -> None:
    """A SQLite URL passes through unchanged with no ssl arg."""
    url, connect_args = resolve_database_url("sqlite+aiosqlite:///./test.db")
    assert url == "sqlite+aiosqlite:///./test.db"
    assert connect_args == {}
