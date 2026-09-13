from django.urls import path
from .dashboard import AdminLogin, AdminSession, AdminOverview, AdminRecords, AdminUserAction, AdminUserDelete, AdminCompanyApprove

urlpatterns = [
    path("login/", AdminLogin.as_view()),
    path("session/", AdminSession.as_view()),
    path("overview/", AdminOverview.as_view()),
    path("users/<uuid:pk>/", AdminUserDelete.as_view()),
    path("users/<uuid:pk>/<str:action>/", AdminUserAction.as_view()),
    path("companies/<uuid:pk>/approve/", AdminCompanyApprove.as_view()),
    path("<str:resource>/", AdminRecords.as_view()),
]
