from rest_framework.permissions import BasePermission

from .models import User


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == User.Role.STUDENT)


class IsRecruiter(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == User.Role.RECRUITER)


class IsApprovedRecruiter(BasePermission):
    message = "Your recruiter account and company must both be approved."

    def has_permission(self, request, view):
        recruiter = getattr(request.user, "recruiter_profile", None) if request.user.is_authenticated else None
        return bool(recruiter and request.user.email_verified and recruiter.is_fully_approved)
