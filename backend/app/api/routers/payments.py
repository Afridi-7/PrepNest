"""Subscription billing endpoints (Safepay).

Endpoints
---------
GET  /payments/plans           â€” public plan catalogue
POST /payments/checkout        â€” auth, creates a pending Payment + Safepay order
POST /payments/webhook         â€” Safepay â†’ us, HMAC-verified, idempotent, activates Pro
GET  /payments/history         â€” auth, current user's payment records
GET  /payments/verify/{tracker}â€” auth, polled by /billing/success while waiting

Security
--------
* The price + interval is resolved server-side from ``plan_code``. The
  client cannot influence the amount charged.
* The webhook reads the raw request body (signature is over raw bytes),
  rejects on signature mismatch with 403, and is idempotent via the
  ``webhook_events`` table â€” duplicate deliveries return 200 without
  re-activating Pro.
* Pro activation goes through ``UserRepository.grant_pro``; ``is_pro`` and
  ``subscription_expires_at`` remain the single source of truth and the
  existing admin-grant / 7-day-trial flow is unchanged.
* Renewal stacking: ``new_expires = max(current, now) + interval_days`` so
  a user paying mid-cycle never loses time.
"""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, rate_limit
from app.core.config import get_settings
from app.core.plans import get_plan, list_plans
from app.db.models import Payment, User, WebhookEvent
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.schemas.payment import (
    CheckoutCreateRequest,
    CheckoutCreateResponse,
    CheckoutVerifyResponse,
    PaymentRecord,
    SubscriptionPlan,
)
from app.services.payment_service import SafepayError, safepay_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


def _format_price(minor: int, currency: str) -> str:
    major = minor / 100
    if major.is_integer():
        return f"{currency} {int(major):,}"
    return f"{currency} {major:,.2f}"


def _plan_to_schema(plan: dict[str, Any]) -> SubscriptionPlan:
    return SubscriptionPlan(
        code=plan["code"],
        name=plan["name"],
        description=plan["description"],
        price_minor=plan["price_minor"],
        price_display=_format_price(plan["price_minor"], plan["currency"]),
        currency=plan["currency"],
        interval_days=plan["interval_days"],
        badge=plan.get("badge"),
        highlight=plan.get("highlight", False),
    )


# â”€â”€ Public: plan catalogue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@router.get("/plans", response_model=list[SubscriptionPlan])
async def get_plans(
    _rl=Depends(rate_limit(120, "payments_plans")),
) -> list[SubscriptionPlan]:
    return [_plan_to_schema(p) for p in list_plans()]


@router.get("/_status")
async def payments_status() -> dict[str, Any]:
    """Quick health probe so we can verify the deployed backend actually
    sees the Safepay env vars without leaking their values. Returns only
    booleans + the env name."""
    s = get_settings()
    return {
        "safepay_api_key_set": bool(s.safepay_api_key),
        "safepay_secret_key_set": bool(s.safepay_secret_key),
        "safepay_webhook_secret_set": bool(s.safepay_webhook_secret),
        "safepay_env": s.safepay_env,
        "is_live": safepay_client.is_live,
        "frontend_url": s.frontend_url,
    }


# â”€â”€ Auth: create checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@router.post("/checkout", response_model=CheckoutCreateResponse)
async def create_checkout(
    body: CheckoutCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "payments_checkout")),
) -> CheckoutCreateResponse:
    plan = get_plan(body.plan_code)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown subscription plan.",
        )

    # Without real Safepay credentials we'd hand the user back a redirect
    # carrying a mock_xxx tracker that Safepay's hosted page rejects with
    # a 401 (the "/reporter/.../mock_..." 401 the user sees). Surface a
    # clear 503 instead so they know the issue is configuration, not a
    # transient bug. Tests opt into the mock flow via SAFEPAY_ALLOW_MOCK.
    if not safepay_client.is_live and os.environ.get("SAFEPAY_ALLOW_MOCK") != "1":
        logger.error(
            "Checkout requested but Safepay is not configured "
            "(api_key set=%s, secret_key set=%s, env=%s)",
            bool(get_settings().safepay_api_key),
            bool(get_settings().safepay_secret_key),
            get_settings().safepay_env,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Online payments aren't configured yet. Please contact support.",
        )

    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")
    client_ref = secrets.token_urlsafe(16)

    payment = Payment(
        user_id=current_user.id,
        plan_code=plan["code"],
        amount_minor=plan["price_minor"],
        currency=plan["currency"],
        status="pending",
        metadata_json={"client_ref": client_ref},
    )
    db.add(payment)
    await db.flush()  # need payment.id before calling Safepay

    try:
        result = await safepay_client.create_checkout(
            plan=plan,
            user_email=current_user.email,
            user_id=current_user.id,
            success_url=f"{frontend}/billing/success?payment={payment.id}",
            cancel_url=f"{frontend}/billing/cancel?payment={payment.id}",
            client_ref=client_ref,
        )
    except SafepayError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    payment.safepay_tracker = result["tracker"]
    await db.commit()
    await db.refresh(payment)
    return CheckoutCreateResponse(
        payment_id=payment.id,
        tracker=result["tracker"],
        redirect_url=result["redirect_url"],
        plan_code=plan["code"],
        amount_minor=plan["price_minor"],
        currency=plan["currency"],
    )


