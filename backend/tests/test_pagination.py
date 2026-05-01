"""Pagination helper tests."""
from __future__ import annotations

from app.api.pagination import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    decode_cursor,
    encode_cursor,
)
from datetime import datetime, timezone


def test_default_and_max_limits_are_sane() -> None:
    assert 10 <= DEFAULT_LIMIT <= 50
    assert MAX_LIMIT == 100


def test_cursor_roundtrip() -> None:
    ts = datetime(2024, 5, 1, 12, 30, 0, tzinfo=timezone.utc)
    item_id = "abc-123"
    token = encode_cursor(ts, item_id)
    assert isinstance(token, str)
    assert "=" not in token  # base64-url, no padding

    decoded = decode_cursor(token)
    assert decoded is not None
    decoded_ts, decoded_id = decoded
    assert decoded_id == item_id
    assert decoded_ts.replace(tzinfo=timezone.utc) == ts


def test_decode_invalid_cursor_returns_none() -> None:
    assert decode_cursor("not-a-real-cursor") is None
    assert decode_cursor("") is None
