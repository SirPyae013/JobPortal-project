from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView, RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from core.views import public_image


urlpatterns = [
    path("api/v1/dashboard/", include("core.dashboard_urls")),
    path("admin/", admin.site.urls),
    re_path(r"^accounts/confirm-email(?:/.*)?$", RedirectView.as_view(url="/verify-email", permanent=False)),
    path("accounts/", include("allauth.urls")),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("accounts.api_urls")),
    path("api/v1/", include("jobs.urls")),
    path("api/v1/", include("applications.urls")),
    path("api/v1/", include("companies.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("core.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += [re_path(r"^media/(?P<path>.*)$", public_image)]

if (settings.SPA_DIST / "index.html").exists():
    urlpatterns += [re_path(r"^(?!api/|admin/|static/|media/).*$", TemplateView.as_view(template_name="index.html"))]
