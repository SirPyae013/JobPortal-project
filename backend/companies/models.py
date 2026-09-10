import uuid

from django.conf import settings
from django.db import models

from core.validators import randomized_upload_path, validate_image


def company_logo_path(instance, filename):
    return randomized_upload_path("company-logos", filename)


class Company(models.Model):
    class Approval(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recruiter = models.OneToOneField("accounts.RecruiterProfile", on_delete=models.CASCADE, related_name="company")
    name = models.CharField(max_length=255)
    logo = models.ImageField(upload_to=company_logo_path, validators=[validate_image], blank=True)
    website = models.URLField(blank=True)
    description = models.TextField(blank=True)
    industry = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField()
    approval_status = models.CharField(max_length=20, choices=Approval.choices, default=Approval.PENDING)
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_companies")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
