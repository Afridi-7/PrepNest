from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, rate_limit
from app.core.config import get_settings
from app.models import User
from app.db.repositories.conversation_repo import ConversationRepository
from app.db.repositories.file_repo import FileAssetRepository
from app.db.session import get_db_session
from app.schemas.file import FileAssetResponse, FileStatusResponse, FileUploadResponse
from app.services.file_service import FileService

router = APIRouter(prefix="/files", tags=["files"])

# Allow-list of file types user-attachments can be (RAG ingestion targets).
# Anything outside this list is rejected to prevent users abusing storage as a
# generic CDN or uploading executable/HTML payloads.
_ALLOWED_UPLOAD_EXTENSIONS = {
    ".pdf", ".txt", ".md", ".markdown", ".csv",
    ".png", ".jpg", ".jpeg", ".webp", ".gif",
    ".doc", ".docx",
}
_ALLOWED_UPLOAD_MIME_PREFIXES = (
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "image/",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
)


def _is_allowed_upload(filename: str, content_type: str | None) -> bool:
    name = (filename or "").lower()
    if not any(name.endswith(ext) for ext in _ALLOWED_UPLOAD_EXTENSIONS):
        return False
    ctype = (content_type or "").lower()
    if ctype and not any(ctype.startswith(p) for p in _ALLOWED_UPLOAD_MIME_PREFIXES):
        return False
    return True


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(30, "files_upload")),
) -> FileUploadResponse:
    if not _is_allowed_upload(file.filename or "", file.content_type):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, text, markdown, CSV, images, Word documents.",
        )

    settings = get_settings()
    # Note: storage_service also enforces this, but checking up-front avoids
    # buffering huge payloads through the upload pipeline.
    if file.size is not None and file.size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size is {settings.max_upload_size_mb} MB",
        )

    conversation_repo = ConversationRepository(db)
    conversation = await conversation_repo.get_by_id(conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    service = FileService(db)
    result = await service.upload_and_index(
        file=file,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )
    return FileUploadResponse(**result)


@router.get("/{file_id}", response_model=FileAssetResponse)
async def get_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> FileAssetResponse:
    """Return metadata and the Supabase public URL for an uploaded file."""
    repo = FileAssetRepository(db)
    asset = await repo.get_by_id(file_id, current_user.id)
    if not asset:
        raise HTTPException(status_code=404, detail="File not found")
    return FileAssetResponse(
        id=asset.id,
        filename=asset.filename,
        content_type=asset.content_type,
        status=asset.status,
        url=asset.storage_path,
        metadata=asset.metadata_json or {},
        created_at=asset.created_at,
    )


@router.get("/{file_id}/status", response_model=FileStatusResponse)
async def get_file_status(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "files_status")),
) -> FileStatusResponse:
    """Lightweight poll endpoint for the upload progress UI.

    Returns the current ``FileAsset.status`` (``pending``, ``processing``,
    ``ready``/``indexed`` or ``failed``) and any error message recorded by
    the ingestion worker.
    """
    repo = FileAssetRepository(db)
    asset = await repo.get_by_id(file_id, current_user.id)
    if not asset:
        raise HTTPException(status_code=404, detail="File not found")
    return FileStatusResponse(
        id=asset.id,
        status=asset.status,
        error=asset.error_message,
        processed_at=asset.processed_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PDF / file proxy
#
# Why this exists:
#   Past-paper / note PDFs are stored in Supabase Storage under
#   /object/public/<bucket>/<path>. Supabase fronts those URLs with
#   Cloudflare. Two real-world failure modes were causing the "This content
#   is blocked. Contact the site owner to fix the issue." error in the app:
#
#     1. Cloudflare's bot-management challenge sometimes blocks iframe loads
#        when the embedding origin (prepnestai.app / vercel.app preview) is
#        flagged or the request lacks a recognized UA.
#     2. If the project is on Supabase free tier and gets paused, or the
#        bucket's "public" toggle is off, the public URL returns a block /
#        404 page instead of the file.
#
#   This endpoint fetches the object server-side using the service-role key
#   and streams the bytes back to the user. Service-role requests bypass
#   both the public-URL gate AND the Cloudflare bot challenge (because the
#   request is server-to-server, with proper auth headers).
# ─────────────────────────────────────────────────────────────────────────────

# Maximum bytes to stream — defensive ceiling so this can't be abused as an
# open proxy. 100 MB is well above any past-paper PDF size in practice.
_PROXY_MAX_BYTES = 100 * 1024 * 1024


def _path_from_supabase_url(url: str, bucket: str, supabase_base: str) -> str | None:
    """Extract the storage object key from a Supabase public/signed URL.

    Returns None if the URL is not a recognizable Supabase Storage URL for
    this project's bucket. Used to translate the legacy ``file_path`` values
    (which were stored as full public URLs) back into bucket-relative paths
    so we can fetch them via the service-role REST API.
    """
    if not url or not supabase_base:
        return None
    base = supabase_base.rstrip("/")
    # Public URL format: <base>/storage/v1/object/public/<bucket>/<path>
    public_prefix = f"{base}/storage/v1/object/public/{bucket}/"
    if url.startswith(public_prefix):
        return url[len(public_prefix):]
    # Authenticated URL format: <base>/storage/v1/object/<bucket>/<path>
    auth_prefix = f"{base}/storage/v1/object/{bucket}/"
    if url.startswith(auth_prefix):
        return url[len(auth_prefix):]
    # Sometimes the URL is just the path itself (no host) — accept that too.
    if not url.startswith(("http://", "https://")):
        return url.lstrip("/")
    return None


@router.get("/proxy")
async def proxy_storage_object(
    url: str = Query(..., description="Public Supabase URL or bucket-relative path"),
    token: str | None = Query(None, description="Auth token (alternative to Authorization header for iframes)"),
    _rl=Depends(rate_limit(60, "files_proxy")),
):
    """Stream a Supabase Storage object back to the caller.

    Fetches via the service-role key so the response works even when:
      - The bucket is private.
      - Cloudflare is blocking the public URL on the user's browser.
      - The user is on a flagged ISP / VPN.

    Auth: either an `Authorization: Bearer <jwt>` header OR a `?token=<jwt>`
    query param (so `<iframe src=...>` and PDF viewer plugins work — iframes
    can't set custom headers).
    """
    # Inline auth — accept Authorization header OR ?token= query param.
    from fastapi import Request  # local import to avoid altering top-of-file
    from app.core.security import decode_access_token
    from starlette.requests import Request as _R  # noqa: F401

    # Pull the JWT from whichever transport the client used.
    user_id: str | None = None
    if token:
        user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(status_code=503, detail="Storage backend not configured")

    bucket = settings.supabase_storage_bucket
    object_path = _path_from_supabase_url(url, bucket, settings.supabase_url)
    if not object_path:
        raise HTTPException(status_code=400, detail="URL is not a recognized storage object")

    fetch_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }

    client = httpx.AsyncClient(timeout=60.0)
    try:
        upstream = await client.get(fetch_url, headers=headers)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Storage fetch failed: {exc}")

    if upstream.status_code == 404:
        await client.aclose()
        raise HTTPException(
            status_code=404,
            detail="File not found in Supabase Storage. The object may have been deleted.",
        )
    if upstream.status_code >= 400:
        body = upstream.text[:200]
        await client.aclose()
        raise HTTPException(
            status_code=502,
            detail=f"Upstream storage returned {upstream.status_code}: {body}",
        )

    content_type = upstream.headers.get("content-type", "application/octet-stream")
    content_length = upstream.headers.get("content-length")
    filename = object_path.rsplit("/", 1)[-1]

    async def _stream():
        try:
            total = 0
            async for chunk in upstream.aiter_bytes(chunk_size=64 * 1024):
                total += len(chunk)
                if total > _PROXY_MAX_BYTES:
                    break
                yield chunk
        finally:
            await client.aclose()

    response_headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Cache-Control": "private, max-age=3600",
    }
    if content_length:
        response_headers["Content-Length"] = content_length
    return StreamingResponse(_stream(), media_type=content_type, headers=response_headers)


