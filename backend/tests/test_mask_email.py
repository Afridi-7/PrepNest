"""Unit tests for the `_mask_email` PII-redaction helper used in auth logs."""
from __future__ import annotations

from app.api.routers.auth import _mask_email


def test_returns_redacted_for_none() -> None:
    assert _mask_email(None) == "<redacted>"


def test_returns_redacted_for_empty_string() -> None:
    assert _mask_email("") == "<redacted>"


def test_returns_redacted_for_string_without_at_sign() -> None:
    assert _mask_email("not-an-email") == "<redacted>"


def test_masks_short_local_part_to_first_char_plus_star() -> None:
    # 2-char local → "a" + "*"
    assert _mask_email("ab@example.com") == "a*@example.com"


def test_masks_single_char_local_part() -> None:
    assert _mask_email("a@example.com") == "a*@example.com"


def test_masks_long_local_part_keeping_first_and_last_char() -> None:
    assert _mask_email("alice@example.com") == "a***e@example.com"


def test_preserves_full_domain() -> None:
    masked = _mask_email("very.long.user@some.subdomain.example.co.uk")
    assert masked.endswith("@some.subdomain.example.co.uk")
    # Local part must NOT contain the original chars in the middle.
    local = masked.split("@", 1)[0]
    assert "long" not in local
    assert "user" not in local
