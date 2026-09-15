"""Transactional email over HTTPS, usable on Render's free instances."""
import json
import logging
from email.utils import parseaddr
from smtplib import SMTPException
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


SAFE_BREVO_ERROR_CODES = {
    "unauthorized",
    "permission_denied",
    "invalid_parameter",
    "missing_parameter",
    "not_enough_credits",
    "account_under_validation",
    "too_many_requests",
    "out_of_range",
    "method_not_allowed",
}


def address(value):
    name, email = parseaddr(value)
    return {"email": email, **({"name": name} if name else {})}


class EmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages or []:
            if not message.recipients():
                continue
            try:
                self._send(message)
            except (SMTPException, OSError):
                if not self.fail_silently:
                    raise
            else:
                sent += 1
        return sent

    def _send(self, message):
        api_key = settings.BREVO_API_KEY
        if not api_key:
            logger.warning("Brevo email failed: configuration_missing=BREVO_API_KEY.")
            raise SMTPException("BREVO_API_KEY is not configured.")
        # Account emails contain no attachments. Reject unsupported data rather
        # than reporting success after silently dropping it.
        if message.attachments:
            raise SMTPException("Attachments are not supported by this email backend.")
        sender = address(message.from_email)
        if not sender["email"] or "@" not in sender["email"]:
            logger.warning("Brevo email failed: configuration_invalid=DEFAULT_FROM_EMAIL.")
            raise SMTPException("DEFAULT_FROM_EMAIL must include an email address.")
        payload = {"sender": sender, "subject": message.subject}
        for field in ("to", "cc", "bcc"):
            values = getattr(message, field)
            if values:
                payload[field] = [address(value) for value in values]
        if message.reply_to:
            payload["replyTo"] = address(message.reply_to[0])
        payload["htmlContent" if message.content_subtype == "html" else "textContent"] = message.body
        for content, mimetype in getattr(message, "alternatives", []):
            if mimetype == "text/html":
                payload["htmlContent"] = content
        request = Request(
            "https://api.brevo.com/v3/smtp/email",
            data=json.dumps(payload).encode("utf-8"),
            headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                if response.status != 201:
                    logger.warning("Brevo email failed: HTTP %s; code=unexpected_status.", response.status)
                    raise SMTPException("Email provider did not accept the message.")
        except HTTPError as error:
            # Log only known machine-readable codes, never provider messages
            # (which may contain email addresses or other private values).
            code = "unknown"
            try:
                data = json.loads(error.read(8192))
                candidate = data.get("code") if isinstance(data, dict) else None
                if candidate in SAFE_BREVO_ERROR_CODES:
                    code = candidate
            except (ValueError, TypeError, OSError):
                pass
            logger.warning("Brevo email failed: HTTP %s; code=%s.", error.code, code)
            error.close()
            # Never surface provider response bodies, recipients or credentials.
            raise SMTPException(f"Email provider rejected the request (HTTP {error.code}).") from None
        except URLError:
            logger.warning("Brevo email failed: HTTPS connection could not be established.")
            raise SMTPException("Email provider could not be reached.") from None