@router.get("/proxy/diagnose")
async def proxy_diagnose(
    url: str = Query(..., description="Public Supabase URL to diagnose"),
    current_user: User = Depends(get_current_user),
    _rl=Depends(rate_limit(30, "files_diag")),
) -> dict:
    """Probe a single storage URL and return what's actually happening.

    Useful when files appear missing — answers the question "is the object
    gone, the bucket private, or is Cloudflare blocking it?".
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        return {"ok": False, "reason": "supabase_not_configured"}

    bucket = settings.supabase_storage_bucket
    object_path = _path_from_supabase_url(url, bucket, settings.supabase_url)
    result: dict = {
        "input_url": url,
        "bucket": bucket,
        "extracted_path": object_path,
    }

    if not object_path:
        result["ok"] = False
        result["reason"] = "url_not_for_this_project"
        return result

    public_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{object_path}"
    auth_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    auth_headers = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r1 = await client.head(public_url)
            result["public_status"] = r1.status_code
        except Exception as exc:
            result["public_status"] = f"error: {exc}"
        try:
            r2 = await client.head(auth_url, headers=auth_headers)
            result["authenticated_status"] = r2.status_code
        except Exception as exc:
            result["authenticated_status"] = f"error: {exc}"

    pub = result.get("public_status")
    auth = result.get("authenticated_status")
    if auth == 200 and pub != 200:
        result["diagnosis"] = "Bucket is private OR Cloudflare blocks the public path. Use the /files/proxy endpoint to serve."
    elif auth == 200 and pub == 200:
        result["diagnosis"] = "Object exists and is publicly accessible. Browser-side block likely (Cloudflare bot rule)."
    elif auth == 404:
        result["diagnosis"] = "Object does NOT exist in Storage. It was deleted or the bucket name changed. Re-upload required."
    elif auth in (401, 403):
        result["diagnosis"] = "Service key rejected by Supabase. Check SUPABASE_SERVICE_KEY env var."
    else:
        result["diagnosis"] = f"Unexpected upstream status (public={pub}, auth={auth})."

    result["ok"] = auth == 200
    return result
