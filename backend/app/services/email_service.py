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

    logger.info("Sending verification email via Resend to %s from %s", to_email, settings.resend_from_email)

    frontend = settings.frontend_url.rstrip("/")
    html_body = f"""\
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #c026d3); border-radius: 16px; padding: 12px;">
          <img src="{frontend}/logo.png" alt="PrepNestAI" width="64" height="64" style="display: block; border-radius: 8px;" />
        </div>
        <h1 style="color: #7c3aed; margin: 12px 0 0; font-size: 22px;">PrepNestAI</h1>
        <p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">Smart Exam Preparation</p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 12px; color: #1e293b; font-size: 20px;">Verify your email</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 15px;">
          Thanks for signing up! Click the button below to verify your email address and get started.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="{verification_url}"
             style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px;
                    font-weight: 600; font-size: 16px; letter-spacing: 0.3px;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
          Or copy and paste this link into your browser:<br/>
          <a href="{verification_url}" style="color: #7c3aed; word-break: break-all; font-size: 12px;">{verification_url}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
      <p style="text-align: center; color: #cbd5e1; font-size: 11px; margin-top: 24px;">
        &copy; PrepNestAI &mdash; <a href="{frontend}" style="color: #a78bfa; text-decoration: none;">prepnestai.app</a>
      </p>
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


async def async_send_verification_email(to_email: str, verification_url: str) -> bool:
    """Async variant – does not block the event loop."""
    settings = get_settings()

    if not _resend_configured():
        logger.warning("Resend not configured – skipping verification email to %s", to_email)
        return False

    logger.info("Sending verification email (async) to %s from %s", to_email, settings.resend_from_email)

    frontend = settings.frontend_url.rstrip("/")
    html_body = f"""\
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #c026d3); border-radius: 16px; padding: 12px;">
          <img src="{frontend}/logo.png" alt="PrepNestAI" width="64" height="64" style="display: block; border-radius: 8px;" />
        </div>
        <h1 style="color: #7c3aed; margin: 12px 0 0; font-size: 22px;">PrepNestAI</h1>
        <p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">Smart Exam Preparation</p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 12px; color: #1e293b; font-size: 20px;">Verify your email</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 15px;">
          Thanks for signing up! Click the button below to verify your email address and get started.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="{verification_url}"
             style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px;
                    font-weight: 600; font-size: 16px; letter-spacing: 0.3px;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
          Or copy and paste this link into your browser:<br/>
          <a href="{verification_url}" style="color: #7c3aed; word-break: break-all; font-size: 12px;">{verification_url}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
      <p style="text-align: center; color: #cbd5e1; font-size: 11px; margin-top: 24px;">
        &copy; PrepNestAI &mdash; <a href="{frontend}" style="color: #a78bfa; text-decoration: none;">prepnestai.app</a>
      </p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
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
            )
        if resp.status_code in (200, 201):
            logger.info("Verification email sent to %s via Resend (async)", to_email)
            return True
        else:
            logger.error("Resend API error %s: %s", resp.status_code, resp.text)
            return False
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
        return False
