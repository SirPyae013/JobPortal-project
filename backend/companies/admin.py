from django.contrib import admin
from django.utils import timezone

from notifications.services import notify
from .models import Company


@admin.action(description="Approve selected companies")
def approve_companies(modeladmin, request, queryset):
    for company in queryset:
        company.approval_status = Company.Approval.APPROVED
        company.rejection_reason = ""
        company.reviewed_by = request.user
        company.reviewed_at = timezone.now()
        company.save()
        notify(company.recruiter.user, "company_approved", "Company approved", f"{company.name} has been approved.")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "recruiter", "approval_status", "industry", "updated_at")
    list_filter = ("approval_status", "industry")
    search_fields = ("name", "recruiter__user__email", "location")
    actions = [approve_companies]

    def save_model(self, request, obj, form, change):
        previous = Company.objects.filter(pk=obj.pk).values_list("approval_status", flat=True).first() if change else None
        if obj.approval_status in {Company.Approval.APPROVED, Company.Approval.REJECTED}:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)
        if previous != obj.approval_status:
            notify(obj.recruiter.user, f"company_{obj.approval_status}", "Company review updated", obj.rejection_reason or f"{obj.name} is now {obj.approval_status}.")