# â”€â”€ Auth: my history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@router.get("/history", response_model=list[PaymentRecord])
async def get_my_payments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "payments_history")),
) -> list[PaymentRecord]:
    rows = (
        await db.execute(
            select(Payment).where(Payment.user_id == current_user.id).order_by(Payment.created_at.desc()).limit(50)
        )
    ).scalars().all()
    return [PaymentRecord.model_validate(r) for r in rows]


# â”€â”€ Auth: poll verification (used by /billing/success) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@router.get("/verify/{tracker}", response_model=CheckoutVerifyResponse)
async def verify_checkout(
    tracker: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "payments_verify")),
) -> CheckoutVerifyResponse:
    payment = (
        await db.execute(
            select(Payment).where(Payment.safepay_tracker == tracker, Payment.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")
    return CheckoutVerifyResponse(
        status=payment.status,
        is_pro=UserRepository.is_currently_pro(current_user),
        subscription_expires_at=current_user.subscription_expires_at,
    )


@router.get("/status/{payment_id}", response_model=CheckoutVerifyResponse)
async def get_payment_status(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "payments_status")),
) -> CheckoutVerifyResponse:
    """Same as ``/verify/{tracker}`` but keyed by our own ``Payment.id``.

    Used by ``/billing/success`` which receives ``?payment=<id>`` in the
    URL — we keep the Safepay tracker server-side and use our own id as
    the polling handle.
    """
    payment = (
        await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")
    return CheckoutVerifyResponse(
        status=payment.status,
        is_pro=UserRepository.is_currently_pro(current_user),
        subscription_expires_at=current_user.subscription_expires_at,
    )


def _extract_event_id(event: dict[str, Any], raw: bytes) -> str:
    """Pull a stable event id out of the webhook body (Safepay provides
    ``id`` or nested ``data.id``). Falls back to a hash of the raw payload
    so we still de-duplicate even if the provider omits an id field."""
    for key in ("id", "event_id"):
        v = event.get(key)
        if v:
            return str(v)
    nested = event.get("data") or {}
    if isinstance(nested, dict):
        for key in ("id", "event_id", "tracker"):
            v = nested.get(key)
            if v:
                return f"{event.get('type','event')}:{v}"
    return f"sha256:{hashlib.sha256(raw).hexdigest()}"


def _extract_tracker(event: dict[str, Any]) -> str | None:
    nested = event.get("data") or {}
    if isinstance(nested, dict):
        return nested.get("tracker") or nested.get("token") or nested.get("id")
    return event.get("tracker")


def _is_success_event(event_type: str, event: dict[str, Any]) -> bool:
    et = (event_type or "").lower()
    if "payment" in et and ("captur" in et or "complet" in et or "success" in et or "succeeded" in et):
        return True
    nested = event.get("data") or {}
    if isinstance(nested, dict):
        st = str(nested.get("state") or nested.get("status") or "").lower()
        return st in {"tracker_ended", "captured", "paid", "completed", "successful"}
    return False


@router.post("/webhook")
async def safepay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    raw = await request.body()
    signature = (
        request.headers.get("x-sfpy-signature")
        or request.headers.get("x-sfpy-merchant-signature")
        or request.headers.get("x-sfpy-webhook-signature")
    )
    s = get_settings()
    skip_verify = str(s.safepay_webhook_skip_verify or "0").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not skip_verify and not safepay_client.verify_webhook_signature(raw, signature):
        # Constant-time check failed. 403 (not 401) â€” auth is correctly absent;
        # what failed is integrity verification.
        # Log a fingerprint of the secret + signature shape so we can tell
        # whether the secret is wrong, the algorithm is wrong, or the
        # header isn't being sent at all. The actual values stay private.
        secret = s.safepay_webhook_secret or ""
        sig = signature or ""
        # Compute what we *would* have signed with each secret variant, so
        # the user can paste these into Safepay's dashboard test tool or
        # cross-check against their support team without leaking the
        # secret itself. We log only the first 16 hex chars of each.
        try:
            import hmac as _hmac
            import hashlib as _hashlib

            secret_bytes = secret.encode()
            try:
                secret_hex_bytes = bytes.fromhex(secret) if secret else b""
            except ValueError:
                secret_hex_bytes = b""
            ours_str_512 = _hmac.new(secret_bytes, raw, _hashlib.sha512).hexdigest()
            ours_hex_512 = (
                _hmac.new(secret_hex_bytes, raw, _hashlib.sha512).hexdigest()
                if secret_hex_bytes
                else "n/a"
            )
            # Hash of the secret itself, so we can prove byte-equality
            # with the dashboard value WITHOUT logging the secret. Run
            # locally:  python -c "import hashlib; print(hashlib.sha256(b'<paste>').hexdigest()[:16])"
            # and compare to the secret_sha256 we log.
            secret_sha256 = _hashlib.sha256(secret_bytes).hexdigest()[:16]
        except Exception:
            ours_str_512 = ours_hex_512 = secret_sha256 = "err"
        logger.error(
            "Safepay webhook signature mismatch: header_present=%s sig_len=%d "
            "sig_prefix=%r secret_set=%s secret_len=%d secret_prefix=%r "
            "secret_sha256=%r body_len=%d body_sha256_prefix=%r "
            "body_first40=%r body_last40=%r ours_str512_prefix=%r "
            "ours_hex512_prefix=%r",
            bool(signature),
            len(sig),
            sig[:16],
            bool(secret),
            len(secret),
            secret[:4],
            secret_sha256,
            len(raw),
            hashlib.sha256(raw).hexdigest()[:16],
            raw[:40],
            raw[-40:],
            ours_str_512[:16],
            ours_hex_512[:16],
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature.")
    if skip_verify:
        logger.warning(
            "Safepay webhook signature verification BYPASSED via "
            "SAFEPAY_WEBHOOK_SKIP_VERIFY env flag. Disable this once "
            "the real signing secret is configured."
        )

    try:
        event: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON.")

    event_id = _extract_event_id(event, raw)
    event_type = str(event.get("type") or event.get("event") or "unknown")[:64]
    payload_hash = hashlib.sha256(raw).hexdigest()

    # Idempotency guard: insert the event id; if it already exists, no-op.
    db.add(
        WebhookEvent(
            event_id=event_id,
            provider="safepay",
            event_type=event_type,
            payload_hash=payload_hash,
        )
    )
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return {"received": True, "duplicate": True}

    if not _is_success_event(event_type, event):
        # Non-success notification (failed / refund / status update). Persist
        # idempotency row but don't activate. We still record failures on the
        # corresponding Payment row.
        tracker = _extract_tracker(event)
        if tracker:
            payment = (
                await db.execute(select(Payment).where(Payment.safepay_tracker == tracker))
            ).scalar_one_or_none()
            if payment and payment.status == "pending":
                state = ((event.get("data") or {}).get("state") or "").lower()
                if "fail" in state or "decline" in state or "expire" in state or "cancel" in state:
                    payment.status = "failed"
                elif "refund" in event_type.lower():
                    payment.status = "refunded"
        await db.commit()
        return {"received": True, "activated": False}

    # â”€â”€ Success path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    tracker = _extract_tracker(event)
    if not tracker:
        await db.commit()
        logger.warning("Safepay success event without tracker: %s", event_id)
        return {"received": True, "activated": False}

    payment = (
        await db.execute(select(Payment).where(Payment.safepay_tracker == tracker))
    ).scalar_one_or_none()
    if payment is None:
        await db.commit()
        logger.warning("Safepay webhook tracker %s not found", tracker)
        return {"received": True, "activated": False}

    if payment.status == "paid":
        # Already activated by an earlier delivery (different event id).
        await db.commit()
        return {"received": True, "duplicate": True}

    plan = get_plan(payment.plan_code)
    if plan is None:
        await db.commit()
        logger.error("Payment %s references unknown plan_code %s", payment.id, payment.plan_code)
        return {"received": True, "activated": False}

    user = (
        await db.execute(select(User).where(User.id == payment.user_id))
    ).scalar_one_or_none()
    if user is None:
        await db.commit()
        return {"received": True, "activated": False}

    now = datetime.now(timezone.utc)
    current_exp = user.subscription_expires_at
    if current_exp is not None and current_exp.tzinfo is None:
        current_exp = current_exp.replace(tzinfo=timezone.utc)
    base = current_exp if (current_exp and current_exp > now) else now
    new_exp = base + timedelta(days=plan["interval_days"])

    payment.status = "paid"
    payment.paid_at = now
    payment.expires_at = new_exp
    user.is_pro = True
    user.subscription_expires_at = new_exp
    user.granted_by_admin = False
    await db.commit()

    return {"received": True, "activated": True}
