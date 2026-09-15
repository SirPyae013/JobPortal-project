import json
from io import BytesIO
from smtplib import SMTPException
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, override_settings

from .brevo_backend import EmailBackend


@override_settings(BREVO_API_KEY="test-key", EMAIL_TIMEOUT=15)
class BrevoBackendTests(SimpleTestCase):
    @patch("accounts.brevo_backend.urlopen")
    def test_logs_status_and_safe_code_without_provider_message(self, send):
        send.side_effect = HTTPError("https://api.brevo.com", 403, "Forbidden", {}, BytesIO(json.dumps({"code": "permission_denied", "message": "private-recipient@example.com"}).encode()))
        with self.assertLogs("accounts.brevo_backend", level="WARNING") as logs:
            with self.assertRaises(SMTPException):
                EmailBackend().send_messages([self.message()])
        output = " ".join(logs.output)
        self.assertIn("HTTP 403; code=permission_denied", output)
        self.assertNotIn("private-recipient", output)

    def message(self):
        message = EmailMultiAlternatives("Verify email", "Code: 123456", "Portal <sender@example.com>", ["recipient@example.com"])
        message.attach_alternative("<p>Code: 123456</p>", "text/html")
        return message

    @patch("accounts.brevo_backend.urlopen")
    def test_sends_text_and_html_over_https(self, send):
        send.return_value.__enter__.return_value.status = 201
        self.assertEqual(EmailBackend().send_messages([self.message()]), 1)
        request = send.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.brevo.com/v3/smtp/email")
        payload = json.loads(request.data)
        self.assertEqual(payload["sender"], {"name": "Portal", "email": "sender@example.com"})
        self.assertEqual(payload["to"], [{"email": "recipient@example.com"}])
        self.assertIn("123456", payload["textContent"])
        self.assertIn("123456", payload["htmlContent"])
        self.assertEqual(send.call_args.kwargs["timeout"], 15)

    @patch("accounts.brevo_backend.urlopen")
    def test_rejections_and_network_failures_do_not_report_success(self, send):
        for failure in (HTTPError("https://api.brevo.com", 401, "secret", {}, MagicMock()), URLError("private diagnostic")):
            with self.subTest(failure=type(failure).__name__):
                send.side_effect = failure
                with self.assertRaises(SMTPException) as caught:
                    EmailBackend().send_messages([self.message()])
                self.assertNotIn("secret", str(caught.exception))
                self.assertNotIn("private", str(caught.exception))
                self.assertEqual(EmailBackend(fail_silently=True).send_messages([self.message()]), 0)

    @override_settings(BREVO_API_KEY="")
    @patch("accounts.brevo_backend.urlopen")
    def test_missing_key_fails_before_request(self, send):
        with self.assertRaises(SMTPException):
            EmailBackend().send_messages([self.message()])
        send.assert_not_called()
