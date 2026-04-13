"""Thin wrapper around the Supabase Storage REST API (via httpx).

When `supabase_url` and `supabase_service_key` are configured the helper
uploads files to Supabase Storage and returns a public URL.  Otherwise it
falls back to local-disk storage so development doesn't require Supabase.
"""

import asyncio
import logging
import mimetypes
import uuid
from pathlib import Path

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TIMEOUT = 60  # seconds


def _settings():
    return get_settings()


def _is_supabase_configured() -> bool:
    s = _settings()
    return bool(s.supabase_url and s.supabase_service_key)


def _storage_api() -> str:
    return f"{_settings().supabase_url}/storage/v1"


def _auth_headers() -> dict[str, str]:
    key = _settings().supabase_service_key
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }


def _guess_mime(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


# ---------------------------------------------------------------------------
# Bucket bootstrap  (called once on startup)
# ---------------------------------------------------------------------------


def ensure_bucket_exists() -> None:
    """Create the storage bucket if it doesn't exist (idempotent)."""
    if not _is_supabase_configured():
        return
    bucket = _settings().supabase_storage_bucket
    try:
        resp = httpx.post(
            f"{_storage_api()}/bucket",
            headers={**_auth_headers(), "Content-Type": "application/json"},
            json={
                "id": bucket,
                "name": bucket,
                "public": True,
                "file_size_limit": 104857600,  # 100 MB
                "allowed_mime_types": None,     # allow all
            },
            timeout=_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            logger.info("Supabase bucket '%s' created", bucket)
        elif resp.status_code == 409 or "already exists" in resp.text.lower():
            logger.debug("Supabase bucket '%s' already exists — updating config", bucket)
            # Update existing bucket config
            httpx.put(
                f"{_storage_api()}/bucket/{bucket}",
                headers={**_auth_headers(), "Content-Type": "application/json"},
                json={
                    "public": True,
                    "file_size_limit": 104857600,
                    "allowed_mime_types": None,
                },
                timeout=_TIMEOUT,
            )
        else:
            logger.warning("Bucket create response %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Could not ensure Supabase bucket: %s", exc)


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------


def upload_bytes(data: bytes, path: str, content_type: str | None = None) -> str:
    """Upload *data* to *path* inside the configured bucket (sync version).

    Returns the **public URL** of the uploaded object.
    Falls back to local-disk write when Supabase is not configured.
    """
    settings = _settings()
    mime = content_type or _guess_mime(path)

    if _is_supabase_configured():
        return _upload_supabase(data, path, mime, settings)

    return _save_local(data, path, settings)


async def async_upload_bytes(data: bytes, path: str, content_type: str | None = None) -> str:
    """Async version of upload_bytes — won't block the event loop."""
    settings = _settings()
    mime = content_type or _guess_mime(path)

    if _is_supabase_configured():
        return await _async_upload_supabase(data, path, mime, settings)

    return await asyncio.to_thread(_save_local, data, path, settings)


# -- Supabase path ---------------------------------------------------------


def _upload_supabase(data: bytes, path: str, mime: str, settings) -> str:
    bucket = settings.supabase_storage_bucket
    url = f"{_storage_api()}/object/{bucket}/{path}"

    resp = httpx.post(
        url,
        headers={
            **_auth_headers(),
            "Content-Type": mime,
            "x-upsert": "true",
        },
        content=data,
        timeout=_TIMEOUT,
    )
    if resp.status_code not in (200, 201):
        logger.error("Supabase upload failed %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"Supabase upload failed ({resp.status_code})")

    public_url = f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{path}"
    logger.info("Uploaded to Supabase: %s", public_url)
    return public_url


async def _async_upload_supabase(data: bytes, path: str, mime: str, settings) -> str:
    bucket = settings.supabase_storage_bucket
    url = f"{_storage_api()}/object/{bucket}/{path}"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            url,
            headers={
                **_auth_headers(),
                "Content-Type": mime,
                "x-upsert": "true",
            },
            content=data,
        )
    if resp.status_code not in (200, 201):
        body = resp.text[:500]
        logger.error("Supabase upload failed %s: %s (url=%s, size=%d, mime=%s)",
                      resp.status_code, body, url, len(data), mime)
        raise RuntimeError(f"Supabase upload failed ({resp.status_code}): {body}")

    public_url = f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{path}"
    logger.info("Uploaded to Supabase: %s", public_url)
    return public_url


# -- Local fallback --------------------------------------------------------


def _save_local(data: bytes, path: str, settings) -> str:
    dest = settings.upload_dir_path / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"/uploads/{path}"


# ---------------------------------------------------------------------------
# Convenience: generate a safe object key
# ---------------------------------------------------------------------------


import re as _re

def make_key(prefix: str, filename: str) -> str:
    """Return ``<prefix>/<uuid>_<safe_filename>``.

    Sanitises the filename so Supabase Storage doesn't reject the key
    (it forbids parentheses, spaces, and most non-alphanumeric chars).
    """
    safe = Path(filename).name  # strip directory components
    stem, suffix = Path(safe).stem, Path(safe).suffix
    # Keep only alphanumerics, hyphens, underscores, and dots
    stem = _re.sub(r"[^a-zA-Z0-9._-]", "_", stem)
    # Collapse repeated underscores
    stem = _re.sub(r"_+", "_", stem).strip("_")
    return f"{prefix}/{uuid.uuid4()}_{stem}{suffix}"
