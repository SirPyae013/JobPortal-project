from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone

from notifications.services import notify
from .models import RecruiterProfile, Skill, StudentProfile, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "role", "is_staff", "is_active")
    search_fields = ("email",)
    fieldsets = ((None, {"fields": ("email", "password", "role")}), ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "role", "password1", "password2")}),)

    def get_readonly_fields(self, request, obj=None):
        return ("role",) if obj else ()


@admin.action(description="Approve selected recruiters")
def approve_recruiters(modeladmin, request, queryset):
    for profile in queryset:
        profile.approval_status = RecruiterProfile.Approval.APPROVED
        profile.rejection_reason = ""
        profile.reviewed_by = request.user
        profile.reviewed_at = timezone.now()
        profile.save()
        notify(profile.user, "recruiter_approved", "Recruiter account approved", "Your recruiter account has been approved.")


@admin.register(RecruiterProfile)
class RecruiterProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "approval_status", "reviewed_at")
    list_filter = ("approval_status",)
    search_fields = ("name", "user__email")
    actions = [approve_recruiters]

    def save_model(self, request, obj, form, change):
        previous = RecruiterProfile.objects.filter(pk=obj.pk).values_list("approval_status", flat=True).first() if change else None
        if obj.approval_status in {RecruiterProfile.Approval.APPROVED, RecruiterProfile.Approval.REJECTED}:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)
        if previous != obj.approval_status:
            notify(obj.user, f"recruiter_{obj.approval_status}", "Recruiter account review updated", obj.rejection_reason or f"Your recruiter account is now {obj.approval_status}.")


admin.site.register(StudentProfile)
admin.site.register(Skill)
admin.site.site_header = "Job Portal Administration"
admin.site.site_title = "Job Portal Admin"
