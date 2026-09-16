"""Transactional email through Resend's HTTPS API."""
import json
import logging
from email.utils import parseaddr
from smtplib import SMTPException
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


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
        api_key = settings.RESEND_API_KEY
        if not api_key:
            logger.warning("Resend email failed: configuration_missing=RESEND_API_KEY.")
            raise SMTPException("RESEND_API_KEY is not configured.")
        if message.attachments:
            raise SMTPException("Attachments are not supported by this email backend.")

        _, sender_email = parseaddr(message.from_email)
        if not sender_email or "@" not in sender_email:
            logger.warning("Resend email failed: configuration_invalid=DEFAULT_FROM_EMAIL.")
            raise SMTPException("DEFAULT_FROM_EMAIL must include an email address.")

        payload = {
            "from": message.from_email,
            "to": list(message.to),
            "subject": message.subject,
        }
        if message.cc:
            payload["cc"] = list(message.cc)
        if message.bcc:
            payload["bcc"] = list(message.bcc)
        if message.reply_to:
            payload["reply_to"] = list(message.reply_to)

        if message.content_subtype == "html":
            payload["html"] = message.body
        else:
            payload["text"] = message.body
        for alternative in getattr(message, "alternatives", []):
            content, mimetype = alternative
            if mimetype == "text/html":
                payload["html"] = content

        request = Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "campusjob/1.0",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                if not 200 <= response.status < 300:
                    logger.warning("Resend email failed: HTTP %s.", response.status)
                    raise SMTPException("Email provider did not accept the message.")
        except HTTPError as error:
            logger.warning("Resend email failed: HTTP %s.", error.code)
            error.close()
            raise SMTPException(
                f"Email provider rejected the request (HTTP {error.code})."
            ) from None
        except URLError:
            logger.warning("Resend email failed: HTTPS connection could not be established.")
            raise SMTPException("Email provider could not be reached.") from None
