import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _get_sender(self) -> str:
        if self.settings.smtp_from_address:
            return self.settings.smtp_from_address
        if self.settings.smtp_username:
            return self.settings.smtp_username
        raise RuntimeError("SMTP sender is not configured")

    def _get_resend_sender(self) -> str:
        if self.settings.resend_from_email:
            return self.settings.resend_from_email
        return self._get_sender()

    def _build_verification_bodies(
        self,
        recipient_email: str,
        verification_url: str,
        full_name: str | None = None,
    ) -> tuple[str, str, str]:
        recipient_name = full_name.strip() if full_name else recipient_email
        subject = "Verify your PrepNest email address"
        text_body = (
            f"Hi {recipient_name},\n\n"
            "Finish creating your PrepNest account by verifying your email address.\n\n"
            f"Verify here: {verification_url}\n\n"
            "If you did not request this, you can ignore this email.\n"
        )
        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <p>Hi {recipient_name},</p>
            <p>Finish creating your PrepNest account by verifying your email address.</p>
            <p>
              <a href="{verification_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                Verify Email
              </a>
            </p>
            <p style="word-break: break-all;">If the button does not work, copy this link:<br>{verification_url}</p>
            <p>If you did not request this, you can ignore this email.</p>
          </body>
        </html>
        """
        return subject, text_body, html_body

    def _build_verification_message(
        self,
        recipient_email: str,
        verification_url: str,
        full_name: str | None = None,
    ) -> EmailMessage:
        message = EmailMessage()
        sender_name = self.settings.smtp_from_name.strip() or "PrepNest"
        sender_address = self._get_sender()
        subject, text_body, html_body = self._build_verification_bodies(recipient_email, verification_url, full_name)

        message["From"] = f"{sender_name} <{sender_address}>"
        message["To"] = recipient_email
        message["Subject"] = subject

        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")
        return message

    def _resolve_provider(self) -> str:
        provider = self.settings.email_provider.strip().lower()
        if provider not in {"auto", "smtp", "resend"}:
            raise RuntimeError("EMAIL_PROVIDER must be one of: auto, smtp, resend")

        if provider == "auto":
            return "resend" if self.settings.resend_api_key else "smtp"

        if provider == "resend" and not self.settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is required when EMAIL_PROVIDER is resend")

        return provider

    def _send_message(self, message: EmailMessage) -> None:
        context = ssl.create_default_context()
        timeout_seconds = max(5, self.settings.smtp_timeout_seconds)

        def _send_via_smtps(port: int) -> None:
            with smtplib.SMTP_SSL(self.settings.smtp_host, port, context=context, timeout=timeout_seconds) as client:
                if self.settings.smtp_username and self.settings.smtp_password:
                    client.login(self.settings.smtp_username, self.settings.smtp_password)
                refused = client.send_message(message)
                if refused:
                    raise RuntimeError("SMTP server rejected recipient address")

        if self.settings.smtp_use_tls:
            try:
                with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=timeout_seconds) as client:
                    client.ehlo()
                    client.starttls(context=context)
                    client.ehlo()
                    if self.settings.smtp_username and self.settings.smtp_password:
                        client.login(self.settings.smtp_username, self.settings.smtp_password)
                    refused = client.send_message(message)
                    if refused:
                        raise RuntimeError("SMTP server rejected recipient address")
                    return
            except Exception as starttls_error:
                if not self.settings.smtp_allow_ssl_fallback:
                    raise

                fallback_port = self.settings.smtp_ssl_fallback_port
                logger.warning(
                    "STARTTLS delivery failed; retrying with SMTPS on port %s: %s",
                    fallback_port,
                    starttls_error,
                )
                _send_via_smtps(fallback_port)
                return

        _send_via_smtps(self.settings.smtp_port)

    async def _send_via_resend(
        self,
        recipient_email: str,
        verification_url: str,
        full_name: str | None = None,
    ) -> None:
        if not self.settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")

        sender_name = self.settings.smtp_from_name.strip() or "PrepNest"
        sender_address = self._get_resend_sender()
        subject, text_body, html_body = self._build_verification_bodies(recipient_email, verification_url, full_name)

        payload = {
            "from": f"{sender_name} <{sender_address}>",
            "to": [recipient_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }
        headers = {
            "Authorization": f"Bearer {self.settings.resend_api_key}",
            "Content-Type": "application/json",
        }

        timeout_seconds = max(5, self.settings.smtp_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(self.settings.resend_api_base_url, headers=headers, json=payload)

        if response.status_code >= 300:
            raise RuntimeError(f"Resend API error ({response.status_code}): {response.text}")

    async def send_verification_email(
        self,
        recipient_email: str,
        verification_url: str,
        full_name: str | None = None,
    ) -> None:
        provider = self._resolve_provider()
        max_retries = max(1, self.settings.smtp_max_retries)
        backoff_seconds = max(0.2, self.settings.smtp_retry_backoff_seconds)
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                if provider == "resend":
                    await self._send_via_resend(recipient_email, verification_url, full_name)
                else:
                    message = self._build_verification_message(recipient_email, verification_url, full_name)
                    await asyncio.to_thread(self._send_message, message)
                logger.info("Verification email sent to %s", recipient_email)
                return
            except Exception as error:
                last_error = error
                logger.warning(
                    "Verification email attempt %s/%s failed for %s via %s: %s",
                    attempt,
                    max_retries,
                    recipient_email,
                    provider,
                    error,
                )
                if attempt < max_retries:
                    await asyncio.sleep(backoff_seconds * (2 ** (attempt - 1)))

        raise RuntimeError("Verification email delivery failed") from last_error


email_service = EmailService()
