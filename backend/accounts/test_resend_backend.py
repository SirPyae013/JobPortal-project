import json
from io import BytesIO
from smtplib import SMTPException
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, override_settings

from .resend_backend import EmailBackend


@override_settings(RESEND_API_KEY="re_test_key", EMAIL_TIMEOUT=15)
class ResendBackendTests(SimpleTestCase):
    def message(self):
        message = EmailMultiAlternatives(
            "Verify email",
            "Code: 123456",
            "Job Portal <verify@mail.example.com>",
            ["recipient@example.com"],
        )
        message.attach_alternative("<p>Code: 123456</p>", "text/html")
        return message

    @patch("accounts.resend_backend.urlopen")
    def test_sends_text_and_html_over_https(self, send):
        send.return_value.__enter__.return_value.status = 200

        self.assertEqual(EmailBackend().send_messages([self.message()]), 1)

        request = send.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.resend.com/emails")
        self.assertEqual(request.get_header("Authorization"), "Bearer re_test_key")
        payload = json.loads(request.data)
        self.assertEqual(payload["from"], "Job Portal <verify@mail.example.com>")
        self.assertEqual(payload["to"], ["recipient@example.com"])
        self.assertIn("123456", payload["text"])
        self.assertIn("123456", payload["html"])
        self.assertEqual(send.call_args.kwargs["timeout"], 15)

    @patch("accounts.resend_backend.urlopen")
    def test_rejection_logs_status_without_provider_response(self, send):
        send.side_effect = HTTPError(
            "https://api.resend.com/emails",
            403,
            "Forbidden",
            {},
            BytesIO(b'{"message":"private-recipient@example.com"}'),
        )

        with self.assertLogs("accounts.resend_backend", level="WARNING") as logs:
            with self.assertRaises(SMTPException):
                EmailBackend().send_messages([self.message()])

        output = " ".join(logs.output)
        self.assertIn("HTTP 403", output)
        self.assertNotIn("private-recipient", output)

    @patch("accounts.resend_backend.urlopen")
    def test_network_failure_does_not_report_success(self, send):
        send.side_effect = URLError("private diagnostic")
        with self.assertRaises(SMTPException) as caught:
            EmailBackend().send_messages([self.message()])
        self.assertNotIn("private", str(caught.exception))
        self.assertEqual(
            EmailBackend(fail_silently=True).send_messages([self.message()]),
            0,
        )

    @override_settings(RESEND_API_KEY="")
    @patch("accounts.resend_backend.urlopen")
    def test_missing_key_fails_before_request(self, send):
        with self.assertRaises(SMTPException):
            EmailBackend().send_messages([self.message()])
        send.assert_not_called()

    @override_settings(DEFAULT_FROM_EMAIL="Job Portal")
    @patch("accounts.resend_backend.urlopen")
    def test_invalid_sender_fails_before_request(self, send):
        message = self.message()
        message.from_email = "Job Portal"
        with self.assertRaises(SMTPException):
            EmailBackend().send_messages([message])
        send.assert_not_called()
