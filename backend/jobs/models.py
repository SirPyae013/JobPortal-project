import uuid

from django.db import models


class Job(models.Model):
    class JobType(models.TextChoices):
        INTERNSHIP = "Internship", "Internship"
        PART_TIME = "Part-Time", "Part-Time"
        FULL_TIME = "Full-Time", "Full-Time"
        REMOTE = "Remote", "Remote"

    class Industry(models.TextChoices):
        COMPUTER_SCIENCE = "Computer Science", "Computer Science"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recruiter = models.ForeignKey("accounts.RecruiterProfile", on_delete=models.CASCADE, related_name="jobs")
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="jobs")
    title = models.CharField(max_length=255)
    job_type = models.CharField(max_length=30, choices=JobType.choices)
    industry = models.CharField(max_length=60, choices=Industry.choices)
    description = models.TextField()
    skills = models.ManyToManyField("accounts.Skill", blank=True, related_name="jobs")
    compensation_min = models.PositiveBigIntegerField()
    compensation_max = models.PositiveBigIntegerField(null=True, blank=True)
    resume_required = models.BooleanField(default=True)
    cover_letter_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def compensation(self):
        if self.compensation_max:
            return f"MMK {self.compensation_min:,}-{self.compensation_max:,}/month"
        return f"MMK {self.compensation_min:,}/month"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.compensation_max is not None and self.compensation_max < self.compensation_min:
            raise ValidationError({"compensation_max": "Maximum compensation cannot be below the minimum."})

    def __str__(self):
        return f"{self.title} at {self.company.name}"
