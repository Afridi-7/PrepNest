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


def _extract_token(payload: dict[str, Any], *, key: str) -> str | None:
    """Best-effort extraction of a token out of a Safepay response.

    Safepay wraps responses in a ``data`` envelope and nests resource
    objects (``tracker`` / ``passport``) inside it, e.g.::

        {"data": {"tracker": {"token": "track_xxx"}}}

    Some endpoints flatten this to a string. This helper walks the
    common shapes so callers don't have to."""
    if not isinstance(payload, dict):
        return None
    candidates: list[Any] = [
        payload.get(key),
        (payload.get("data") or {}).get(key) if isinstance(payload.get("data"), dict) else None,
    ]
    for c in candidates:
        if isinstance(c, str) and c:
            return c
        if isinstance(c, dict):
            tok = c.get("token") or c.get("tracker") or c.get("id")
            if isinstance(tok, str) and tok:
                return tok
    return None

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
        """True only when the credentials we actually use are configured.

        The real flow needs:
          * the **merchant API secret** (``safepay_secret_key``) — sent as
            ``X-SFPY-MERCHANT-SECRET`` on every request to authenticate the
            caller (this is the value the PHP SDK passes to its client
            constructor, NOT the webhook signing secret).
          * the **merchant API key** (``safepay_api_key``, the ``sec_…``
            value) — sent in the order request body as ``merchant_api_key``.

        ``safepay_webhook_secret`` is intentionally **not** required here:
        it is used only to verify HMAC signatures on incoming webhooks.
        """
        return bool(
            self.settings.safepay_api_key and self.settings.safepay_secret_key
        )

    async def _post_json(
        self,
        path: str,
        body: dict[str, Any] | None,
        *,
        timeout: float = 15.0,
    ) -> dict[str, Any]:
        """POST helper.

        The official Safepay PHP SDK authenticates EVERY request with a
        single header: ``X-SFPY-MERCHANT-SECRET: <merchant_api_secret>``
        — the value passed to ``new SafepayClient($apiKey)``. This is the
        merchant *API secret* from the Safepay dashboard (Developers → API
        Keys), **not** the webhook signing secret. The ``merchant_api_key``
        (the ``sec_…`` public key) is passed in the request body for
        endpoints that need it (e.g. ``/order/payments/v3/``).
        See https://github.com/getsafepay/sfpy-php/blob/main/lib/ApiRequestor.php
        """
        url = f"{self.settings.safepay_api_base}{path}"
        merchant_secret = self.settings.safepay_secret_key or ""
        headers = {
            "X-SFPY-MERCHANT-SECRET": merchant_secret,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=timeout) as http:
                resp = await http.post(url, json=body, headers=headers)
        except httpx.HTTPError as exc:
            logger.exception("Safepay network error on %s", path)
            raise SafepayError("Payment provider is temporarily unavailable.") from exc

        if resp.status_code >= 400:
            logger.error("Safepay %s failed: %s %s", path, resp.status_code, resp.text[:500])
            # Help the operator self-diagnose key-mapping mistakes without
            # ever leaking the actual values into logs.
            if body and "merchant_api_key" in body:
                key_val = body["merchant_api_key"] or ""
                logger.error(
                    "merchant_api_key shape: len=%d prefix=%r looks_like_uuid_format=%s",
                    len(key_val),
                    key_val[:4],
                    key_val.startswith("sec_") and len(key_val) >= 30,
                )
            raise SafepayError(
                f"Safepay rejected the request to {path} (HTTP {resp.status_code})."
            )

        try:
            return resp.json() or {}
        except ValueError as exc:
            logger.error("Safepay non-JSON response on %s: %s", path, resp.text[:200])
            raise SafepayError("Invalid response from payment provider.") from exc

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

        Implements the documented flow used by Safepay's official PHP SDK
        (https://github.com/getsafepay/sfpy-php):

        1. ``POST /order/payments/v3/`` with ``{merchant_api_key, intent,
           mode, currency, amount}`` → returns a tracker token.
        2. ``POST /client/passport/v1/token`` → returns a Time-Based Token
           (TBT) that authorises the hosted checkout page to load.
        3. Build the hosted checkout URL with ``environment``, ``tracker``,
           ``source=custom`` and ``tbt`` query params.

        Returns: ``{"tracker": <str>, "redirect_url": <str>}``.
        """
        if not self.is_live:
            # Deterministic mock tracker for local dev / tests.
            tracker = f"mock_{secrets.token_hex(12)}"
            redirect = (
                f"{self.settings.safepay_checkout_base}/embedded"
                f"?environment={self.settings.safepay_env}"
                f"&tracker={tracker}&source=custom&tbt=mock"
            )
            return {"tracker": tracker, "redirect_url": redirect}

        # 1. Create the order / get a tracker.
        order_body: dict[str, Any] = {
            "merchant_api_key": self.settings.safepay_api_key,
            "intent": "CYBERSOURCE",
            "mode": "payment",
            "currency": plan["currency"],
            "amount": plan["price_minor"],  # already in minor units
        }
        order_data = await self._post_json("/order/payments/v3/", order_body)
        tracker = _extract_token(order_data, key="tracker")
        if not tracker:
            logger.error("Safepay order response missing tracker: %s", order_data)
            raise SafepayError("Invalid response from payment provider.")

        # 2. Get a Time-Based Token (TBT) for the hosted checkout page.
        passport_data = await self._post_json("/client/passport/v1/token", None)
        tbt = _extract_token(passport_data, key="passport") or _extract_token(
            passport_data, key="token"
        )
        # Sometimes the API returns the token as a bare string under "data".
        if not tbt:
            raw = passport_data.get("data")
            if isinstance(raw, str):
                tbt = raw
        if not tbt:
            logger.error("Safepay passport response missing token: %s", passport_data)
            raise SafepayError("Invalid response from payment provider.")

        # 3. Build the hosted-checkout URL exactly like the official SDK.
        from urllib.parse import urlencode

        params = urlencode(
            {
                "environment": self.settings.safepay_env,
                "tracker": tracker,
                "source": "custom",
                "tbt": tbt,
                "redirect_url": success_url,
                "cancel_url": cancel_url,
            }
        )
        redirect = f"{self.settings.safepay_checkout_base}/embedded?{params}"
        return {"tracker": str(tracker), "redirect_url": redirect}

    # ── Webhook signature verification ────────────────────────────────────

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str | None) -> bool:
        """Verify the ``X-SFPY-SIGNATURE`` HMAC on the raw webhook body.

        Safepay's official PHP SDK signs webhooks with **HMAC-SHA512** —
        see https://github.com/getsafepay/sfpy-php/blob/main/lib/WebhookSignature.php
        We accept the signature in either ``x-sfpy-signature`` or
        ``x-sfpy-merchant-signature`` (some older deliveries used the
        latter) and tolerate an optional ``sha512=`` prefix. As a
        belt-and-braces measure we also check SHA-256 in case Safepay
        ever rotates the algorithm — both comparisons are constant-time.
        """
        raw_secret = (self.settings.safepay_webhook_secret or "").strip()
        if not raw_secret or not signature_header:
            return False
        provided = signature_header.split("=", 1)[-1].strip().lower()
        # Try secret as a string of bytes (PHP SDK style) AND as the
        # hex-decoded raw bytes. 64-char hex secrets are ambiguous —
        # different SDKs interpret them differently.
        secret_variants: list[bytes] = [raw_secret.encode()]
        try:
            if len(raw_secret) % 2 == 0:
                secret_variants.append(bytes.fromhex(raw_secret))
        except ValueError:
            pass

        # Build every plausible payload variant. Safepay's sender,
        # Render's proxy, or any intermediate layer can mutate the body
        # in subtle ways (trailing newline, whitespace, BOM, JSON
        # re-encoding). We enumerate them all and accept any match.
        payload_variants: list[bytes] = [raw_body]
        # Strip trailing whitespace/newlines (the most common cause)
        stripped = raw_body.rstrip()
        if stripped != raw_body:
            payload_variants.append(stripped)
        # Strip leading whitespace too
        fully_stripped = raw_body.strip()
        if fully_stripped not in payload_variants:
            payload_variants.append(fully_stripped)
        # Strip a UTF-8 BOM if present
        if raw_body.startswith(b"\xef\xbb\xbf"):
            payload_variants.append(raw_body[3:])
        # JSON re-encoded variants (compact, with-spaces, slash-escaped,
        # slash-unescaped) — covers PHP json_encode default vs
        # JSON_UNESCAPED_SLASHES vs JS JSON.stringify
        try:
            import json

            decoded = json.loads(raw_body.decode("utf-8"))
            payload_variants.extend(
                v.encode("utf-8")
                for v in (
                    json.dumps(decoded, separators=(",", ":"), ensure_ascii=False),
                    json.dumps(decoded, separators=(",", ":"), ensure_ascii=True),
                    json.dumps(decoded, separators=(", ", ": "), ensure_ascii=False),
                    json.dumps(decoded),  # default sep `, ` `: `
                    # PHP json_encode default escapes forward slashes
                    json.dumps(decoded, separators=(",", ":")).replace("/", r"\/"),
                )
            )
        except Exception:
            pass

        for secret in secret_variants:
            for payload in payload_variants:
                for algo in ("sha512", "sha256"):
                    expected = hmac.new(secret, payload, algo).hexdigest()
                    if hmac.compare_digest(expected, provided):
                        return True
        return False


# Module-level singleton so routers can ``from .. import safepay``.
safepay_client = SafepayClient()
