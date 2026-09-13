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
