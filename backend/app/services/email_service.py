import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _resend_configured() -> bool:
    settings = get_settings()
    return bool(settings.resend_api_key and settings.resend_from_email)


def send_verification_email(to_email: str, verification_url: str) -> bool:
    """Send a verification email via Resend. Returns True on success."""
    settings = get_settings()

    if not _resend_configured():
        logger.warning("Resend not configured – skipping verification email to %s", to_email)
        return False

    html_body = f"""\
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #7c3aed; margin: 0;">PrepNest</h1>
        <p style="color: #64748b; margin: 4px 0 0;">Smart Exam Preparation</p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 12px; color: #1e293b;">Verify your email</h2>
        <p style="color: #475569; line-height: 1.6;">
          Thanks for signing up! Click the button below to verify your email address and get started.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="{verification_url}"
             style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px;
                    font-weight: 600; font-size: 15px;">
            Verify Email
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
      </div>
    </div>
    """

    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": "Verify your PrepNest account",
                "html": html_body,
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info("Verification email sent to %s via Resend", to_email)
            return True
        else:
            logger.error("Resend API error %s: %s", resp.status_code, resp.text)
            return False
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
        return False
