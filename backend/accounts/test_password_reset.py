import re
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlsplit

from allauth.account.forms import default_token_generator
from allauth.account.models import EmailAddress
from django.conf import settings
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://campus.example.test",
)
class PasswordResetTests(TestCase):
    old_password = "Previous-campus-password-481!"
    new_password = "Replacement-campus-password-962!"

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            "password-reset@example.test", cls.old_password, role="student"
        )
        EmailAddress.objects.create(
            user=cls.user, email=cls.user.email, verified=True, primary=True
        )

    def setUp(self):
        self.client = APIClient()

    def request_reset(self):
        response = self.client.post(
            "/api/v1/auth/password/reset/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(mail.outbox[-1].to, [self.user.email])
        links = re.findall(r"https?://[^\s<>]+", mail.outbox[-1].body)
        reset_links = [url for url in links if "/password/reset/confirm/" in url]
        self.assertEqual(len(reset_links), 1)
        return response, urlsplit(reset_links[0])

    def confirm_reset(self, reset_url, **overrides):
        uid, token = reset_url.path.rstrip("/").split("/")[-2:]
        payload = {
            "uid": uid,
            "token": token,
            "new_password1": self.new_password,
            "new_password2": self.new_password,
            **overrides,
        }
        return self.client.post(
            "/api/v1/auth/password/reset/confirm/", payload, format="json"
        )

    def test_reset_email_links_to_frontend_with_or_without_trailing_slash(self):
        for frontend_url in (
            "https://campus.example.test",
            "https://campus.example.test/",
        ):
            with self.subTest(frontend_url=frontend_url):
                with override_settings(FRONTEND_URL=frontend_url):
                    _, reset_url = self.request_reset()
                self.assertEqual(reset_url.scheme, "https")
                self.assertEqual(reset_url.netloc, "campus.example.test")
                self.assertRegex(
                    reset_url.path, r"^/password/reset/confirm/[^/]+/[^/]+/?$"
                )
                self.assertFalse(reset_url.query)
                self.assertFalse(reset_url.fragment)
        self.assertEqual(len(mail.outbox), 2)

    def test_reset_changes_password_allows_login_and_rejects_reuse(self):
        _, reset_url = self.request_reset()
        confirmed = self.confirm_reset(reset_url)
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        self.assertFalse(self.user.check_password(self.old_password))

        reused = self.confirm_reset(reset_url)
        self.assertEqual(reused.status_code, 400, reused.data)
        self.assertIn("token", reused.data["fields"])

        old_login = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": self.old_password},
            format="json",
        )
        self.assertEqual(old_login.status_code, 400, old_login.data)
        new_login = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": self.new_password},
            format="json",
        )
        self.assertEqual(new_login.status_code, 200, new_login.data)
        self.assertIn("jobportal_access", new_login.cookies)

    def test_invalid_token_does_not_change_password(self):
        _, reset_url = self.request_reset()
        response = self.confirm_reset(reset_url, token="invalid-token")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("token", response.data["fields"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.old_password))

    def test_expired_token_does_not_change_password(self):
        expired_at = default_token_generator._now() - timedelta(
            seconds=settings.PASSWORD_RESET_TIMEOUT + 1
        )
        with patch.object(default_token_generator, "_now", return_value=expired_at):
            _, reset_url = self.request_reset()
        response = self.confirm_reset(reset_url)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("token", response.data["fields"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.old_password))

    def test_unknown_email_has_same_response_without_sending_email(self):
        known_response, _ = self.request_reset()
        mail.outbox.clear()
        unknown_response = self.client.post(
            "/api/v1/auth/password/reset/",
            {"email": "unknown-account@example.test"},
            format="json",
        )
        self.assertEqual(unknown_response.status_code, known_response.status_code)
        self.assertEqual(unknown_response.data, known_response.data)
        self.assertEqual(len(mail.outbox), 0)
