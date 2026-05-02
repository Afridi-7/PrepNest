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


# ─────────────────────────────────────────────────────────────────────────────
# PDF / file proxy
#
# IMPORTANT: these routes must be defined BEFORE the /{file_id} wildcard
# routes below, otherwise FastAPI will match /proxy as file_id="proxy" and
# require an Authorization header (get_current_user), causing 401 errors
# when the browser iframe loads the URL (iframes cannot send custom headers).
# ─────────────────────────────────────────────────────────────────────────────

# Maximum bytes to stream — defensive ceiling so this can't be abused as an
# open proxy. 100 MB is well above any past-paper PDF size in practice.
_PROXY_MAX_BYTES = 100 * 1024 * 1024


def _path_from_supabase_url(url: str, bucket: str, supabase_base: str) -> str | None:
    """Extract the storage object key from a Supabase public/signed URL."""
    if not url or not supabase_base:
        return None
    base = supabase_base.rstrip("/")
    public_prefix = f"{base}/storage/v1/object/public/{bucket}/"
    if url.startswith(public_prefix):
        return url[len(public_prefix):]
    auth_prefix = f"{base}/storage/v1/object/{bucket}/"
    if url.startswith(auth_prefix):
        return url[len(auth_prefix):]
    if not url.startswith(("http://", "https://")):
        return url.lstrip("/")
    return None


@router.get("/proxy")
async def proxy_storage_object(
    url: str = Query(..., description="Public Supabase URL or bucket-relative path"),
    token: str | None = Query(None, description="Auth token (alternative to Authorization header)"),
    _rl=Depends(rate_limit(60, "files_proxy")),
):
    """Stream a Supabase Storage object back to the caller.

    Auth: Bearer token in Authorization header OR ?token= query param.
    The ?token= form is required when called from fetch() on the frontend
    (Authorization headers work fine there) — kept for backward compat.
    """
    from app.core.security import decode_access_token
    from fastapi import Request as _FastAPIRequest  # noqa: F401

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

    # Mimic a real browser request — some Supabase/Cloudflare CDN configs block
    # requests that expose Python/httpx user-agent strings even when the
    # Authorization and apikey headers are present.
    headers["User-Agent"] = (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
    headers["Accept"] = "application/pdf,application/octet-stream,*/*"

    client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
    try:
        upstream = await client.get(fetch_url, headers=headers)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Storage fetch failed: {exc}")

    if upstream.status_code == 404:
        await client.aclose()
        raise HTTPException(status_code=404, detail="File not found in Supabase Storage.")
    if upstream.status_code >= 400:
        body = upstream.text[:200]
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Upstream storage returned {upstream.status_code}: {body}")

    # Detect Cloudflare/WAF security-block pages that are returned with HTTP 200
    # but have an HTML body (e.g. JS challenge or "This content is blocked" pages).
    # Streaming HTML back would let the frontend silently create a blob URL from
    # the HTML, causing "This content is blocked" to appear inside the PDF iframe.
    upstream_ct = upstream.headers.get("content-type", "application/octet-stream").lower()
    if "text/html" in upstream_ct:
        preview = upstream.text[:300]
        await client.aclose()
        raise HTTPException(
            status_code=502,
            detail=f"Storage returned an HTML page instead of a file (WAF/security block?). Preview: {preview[:150]}",
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
    """Probe a single storage URL and return what's actually happening."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        return {"ok": False, "reason": "supabase_not_configured"}

    bucket = settings.supabase_storage_bucket
    object_path = _path_from_supabase_url(url, bucket, settings.supabase_url)
    result: dict = {"input_url": url, "bucket": bucket, "extracted_path": object_path}

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
        result["diagnosis"] = "Bucket is private OR Cloudflare blocks the public path."
    elif auth == 200 and pub == 200:
        result["diagnosis"] = "Object exists and is publicly accessible."
    elif auth == 404:
        result["diagnosis"] = "Object does NOT exist in Storage."
    elif auth in (401, 403):
        result["diagnosis"] = "Service key rejected by Supabase."
    else:
        result["diagnosis"] = f"Unexpected upstream status (public={pub}, auth={auth})."

    result["ok"] = auth == 200
    return result


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
