from django.urls import include, path

from .views import CurrentUserView, GoogleLoginView, RegisterView, ResendVerificationView
from core.views import CsrfView

urlpatterns = [
    path("", include("dj_rest_auth.urls")),
    path("registration/", RegisterView.as_view(), name="register-alias"),
    path("registration/resend-email/", ResendVerificationView.as_view(), name="resend-verification"),
    path("registration/", include("dj_rest_auth.registration.urls")),
    path("register/", RegisterView.as_view(), name="register"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("csrf/", CsrfView.as_view(), name="csrf"),
]
