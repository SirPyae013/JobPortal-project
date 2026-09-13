import uuid

from django.db import models

from core.validators import randomized_upload_path, validate_pdf


def application_resume_path(instance, filename):
    return randomized_upload_path("application-resumes", filename)


class Application(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        UNDER_REVIEW = "under_review", "Under Review"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class ResumeSource(models.TextChoices):
        NONE = "none", "None"
        PROFILE = "profile", "Profile resume"
        UPLOAD = "upload", "Uploaded resume"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey("jobs.Job", on_delete=models.CASCADE, related_name="applications")
    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="job_applications")
    resume = models.FileField(upload_to=application_resume_path, validators=[validate_pdf], blank=True)
    resume_source = models.CharField(max_length=20, choices=ResumeSource.choices, default=ResumeSource.NONE)
    cover_letter = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.SUBMITTED)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at"]
        constraints = [models.UniqueConstraint(fields=["job", "student"], name="one_application_per_student_job")]

    def __str__(self):
        return f"{self.student.email} - {self.job.title}"

    @property
    def applicant_name(self):
        profile = getattr(self.student, "student_profile", None)
        return (profile.name if profile else "") or self.student.get_full_name() or "Applicant"
