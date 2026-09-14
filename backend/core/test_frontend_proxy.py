import os
import runpy
from pathlib import Path
from unittest.mock import patch

from django.http import HttpResponse
from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.test import RequestFactory, SimpleTestCase, override_settings


FRONTEND = "https://jobportal-frontend.shinzo0864.workers.dev"
BACKEND_HOST = "jobportal-project-didk.onrender.com"


@override_settings(ALLOWED_HOSTS=[BACKEND_HOST], CSRF_TRUSTED_ORIGINS=[FRONTEND])
class FrontendProxyCsrfTests(SimpleTestCase):
    def check_request(self, origin, with_token=True):
        request = RequestFactory().post(
            "/api/v1/student-profile/me/",
            HTTP_HOST=BACKEND_HOST,
            HTTP_ORIGIN=origin,
            HTTP_REFERER=f"{origin}/profile",
            secure=True,
        )
        token = get_token(request)
        request.COOKIES["csrftoken"] = request.META["CSRF_COOKIE"]
        if with_token:
            request.META["HTTP_X_CSRFTOKEN"] = token
        middleware = CsrfViewMiddleware(lambda request: HttpResponse())
        middleware.process_request(request)
        return middleware.process_view(request, lambda request: HttpResponse(), (), {})

    def test_frontend_origin_with_matching_cookie_and_token_is_accepted(self):
        self.assertIsNone(self.check_request(FRONTEND))

    def test_other_origin_is_rejected_even_with_matching_token(self):
        self.assertEqual(self.check_request("https://untrusted.example").status_code, 403)

    def test_trusted_frontend_still_requires_csrf_token(self):
        self.assertEqual(self.check_request(FRONTEND, with_token=False).status_code, 403)

    def test_deployed_origin_is_trusted_with_stale_local_environment_settings(self):
        settings_file = Path(__file__).resolve().parents[1] / "config" / "settings.py"
        for render_hostname in ("", BACKEND_HOST):
            with self.subTest(render_hostname=render_hostname):
                environment = {
                    "DJANGO_DEBUG": "true",
                    "FRONTEND_URL": "http://localhost:3000",
                    "CSRF_TRUSTED_ORIGINS": "http://localhost:3000",
                    "RENDER_EXTERNAL_HOSTNAME": render_hostname,
                }
                with patch.dict(os.environ, environment, clear=True), patch("dotenv.load_dotenv"):
                    configuration = runpy.run_path(str(settings_file))
                with override_settings(CSRF_TRUSTED_ORIGINS=configuration["CSRF_TRUSTED_ORIGINS"]):
                    self.assertIsNone(self.check_request(FRONTEND))
                    self.assertEqual(self.check_request("https://untrusted.example").status_code, 403)
                    self.assertEqual(self.check_request(FRONTEND, with_token=False).status_code, 403)
