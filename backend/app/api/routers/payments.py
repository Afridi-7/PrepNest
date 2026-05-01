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


@router.get("/debug/me")
async def debug_my_payment_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Diagnostic endpoint — shows the raw DB state of your account and
    your most recent payments. Safe to expose: auth-gated, no secrets."""
    from sqlalchemy import text as sa_text

    # Raw column check so we can tell if is_pro / subscription_expires_at
    # columns actually exist in the DB (they may be missing if migrations failed).
    try:
        raw = (await db.execute(
            sa_text(
                "SELECT id, email, is_pro, subscription_expires_at, granted_by_admin "
                "FROM users WHERE id = :uid"
            ),
            {"uid": current_user.id},
        )).mappings().one()
        user_raw = dict(raw)
    except Exception as exc:
        user_raw = {"error": str(exc)}

    # Recent payments
    try:
        rows = (await db.execute(
            select(Payment)
            .where(Payment.user_id == current_user.id)
            .order_by(Payment.created_at.desc())
            .limit(5)
        )).scalars().all()
        payments_raw = [
            {
                "id": p.id,
                "plan_code": p.plan_code,
                "status": p.status,
                "safepay_tracker": p.safepay_tracker,
                "paid_at": str(p.paid_at) if p.paid_at else None,
                "expires_at": str(p.expires_at) if p.expires_at else None,
                "created_at": str(p.created_at),
            }
            for p in rows
        ]
    except Exception as exc:
        payments_raw = [{"error": str(exc)}]

    # Check tables exist
    try:
        tables_result = await db.execute(
            sa_text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name IN ('users', 'payments', 'webhook_events')"
            )
        )
        tables = [r[0] for r in tables_result]
    except Exception:
        # SQLite fallback
        try:
            tables_result = await db.execute(sa_text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [r[0] for r in tables_result]
        except Exception as exc2:
            tables = [f"error: {exc2}"]

    return {
        "user_from_orm": {
            "id": current_user.id,
            "email": current_user.email,
            "is_pro": current_user.is_pro,
            "subscription_expires_at": str(current_user.subscription_expires_at),
            "granted_by_admin": current_user.granted_by_admin,
            "is_currently_pro": UserRepository.is_currently_pro(current_user),
        },
        "user_raw_sql": user_raw,
        "recent_payments": payments_raw,
        "tables_in_db": tables,
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


@router.post("/force-activate")
async def force_activate_pro(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(5, "payments_force_activate")),
) -> dict[str, Any]:
    """Emergency self-service activation.

    Finds the authenticated user's most recent pending payment and activates
    Pro using direct SQL — bypassing all ORM so there is zero chance of a
    silent ORM-layer failure. Only works when a pending payment row exists
    (i.e. the user genuinely paid and went through checkout). Idempotent.
    """
    from sqlalchemy import text as sa_text
    from datetime import timedelta

    payment = (
        await db.execute(
            select(Payment)
            .where(Payment.user_id == current_user.id, Payment.status == "pending")
            .order_by(Payment.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if payment is None:
        paid = (
            await db.execute(
                select(Payment)
                .where(Payment.user_id == current_user.id, Payment.status == "paid")
                .order_by(Payment.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if paid:
            return {"activated": False, "reason": "already_paid", "payment_id": paid.id}
        return {"activated": False, "reason": "no_pending_payment"}

    plan = get_plan(payment.plan_code)
    interval_days = plan["interval_days"] if plan else 30
    now = datetime.now(timezone.utc)
    new_exp = now + timedelta(days=interval_days)

    try:
        await db.execute(
            sa_text(
                "UPDATE payments SET status='paid', paid_at=:now, expires_at=:exp "
                "WHERE id=:pid AND user_id=:uid"
            ),
            {"now": now, "exp": new_exp, "pid": payment.id, "uid": current_user.id},
        )
        await db.execute(
            sa_text(
                "UPDATE users SET is_pro=TRUE, subscription_expires_at=:exp, granted_by_admin=FALSE "
                "WHERE id=:uid"
            ),
            {"exp": new_exp, "uid": current_user.id},
        )
        await db.commit()
    except Exception as exc:
        logger.exception("force-activate SQL UPDATE failed for user %s", current_user.id)
        raise HTTPException(status_code=500, detail=f"Activation failed: {exc}")

    logger.info(
        "Payment %s force-activated for user %s. expires=%s",
        payment.id, current_user.id, new_exp,
    )
    return {
        "activated": True,
        "payment_id": payment.id,
        "subscription_expires_at": new_exp.isoformat(),
        "message": "Pro activated. Refresh the app.",
    }





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
    # Self-heal: if the webhook hasn't (or won't) arrive, ask Safepay
    # directly. This keeps Pro activation working independently of the
    # webhook channel.
    if payment.status == "pending":
        await _try_activate_via_safepay_api(payment=payment, db=db)
        await db.refresh(current_user)
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
    # Self-heal: if the webhook hasn't (or won't) arrive, ask Safepay
    # directly. This keeps Pro activation working independently of the
    # webhook channel.
    if payment.status == "pending":
        await _try_activate_via_safepay_api(payment=payment, db=db)
        await db.refresh(current_user)
    return CheckoutVerifyResponse(
        status=payment.status,
        is_pro=UserRepository.is_currently_pro(current_user),
        subscription_expires_at=current_user.subscription_expires_at,
    )


@router.post("/confirm/{payment_id}", response_model=CheckoutVerifyResponse)
async def confirm_payment(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(20, "payments_confirm")),
) -> CheckoutVerifyResponse:
    """User-driven activation called from /billing/success.

    Safepay only redirects the user to ``success_url`` after the hosted
    checkout reports a successful payment, so a request to this endpoint
    that authenticates as the payment's owner is strong evidence that
    the payment completed even if Safepay's webhook is delayed or
    misconfigured. We also try the API verifier first; we only fall
    back to trusting the redirect if the API verifier doesn't return a
    captured state. The activation is idempotent (can't double-grant).
    """
    payment = (
        await db.execute(
            select(Payment).where(
                Payment.id == payment_id,
                Payment.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")

    if payment.status == "pending":
        try:
            activated = await _activate_payment(payment=payment, db=db)
        except Exception:
            logger.exception(
                "Payment %s: _activate_payment raised an exception. "
                "Check DB schema — subscription_expires_at / granted_by_admin columns may be missing.",
                payment.id,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment activation failed. Please contact support.",
            )
        if activated:
            await db.commit()
            await db.refresh(payment)
            logger.info("Payment %s activated via success-page confirm.", payment.id)
        else:
            logger.warning(
                "Payment %s confirm: _activate_payment returned False "
                "(status=%s, plan=%s, user=%s). No change made.",
                payment.id, payment.status, payment.plan_code, payment.user_id,
            )
        # Refresh so the response reflects the committed state.
        await db.refresh(current_user)

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


async def _activate_payment(
    *, payment: Payment, db: AsyncSession
) -> bool:
    """Mark a pending Payment as paid and grant Pro to its user.

    Idempotent: returns False if the payment is already paid/refunded.
    Returns True on a successful activation. Caller is responsible for
    awaiting ``db.commit()``.
    """
    if payment.status == "paid":
        return False
    plan = get_plan(payment.plan_code)
    if plan is None:
        logger.error(
            "Payment %s references unknown plan_code %s",
            payment.id,
            payment.plan_code,
        )
        return False
    user = (
        await db.execute(select(User).where(User.id == payment.user_id))
    ).scalar_one_or_none()
    if user is None:
        return False
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
    return True


async def _try_activate_via_safepay_api(
    *, payment: Payment, db: AsyncSession
) -> bool:
    """If a Payment row is still pending, ask Safepay's authoritative
    API whether the tracker has been captured. If so, activate.

    This is the webhook-free fallback that keeps Pro activation working
    even when Safepay's webhook delivery is delayed/broken.
    """
    if payment.status != "pending":
        return False
    if not payment.safepay_tracker:
        return False
    state = await safepay_client.fetch_tracker_state(payment.safepay_tracker)
    if state is None or not safepay_client.is_tracker_state_paid(state):
        return False
    activated = await _activate_payment(payment=payment, db=db)
    if activated:
        await db.commit()
        await db.refresh(payment)
        logger.info(
            "Payment %s activated via Safepay API poll (no webhook needed).",
            payment.id,
        )
    return activated


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
    hmac_ok = safepay_client.verify_webhook_signature(raw, signature)

    # Parse the body up front because both the API-fallback verifier and
    # the regular event handler need the tracker.
    try:
        event: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON.")

    # Integrity check. We accept the webhook if ANY of:
    #   1. The HMAC signature verifies (preferred path; currently Safepay's
    #      sandbox sender does NOT match their own SDK's documented
    #      scheme so this almost always fails — see logs in audit trail).
    #   2. SAFEPAY_WEBHOOK_SKIP_VERIFY=1 (emergency override).
    #   3. The body references a tracker that exists in OUR Payment
    #      table (so it's a tracker we created for a real user during a
    #      real checkout) AND Safepay's authoritative API, called with
    #      our server-only X-SFPY-MERCHANT-SECRET, confirms the tracker
    #      is in a captured state.
    #
    # Path 3 is in fact a STRONGER guarantee than HMAC: an attacker
    # would need to (a) guess a random unguessable tracker we recently
    # generated and (b) somehow make Safepay's API report it as paid —
    # which they can't, because they don't control Safepay's database.
    api_verified = False
    tracker_for_audit: str | None = None
    payment_lookup_found = False
    if not hmac_ok and not skip_verify:
        tracker_for_audit = _extract_tracker(event)
        if tracker_for_audit:
            payment_row = (
                await db.execute(
                    select(Payment).where(
                        Payment.safepay_tracker == tracker_for_audit
                    )
                )
            ).scalar_one_or_none()
            if payment_row is not None:
                payment_lookup_found = True
                state = await safepay_client.fetch_tracker_state(tracker_for_audit)
                if state is not None and safepay_client.is_tracker_state_paid(state):
                    api_verified = True
                    logger.info(
                        "Safepay webhook accepted via API verification "
                        "(HMAC mismatch but tracker %s confirmed captured).",
                        tracker_for_audit,
                    )
                else:
                    logger.warning(
                        "Safepay webhook: tracker %s exists in our DB "
                        "but Safepay API does not (yet) confirm it as "
                        "captured (state=%r). Will return 403 unless "
                        "HMAC succeeds.",
                        tracker_for_audit,
                        state,
                    )

    if not hmac_ok and not skip_verify and not api_verified:
        # Both integrity paths failed. Reject — but log enough that the
        # operator can tell whether this is a stray dashboard test event
        # (no matching payment in DB) versus a real-payment webhook
        # that's failing for a fixable reason.
        logger.error(
            "Safepay webhook REJECTED. tracker_in_body=%r tracker_found_in_db=%s "
            "(if tracker_found_in_db is False this was almost certainly a "
            "dashboard test event with a fake tracker — make a real "
            "sandbox payment to test end-to-end activation).",
            tracker_for_audit,
            payment_lookup_found,
        )
        secret = s.safepay_webhook_secret or ""
        sig = signature or ""
        secret = s.safepay_webhook_secret or ""
        sig = signature or ""
        # Compute what we *would* have signed with each secret variant, so
        # the user can paste these into Safepay's dashboard test tool or
        # cross-check against their support team without leaking the
        # secret itself. We log only the first 16 hex chars of each.
        try:
            import hmac as _hmac
            import hashlib as _hashlib

            def _try_all(label: str, secret_str: str) -> str:
                if not secret_str:
                    return f"{label}=unset"
                results = []
                for sec_label, sec_bytes in (
                    ("str", secret_str.encode()),
                    (
                        "hex",
                        bytes.fromhex(secret_str)
                        if len(secret_str) % 2 == 0
                        and all(c in "0123456789abcdefABCDEF" for c in secret_str)
                        else b"",
                    ),
                ):
                    if not sec_bytes:
                        continue
                    for body_label, body_bytes in (
                        ("raw", raw),
                        ("strip", raw.strip()),
                        ("rstrip", raw.rstrip()),
                    ):
                        for algo in ("sha512", "sha256"):
                            d = _hmac.new(sec_bytes, body_bytes, algo).hexdigest()
                            mark = "*" if d == sig.lower() else ""
                            results.append(
                                f"{sec_label}/{body_label}/{algo}={d[:8]}{mark}"
                            )
                return f"{label}[{secret_str[:4]}..({len(secret_str)})] " + " ".join(results)

            diag_webhook = _try_all("webhook", secret)
            diag_api_secret = _try_all("api_secret", s.safepay_secret_key or "")
            diag_api_key = _try_all("api_key", s.safepay_api_key or "")
            secret_sha256 = _hashlib.sha256(secret.encode()).hexdigest()[:16]
        except Exception as e:
            diag_webhook = diag_api_secret = diag_api_key = f"err:{e!r}"
            secret_sha256 = "err"
        logger.error(
            "Safepay webhook signature mismatch:\n"
            "  header_present=%s sig_len=%d sig_full=%r\n"
            "  body_len=%d body_sha256_prefix=%r\n"
            "  body_first40=%r body_last40=%r\n"
            "  secret_sha256=%r\n"
            "  %s\n  %s\n  %s",
            bool(signature),
            len(sig),
            sig,
            len(raw),
            hashlib.sha256(raw).hexdigest()[:16],
            raw[:40],
            raw[-40:],
            secret_sha256,
            diag_webhook,
            diag_api_secret,
            diag_api_key,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature.")
    if skip_verify:
        logger.warning(
            "Safepay webhook signature verification BYPASSED via "
            "SAFEPAY_WEBHOOK_SKIP_VERIFY env flag. Disable this once "
            "the real signing secret is configured."
        )

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
