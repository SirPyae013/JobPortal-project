from django.urls import path

from .views import RecruiterProfileMeView, StudentDirectoryView, StudentProfileMeView, StudentResumeView

urlpatterns = [
    path("recruiter-profile/me/", RecruiterProfileMeView.as_view(), name="recruiter-profile-me"),
    path("student-profile/me/", StudentProfileMeView.as_view(), name="student-profile-me"),
    path("students/", StudentDirectoryView.as_view(), name="student-directory"),
    path("students/<uuid:pk>/resume/", StudentResumeView.as_view(), name="student-resume"),
]
