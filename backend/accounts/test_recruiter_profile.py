from io import BytesIO
from tempfile import TemporaryDirectory

from allauth.account.models import EmailAddress
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from companies.models import Company
from .models import RecruiterProfile, User


class RecruiterProfileTests(TestCase):
    url = "/api/v1/recruiter-profile/me/"

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("recruiter@example.com", role="recruiter")
        EmailAddress.objects.create(user=cls.user, email=cls.user.email, verified=True, primary=True)
        cls.profile = RecruiterProfile.objects.create(user=cls.user, name="Aung Recruiter")
        cls.company = Company.objects.create(recruiter=cls.profile, name="Yangon Tech", contact_email=cls.user.email)
        cls.other_user = User.objects.create_user("other@example.com", role="recruiter")
        cls.other_profile = RecruiterProfile.objects.create(user=cls.other_user, name="Other Recruiter")
        cls.student = User.objects.create_user("student@example.com", role="student")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_profile_can_be_built_and_reloaded_at_every_approval_stage(self):
        for approval in RecruiterProfile.Approval.values:
            with self.subTest(approval=approval):
                self.profile.approval_status = approval
                self.profile.save()
                payload = {"name": "Mya Recruiter", "job_title": "Hiring Manager", "phone": "+95 9 123456789", "bio": "I recruit software engineering interns."}
                response = self.client.patch(self.url, payload, format="json")
                self.assertEqual(response.status_code, 200)
                saved = self.client.get(self.url)
                self.assertEqual(saved.status_code, 200)
                for field, value in payload.items():
                    self.assertEqual(saved.data[field], value)
                self.assertEqual(saved.data["approval_status"], approval)
                # Real authenticated requests load a fresh user, unlike force_authenticate.
                self.user.refresh_from_db()
                self.assertEqual(self.client.get("/api/v1/auth/me/").data["profile"]["name"], payload["name"])

    def test_profile_is_scoped_to_authenticated_recruiter(self):
        response = self.client.patch(self.url, {"id": str(self.other_profile.id), "user": str(self.other_user.id), "name": "Updated"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(str(response.data["id"]), str(self.profile.id))
        self.other_profile.refresh_from_db()
        self.assertEqual(self.other_profile.name, "Other Recruiter")

    def test_review_and_account_fields_cannot_be_changed(self):
        response = self.client.patch(self.url, {"approval_status": "approved", "email": "changed@example.com", "rejection_reason": "Changed", "reviewed_at": "2026-01-01T00:00:00Z"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.profile.approval_status, "pending")
        self.assertEqual(self.profile.rejection_reason, "")
        self.assertIsNone(self.profile.reviewed_at)
        self.assertEqual(self.user.email, "recruiter@example.com")

    def test_students_and_anonymous_users_cannot_access_recruiter_profile(self):
        for user in [self.student, None]:
            self.client.force_authenticate(user)
            for method in ["get", "patch"]:
                with self.subTest(user=user, method=method):
                    response = getattr(self.client, method)(self.url)
                    self.assertIn(response.status_code, [401, 403])

    def test_missing_profile_returns_not_found(self):
        self.client.force_authenticate(User.objects.create_user("missing@example.com", role="recruiter"))
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_invalid_details_are_rejected_and_optional_fields_can_be_cleared(self):
        for payload, field in [({"name": " "}, "name"), ({"job_title": "x" * 121}, "job_title"), ({"phone": "1" * 41}, "phone")]:
            with self.subTest(field=field):
                response = self.client.patch(self.url, payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data["fields"])
        self.profile.job_title = "Manager"
        self.profile.save()
        response = self.client.patch(self.url, {"job_title": "", "phone": "", "bio": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.job_title, "")

    def test_company_logo_and_details_persist_after_approval(self):
        self.company.approval_status = "approved"
        self.company.save()
        with TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            image = BytesIO()
            Image.new("RGB", (4, 4), "green").save(image, format="PNG")
            logo = SimpleUploadedFile("logo.png", image.getvalue(), content_type="image/png")
            response = self.client.patch("/api/v1/company/me/", {"logo": logo, "industry": "Technology", "location": "Yangon", "description": "We build campus software."}, format="multipart")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data["logo_url"])
            self.assertEqual(response.data["approval_status"], "approved")
            response = self.client.patch("/api/v1/company/me/", {"description": "Updated company story."}, format="multipart")
            self.assertEqual(response.status_code, 200)
            saved = self.client.get("/api/v1/company/me/").data
            self.assertTrue(saved["logo_url"])
            self.assertEqual(saved["industry"], "Technology")
            self.assertEqual(saved["description"], "Updated company story.")

    def test_recruiter_photo_upload_replace_and_reload_at_every_approval_stage(self):
        self.company.logo = "company-logos/existing.png"
        self.company.save()
        previous_url = None
        with TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            for approval, image_format, mime in [("pending", "PNG", "image/png"), ("approved", "JPEG", "image/jpeg"), ("rejected", "WEBP", "image/webp")]:
                with self.subTest(approval=approval, image_format=image_format):
                    self.profile.refresh_from_db()
                    self.profile.approval_status = approval
                    self.profile.save()
                    image = BytesIO()
                    Image.new("RGB", (8, 8), "blue").save(image, format=image_format)
                    photo = SimpleUploadedFile(f"portrait.{image_format.lower()}", image.getvalue(), content_type=mime)
                    response = self.client.patch(self.url, {"photo": photo}, format="multipart")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.data["approval_status"], approval)
                    photo_url = response.data["photo_url"]
                    self.assertIn("/recruiter-photos/", photo_url)
                    self.assertNotEqual(photo_url, previous_url)
                    self.profile.refresh_from_db()
                    self.assertTrue(self.profile.photo.storage.exists(self.profile.photo.name))
                    self.assertEqual(self.client.get(self.url).data["photo_url"], photo_url)
                    self.user.refresh_from_db()
                    self.assertEqual(self.client.get("/api/v1/auth/me/").data["profile"]["photo_url"], photo_url)
                    # Saving text later must retain the saved photo.
                    response = self.client.patch(self.url, {"bio": "Updated bio"}, format="multipart")
                    self.assertEqual(response.data["photo_url"], photo_url)
                    self.company.refresh_from_db()
                    self.other_profile.refresh_from_db()
                    self.assertEqual(self.company.logo.name, "company-logos/existing.png")
                    self.assertFalse(self.other_profile.photo)
                    previous_url = photo_url

    def test_invalid_recruiter_photos_do_not_replace_saved_photo(self):
        self.profile.photo = "recruiter-photos/existing.png"
        self.profile.save()
        gif = BytesIO()
        Image.new("RGB", (8, 8), "red").save(gif, format="GIF")
        png = BytesIO()
        Image.new("RGB", (8, 8), "green").save(png, format="PNG")
        uploads = [
            SimpleUploadedFile("bad.png", b"not an image", content_type="image/png"),
            SimpleUploadedFile("unsupported.gif", gif.getvalue(), content_type="image/gif"),
            SimpleUploadedFile("oversized.png", png.getvalue() + b"0" * (2 * 1024 * 1024), content_type="image/png"),
        ]
        for photo in uploads:
            with self.subTest(filename=photo.name):
                response = self.client.patch(self.url, {"photo": photo}, format="multipart")
                self.assertEqual(response.status_code, 400)
                self.assertIn("photo", response.data["fields"])
                self.profile.refresh_from_db()
                self.assertEqual(self.profile.photo.name, "recruiter-photos/existing.png")

    def test_company_identity_change_pauses_hiring_and_rejected_profiles_can_resubmit(self):
        self.profile.approval_status = "approved"
        self.profile.save()
        self.company.approval_status = "approved"
        self.company.save()
        self.assertTrue(self.client.get("/api/v1/auth/me/").data["capabilities"]["manage_jobs"])
        response = self.client.patch("/api/v1/company/me/", {"website": "https://new.example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approval_status"], "pending")
        self.assertFalse(self.client.get("/api/v1/auth/me/").data["capabilities"]["manage_jobs"])
        self.profile.approval_status = "rejected"
        self.profile.rejection_reason = "Please update your details."
        self.profile.save()
        self.company.approval_status = "rejected"
        self.company.save()
        self.assertEqual(self.client.post("/api/v1/company/me/resubmit/").status_code, 200)
        self.assertEqual(self.client.get(self.url).data["approval_status"], "pending")
        self.assertEqual(self.client.get(self.url).data["rejection_reason"], "")
        self.assertEqual(self.client.get("/api/v1/company/me/").data["approval_status"], "pending")
