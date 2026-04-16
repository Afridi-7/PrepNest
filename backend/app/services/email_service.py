import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _resend_configured() -> bool:
    settings = get_settings()
    return bool(settings.resend_api_key and settings.resend_from_email)


def _build_email_shell(*, title: str, subtitle: str, body_html: str) -> str:
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")
    return f"""\
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f8fafc;">
      <div style="background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);">
        <div style="padding: 28px 28px 18px; background: linear-gradient(135deg, #7c3aed, #c026d3); text-align: center;">
          <div style="display: inline-block; background: rgba(255,255,255,0.16); border-radius: 18px; padding: 12px; margin-bottom: 16px;">
            <img src="{frontend}/logo.png" alt="PrepNest" width="64" height="64" style="display: block; border-radius: 10px;" />
          </div>
          <h1 style="margin: 0; color: #ffffff; font-size: 24px;">PrepNest</h1>
          <p style="margin: 6px 0 0; color: rgba(255,255,255,0.86); font-size: 14px;">{subtitle}</p>
        </div>
        <div style="padding: 28px;">
          <h2 style="margin: 0 0 14px; color: #111827; font-size: 22px;">{title}</h2>
          {body_html}
        </div>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
        Need help? Visit <a href="{frontend}" style="color: #7c3aed; text-decoration: none;">PrepNest</a>.
      </p>
    </div>
    """


async def _async_send_email(*, to_email: str, subject: str, html_body: str) -> bool:
    settings = get_settings()

    if not _resend_configured():
        logger.warning("Resend not configured - skipping email '%s' to %s", subject, to_email)
        return False

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
                    "subject": subject,
                    "html": html_body,
                },
            )
        if resp.status_code in (200, 201):
            logger.info("Email '%s' sent to %s", subject, to_email)
            return True
        logger.error("Resend API error %s for '%s': %s", resp.status_code, subject, resp.text)
        return False
    except Exception as exc:
        logger.error("Failed to send email '%s' to %s: %s", subject, to_email, exc)
        return False


def send_verification_email(to_email: str, verification_url: str) -> bool:
    settings = get_settings()

    if not _resend_configured():
        logger.warning("Resend not configured - skipping verification email to %s", to_email)
        return False

    html_body = _build_email_shell(
        title="Verify your email",
        subtitle="Smart Exam Preparation",
        body_html=f"""
          <p style="color: #475569; line-height: 1.7; font-size: 15px; margin: 0 0 18px;">
            Thanks for signing up. Confirm your email address to unlock your PrepNest account.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="{verification_url}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 10px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="margin: 0 0 18px;">
            <a href="{verification_url}" style="color: #7c3aed; word-break: break-all; font-size: 12px;">{verification_url}</a>
          </p>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 14px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
            </p>
          </div>
        """,
    )

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
            logger.info("Verification email sent to %s", to_email)
            return True
        logger.error("Resend API error %s: %s", resp.status_code, resp.text)
        return False
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
        return False


async def async_send_verification_email(to_email: str, verification_url: str) -> bool:
    html_body = _build_email_shell(
        title="Verify your email",
        subtitle="Smart Exam Preparation",
        body_html=f"""
          <p style="color: #475569; line-height: 1.7; font-size: 15px; margin: 0 0 18px;">
            Thanks for signing up. Confirm your email address to unlock your PrepNest account.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="{verification_url}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 10px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="margin: 0 0 18px;">
            <a href="{verification_url}" style="color: #7c3aed; word-break: break-all; font-size: 12px;">{verification_url}</a>
          </p>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 14px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
            </p>
          </div>
        """,
    )
    return await _async_send_email(
        to_email=to_email,
        subject="Verify your PrepNest account",
        html_body=html_body,
    )


async def async_send_password_reset_email(to_email: str, reset_url: str, expiry_minutes: int) -> bool:
    html_body = _build_email_shell(
        title="Reset your password",
        subtitle="Account Security",
        body_html=f"""
          <p style="color: #475569; line-height: 1.7; font-size: 15px; margin: 0 0 18px;">
            We received a request to reset your PrepNest password. Use the secure button below to choose a new password.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 10px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="margin: 0 0 18px;">
            <a href="{reset_url}" style="color: #7c3aed; word-break: break-all; font-size: 12px;">{reset_url}</a>
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
            <p style="color: #334155; font-size: 13px; margin: 0 0 6px; font-weight: 700;">Security notice</p>
            <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
              This password reset link expires in {expiry_minutes} minutes and can only be used once. If you did not request a password reset, you can safely ignore this email.
            </p>
          </div>
        """,
    )
    return await _async_send_email(
        to_email=to_email,
        subject="Reset your PrepNest password",
        html_body=html_body,
    )
