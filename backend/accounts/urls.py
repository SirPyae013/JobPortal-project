from django.urls import include, path, re_path

from .views import CurrentUserView, GoogleLoginView, RegisterView, ResendVerificationView, VerifyEmailCodeView
from core.views import CsrfView

urlpatterns = [
    re_path(r"^registration/verify-email/?$", VerifyEmailCodeView.as_view(), name="rest_verify_email"),
    path("", include("dj_rest_auth.urls")),
    path("registration/", RegisterView.as_view(), name="register-alias"),
    re_path(r"^registration/resend-email/?$", ResendVerificationView.as_view(), name="resend-verification"),
    path("registration/", include("dj_rest_auth.registration.urls")),
    path("register/", RegisterView.as_view(), name="register"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("csrf/", CsrfView.as_view(), name="csrf"),
]
