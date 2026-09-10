from django.urls import path

from .views import StudentDirectoryView, StudentProfileMeView, StudentResumeView

urlpatterns = [
    path("student-profile/me/", StudentProfileMeView.as_view(), name="student-profile-me"),
    path("students/", StudentDirectoryView.as_view(), name="student-directory"),
    path("students/<uuid:pk>/resume/", StudentResumeView.as_view(), name="student-resume"),
]
