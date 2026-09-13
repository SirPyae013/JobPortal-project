from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from companies.models import Company
from .models import RecruiterProfile, StudentProfile, User


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        payload = getattr(request, "data", {})
        role = payload.get("role", User.Role.STUDENT)
        name = payload.get("full_name") or user.get_full_name() or user.email.split("@")[0]
        if not hasattr(user, "student_profile") and not hasattr(user, "recruiter_profile"):
            user.role = role if role in User.Role.values else User.Role.STUDENT
            user.save(update_fields=["role"])
            if user.role == User.Role.RECRUITER:
                recruiter = RecruiterProfile.objects.create(user=user, name=name)
                Company.objects.create(recruiter=recruiter, name=payload.get("company_name", "Pending company"), contact_email=user.email)
            else:
                StudentProfile.objects.create(user=user, name=name, university=payload.get("university", ""))
        return user
