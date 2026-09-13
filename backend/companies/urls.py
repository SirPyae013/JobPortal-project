from django.urls import path
from .views import CompanyMeView, CompanyResubmitView

urlpatterns = [
    path("company/me/", CompanyMeView.as_view(), name="company-me"),
    path("company/me/resubmit/", CompanyResubmitView.as_view(), name="company-resubmit"),
]
