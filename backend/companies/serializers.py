from rest_framework import serializers

from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = ["id", "name", "logo", "logo_url", "website", "description", "industry", "location", "contact_email", "approval_status", "rejection_reason", "reviewed_at", "updated_at"]
        read_only_fields = ["id", "logo_url", "approval_status", "rejection_reason", "reviewed_at", "updated_at"]
        extra_kwargs = {"logo": {"write_only": True}}

    def get_logo_url(self, company) -> str | None:
        return self.context["request"].build_absolute_uri(company.logo.url) if company.logo else None

    def update(self, instance, validated_data):
        identity_changed = any(
            field in validated_data and validated_data[field] != getattr(instance, field)
            for field in ("name", "website")
        )
        company = super().update(instance, validated_data)
        if identity_changed and company.approval_status == Company.Approval.APPROVED:
            company.approval_status = Company.Approval.PENDING
            company.rejection_reason = ""
            company.reviewed_by = None
            company.reviewed_at = None
            company.save(update_fields=["approval_status", "rejection_reason", "reviewed_by", "reviewed_at"])
        return company
