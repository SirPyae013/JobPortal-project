from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit

from django.test import TestCase, override_settings
from django.urls import include, path, re_path
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import RecruiterProfile, User
from .views import public_image


# Exercise the development media route even though tests run with DEBUG=False.
urlpatterns = [
    re_path(r"^media/(?P<path>.*)$", public_image),
    path("api/v1/", include("accounts.api_urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class PublicImageTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        image = BytesIO()
        Image.new("RGB", (8, 8), "blue").save(image, format="PNG")
        self.image = image.getvalue()

    def test_uploaded_recruiter_photo_url_serves_the_image(self):
        user = User.objects.create_user("photo-test@example.com", role="recruiter")
        RecruiterProfile.objects.create(user=user, name="Photo Test")
        client = APIClient()
        client.force_authenticate(user)
        upload = client.patch("/api/v1/recruiter-profile/me/", {
            "photo": SimpleUploadedFile("portrait.png", self.image, content_type="image/png"),
        }, format="multipart")
        self.assertEqual(upload.status_code, 200)
        image_path = urlsplit(upload.data["photo_url"]).path
        # A browser's image request does not carry API authentication headers.
        response = self.client.get(image_path)
        self.addCleanup(response.close)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(b"".join(response.streaming_content), self.image)

    def test_existing_public_images_still_load(self):
        for folder in ["student-photos", "company-logos"]:
            with self.subTest(folder=folder):
                directory = Path(self.media.name) / folder
                directory.mkdir()
                (directory / "image.png").write_bytes(self.image)
                response = self.client.get(f"/media/{folder}/image.png")
                self.addCleanup(response.close)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(b"".join(response.streaming_content), self.image)

    def test_private_files_and_paths_outside_photo_folder_remain_blocked(self):
        for folder in ["student-resumes", "application-resumes"]:
            directory = Path(self.media.name) / folder
            directory.mkdir()
            (directory / "private.pdf").write_bytes(b"%PDF-1.4 private")
            for image_path in [f"{folder}/private.pdf", f"recruiter-photos/../{folder}/private.pdf", f"recruiter-photos/..\\{folder}\\private.pdf"]:
                with self.subTest(path=image_path):
                    self.assertEqual(self.client.get(f"/media/{image_path}").status_code, 404)
        self.assertEqual(self.client.get("/media/recruiter-photos/missing.png").status_code, 404)
