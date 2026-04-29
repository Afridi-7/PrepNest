"""Safepay integration service.

Encapsulates all I/O with the Safepay REST API and the HMAC-SHA256
signature scheme used to authenticate webhook deliveries. Kept narrowly
scoped so the rest of the codebase never imports ``httpx`` directly for
payments — easier to mock in tests, easier to swap providers later.

Security notes:
  * The webhook secret must NEVER appear in responses or logs. Verification
    uses :func:`hmac.compare_digest` which is constant-time.
  * The amount + plan are resolved server-side from ``plan_code`` before
    creating the order; we never trust a price supplied by the client.
  * In sandbox / dev with no API key configured, the client falls back to
    a deterministic mock tracker so the local UI flow is exercisable
    without hitting the Safepay sandbox network.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.plans import PlanDef

logger = logging.getLogger(__name__)


class SafepayError(Exception):
    """Raised when Safepay returns an error or the response is malformed."""


class SafepayClient:
    """Thin wrapper around the Safepay REST API."""

    def __init__(self, *, settings=None) -> None:
        # Stored only as an explicit override (used by tests). In normal
        # operation we fetch fresh settings on every call so env-based
        # rotation / lazy-loaded test configuration is picked up without
        # rebuilding this module-level singleton.
        self._override = settings

    @property
    def settings(self):
        return self._override or get_settings()

    @property
    def is_live(self) -> bool:
        """True only when both keys are configured. In dev/test we fall back
        to a mock flow so contributors don't need real Safepay credentials."""
        return bool(self.settings.safepay_secret_key and self.settings.safepay_api_key)

    async def create_checkout(
        self,
        *,
        plan: PlanDef,
        user_email: str,
        user_id: str,
        cancel_url: str,
        success_url: str,
        client_ref: str,
    ) -> dict[str, str]:
        """Create a Safepay checkout session and return the redirect URL.

        Returns: ``{"tracker": <str>, "redirect_url": <str>}``.
        """
        if not self.is_live:
            # Deterministic mock tracker for local dev / tests.
            tracker = f"mock_{secrets.token_hex(12)}"
            redirect = (
                f"{self.settings.safepay_checkout_base}/embedded/?env={self.settings.safepay_env}"
                f"&tracker={tracker}&source=hosted"
            )
            return {"tracker": tracker, "redirect_url": redirect}

        body: dict[str, Any] = {
            "client": {
                "amount": plan["price_minor"],
                "currency": plan["currency"],
                "environment": self.settings.safepay_env,
                "intent": "PAYMENT",
                "metadata": {
                    "plan_code": plan["code"],
                    "user_id": user_id,
                    "client_ref": client_ref,
                },
            },
            "customer": {"email": user_email},
            "redirect_urls": {
                "success": success_url,
                "cancel": cancel_url,
            },
        }
        url = f"{self.settings.safepay_api_base}/order/v1/init"
        headers = {
            "Authorization": f"Bearer {self.settings.safepay_secret_key}",
            "X-SFPY-MERCHANT-API-KEY": self.settings.safepay_api_key,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                resp = await http.post(url, json=body, headers=headers)
        except httpx.HTTPError as exc:
            logger.exception("Safepay network error")
            raise SafepayError("Payment provider is temporarily unavailable.") from exc

        if resp.status_code >= 400:
            # Never echo the Safepay error body back to the client verbatim — log it and surface a generic error.
            logger.error("Safepay init failed: %s %s", resp.status_code, resp.text[:500])
            raise SafepayError("Could not initiate checkout. Please try again.")

        data = resp.json() or {}
        tracker = (
            data.get("tracker")
            or (data.get("data") or {}).get("tracker")
            or data.get("token")
        )
        if not tracker:
            logger.error("Safepay response missing tracker: %s", data)
            raise SafepayError("Invalid response from payment provider.")

        redirect = (
            f"{self.settings.safepay_checkout_base}/embedded/?env={self.settings.safepay_env}"
            f"&tracker={tracker}&source=hosted"
        )
        return {"tracker": str(tracker), "redirect_url": redirect}

    # ── Webhook signature verification ────────────────────────────────────

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str | None) -> bool:
        """Verify HMAC-SHA256 signature on the raw webhook body.

        Safepay sends the signature as a hex digest in either
        ``x-sfpy-signature`` or ``x-sfpy-merchant-signature``. We accept
        either header. Comparison is constant-time.
        """
        secret = (self.settings.safepay_webhook_secret or "").encode()
        if not secret or not signature_header:
            return False
        expected = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
        # Strip any algorithm prefix like "sha256=" if Safepay adds one.
        provided = signature_header.split("=", 1)[-1].strip().lower()
        return hmac.compare_digest(expected, provided)


# Module-level singleton so routers can ``from .. import safepay``.
safepay_client = SafepayClient()
