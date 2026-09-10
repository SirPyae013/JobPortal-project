import re
import smtplib
import time
from unittest.mock import patch
from urllib.parse import urlsplit

from allauth.account.models import EmailAddress
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from companies.models import Company
from .models import RecruiterProfile, StudentProfile, User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    EMAIL_VERIFICATION_ENABLED=True,
    ACCOUNT_EMAIL_VERIFICATION="mandatory",
    ACCOUNT_EMAIL_CONFIRMATION_HMAC=True,
    ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS=1,
    FRONTEND_URL="https://campus.example.test",
)
class EmailVerificationTests(TestCase):
    password = "Campus-verification-password-641!"
    register_url = "/api/v1/auth/register/"
    verify_url = "/api/v1/auth/registration/verify-email/"
    resend_url = "/api/v1/auth/registration/resend-email/"

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def register(self, role="student", email=None):
        return self.client.post(
            self.register_url,
            {
                "email": email or f"new-{role}@example.test",
                "password": self.password,
                "role": role,
                "full_name": f"New {role.title()}",
                "university": "University of Yangon",
                "company_name": "Campus Example Company",
                "company_website": "https://company.example.test",
            },
            format="json",
        )

    def create_address(self, email="unverified@example.test", verified=False):
        user = User.objects.create_user(email, self.password, role="student")
        StudentProfile.objects.create(user=user, name="New Student")
        return EmailAddress.objects.create(
            user=user, email=user.email, verified=verified, primary=True
        )

    def emailed_key(self):
        links = re.findall(r"https?://[^\s<>]+", mail.outbox[-1].body)
        verification_links = [url for url in links if "/verify-email/" in url]
        self.assertEqual(len(verification_links), 1)
        link = urlsplit(verification_links[0])
        self.assertEqual(link.scheme, "https")
        self.assertEqual(link.netloc, "campus.example.test")
        self.assertRegex(link.path, r"^/verify-email/[^/]+/?$")
        self.assertFalse(link.query)
        self.assertFalse(link.fragment)
        return link.path.rstrip("/").rsplit("/", 1)[-1]

    def login(self, email):
        return self.client.post(
            "/api/v1/auth/login/",
            {"email": email, "password": self.password},
            format="json",
        )

    def test_student_and_recruiter_registration_each_send_one_verification_email(self):
        for role in ("student", "recruiter"):
            with self.subTest(role=role):
                mail.outbox.clear()
                response = self.register(role)
                self.assertEqual(response.status_code, 201, response.data)
                self.assertTrue(response.data["email_verification_required"])
                self.assertTrue(response.data["message"])
                self.assertNotIn("jobportal_access", response.cookies)
                self.assertNotIn("access", response.data)
                user = User.objects.get(email=f"new-{role}@example.test")
                self.assertFalse(user.email_verified)
                address = EmailAddress.objects.get(user=user)
                self.assertTrue(address.primary)
                self.assertFalse(address.verified)
                self.assertEqual(len(mail.outbox), 1)
                self.assertEqual(mail.outbox[0].to, [user.email])
                self.emailed_key()
                if role == "student":
                    self.assertEqual(user.student_profile.university, "University of Yangon")
                else:
                    self.assertEqual(user.recruiter_profile.approval_status, "pending")
                    self.assertEqual(user.recruiter_profile.company.approval_status, "pending")

    def test_issued_key_unlocks_login_and_cannot_be_reused(self):
        registration = self.register()
        self.assertEqual(registration.status_code, 201, registration.data)
        user = User.objects.get(email="new-student@example.test")
        key = self.emailed_key()
        blocked_login = self.login(user.email)
        self.assertEqual(blocked_login.status_code, 400, blocked_login.data)
        self.assertNotIn("jobportal_access", blocked_login.cookies)

        confirmation = self.client.post(self.verify_url, {"key": key}, format="json")
        self.assertEqual(confirmation.status_code, 200, confirmation.data)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)
        allowed_login = self.login(user.email)
        self.assertEqual(allowed_login.status_code, 200, allowed_login.data)
        self.assertTrue(allowed_login.cookies["jobportal_access"]["httponly"])

        self.client = APIClient()
        repeated = self.client.post(self.verify_url, {"key": key}, format="json")
        self.assertEqual(repeated.status_code, 404, repeated.data)
        self.assertTrue(User.objects.get(pk=user.pk).email_verified)

    def test_verifying_recruiter_does_not_approve_their_company(self):
        response = self.register("recruiter")
        self.assertEqual(response.status_code, 201, response.data)
        confirmation = self.client.post(
            self.verify_url, {"key": self.emailed_key()}, format="json"
        )
        self.assertEqual(confirmation.status_code, 200, confirmation.data)
        user = User.objects.get(email="new-recruiter@example.test")
        self.assertTrue(user.email_verified)
        self.assertEqual(user.recruiter_profile.approval_status, "pending")
        self.assertEqual(user.recruiter_profile.company.approval_status, "pending")

    def test_invalid_key_leaves_account_unverified(self):
        address = self.create_address()
        response = self.client.post(
            self.verify_url, {"key": "invalid-verification-key"}, format="json"
        )
        self.assertEqual(response.status_code, 404, response.data)
        address.refresh_from_db()
        self.assertFalse(address.verified)

    def test_expired_key_leaves_account_unverified(self):
        expired_at = time.time() - (24 * 60 * 60 + 1)
        with patch("django.core.signing.time.time", return_value=expired_at):
            registration = self.register()
            key = self.emailed_key()
        self.assertEqual(registration.status_code, 201, registration.data)
        response = self.client.post(self.verify_url, {"key": key}, format="json")
        self.assertEqual(response.status_code, 404, response.data)
        self.assertFalse(User.objects.get(email="new-student@example.test").email_verified)

    def test_get_request_cannot_verify_email(self):
        registration = self.register()
        self.assertEqual(registration.status_code, 201, registration.data)
        response = self.client.get(self.verify_url, {"key": self.emailed_key()})
        self.assertEqual(response.status_code, 405, response.data)
        self.assertFalse(User.objects.get(email="new-student@example.test").email_verified)

    @override_settings(FRONTEND_URL="https://campus.example.test/")
    def test_verification_link_handles_frontend_trailing_slash(self):
        response = self.register()
        self.assertEqual(response.status_code, 201, response.data)
        self.emailed_key()

    def test_resend_response_is_same_for_unverified_verified_and_unknown_email(self):
        unverified = self.create_address()
        verified = self.create_address("verified@example.test", verified=True)
        responses = []
        for email in (unverified.email, verified.email, "unknown@example.test"):
            response = self.client.post(self.resend_url, {"email": email}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            responses.append(response.data)
        self.assertEqual(responses[0], responses[1])
        self.assertEqual(responses[0], responses[2])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [unverified.email])
        confirmation = self.client.post(
            self.verify_url, {"key": self.emailed_key()}, format="json"
        )
        self.assertEqual(confirmation.status_code, 200, confirmation.data)

    def test_resend_email_cooldown_is_case_insensitive_and_shared_across_ips(self):
        address = self.create_address()
        first = self.client.post(self.resend_url, {"email": address.email}, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        other_client = APIClient()
        second = other_client.post(
            self.resend_url,
            {"email": address.email.upper()},
            format="json",
            REMOTE_ADDR="192.0.2.12",
        )
        self.assertEqual(second.status_code, 429, second.data)
        self.assertGreater(int(second["Retry-After"]), 0)
        self.assertEqual(len(mail.outbox), 1)

    def test_unknown_address_has_the_same_resend_cooldown(self):
        payload = {"email": "unknown@example.test"}
        first = self.client.post(self.resend_url, payload, format="json")
        second = self.client.post(self.resend_url, payload, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 429, second.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_resend_rejects_non_object_json_without_server_error(self):
        for payload in ([], "email@example.test", 42):
            with self.subTest(payload=payload):
                response = self.client.post(self.resend_url, payload, format="json")
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_registration_delivery_failure_rolls_back_account_and_can_recover(self):
        for role, failure in (
            ("student", smtplib.SMTPException("private SMTP auth diagnostic")),
            ("recruiter", OSError("private SMTP connection diagnostic")),
        ):
            with self.subTest(role=role):
                cache.clear()
                mail.outbox.clear()
                counts = (
                    User.objects.count(), StudentProfile.objects.count(),
                    RecruiterProfile.objects.count(), Company.objects.count(),
                    EmailAddress.objects.count(),
                )
                with patch("accounts.account_adapter.DefaultAccountAdapter.send_mail", side_effect=failure):
                    response = self.register(role)
                self.assertEqual(response.status_code, 503, response.data)
                self.assertNotIn("private SMTP", str(response.data))
                self.assertEqual(len(mail.outbox), 0)
                self.assertEqual(counts, (
                    User.objects.count(), StudentProfile.objects.count(),
                    RecruiterProfile.objects.count(), Company.objects.count(),
                    EmailAddress.objects.count(),
                ))
                recovered = self.register(role)
                self.assertEqual(recovered.status_code, 201, recovered.data)
                self.assertEqual(len(mail.outbox), 1)
                self.assertFalse(User.objects.get(email=f"new-{role}@example.test").email_verified)

    def test_resend_delivery_failure_is_actionable_and_does_not_verify_account(self):
        address = self.create_address()
        with patch(
            "accounts.account_adapter.DefaultAccountAdapter.send_mail",
            side_effect=smtplib.SMTPException("private SMTP diagnostic"),
        ):
            response = self.client.post(
                self.resend_url, {"email": address.email}, format="json"
            )
        self.assertEqual(response.status_code, 503, response.data)
        self.assertNotIn("private SMTP", str(response.data))
        address.refresh_from_db()
        self.assertFalse(address.verified)
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_delivery_failure_returns_service_unavailable(self):
        address = self.create_address(verified=True)
        with patch(
            "accounts.account_adapter.DefaultAccountAdapter.send_mail",
            side_effect=smtplib.SMTPException("private SMTP diagnostic"),
        ):
            response = self.client.post(
                "/api/v1/auth/password/reset/", {"email": address.email}, format="json"
            )
        self.assertEqual(response.status_code, 503, response.data)
        self.assertNotIn("private SMTP", str(response.data))
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(User.objects.get(pk=address.user_id).check_password(self.password))
