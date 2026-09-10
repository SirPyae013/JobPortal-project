import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from core.validators import randomized_upload_path, validate_image, validate_pdf
from .managers import UserManager


def student_photo_path(instance, filename):
    return randomized_upload_path("student-photos", filename)


def student_resume_path(instance, filename):
    return randomized_upload_path("student-resumes", filename)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        RECRUITER = "recruiter", "Recruiter"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def save(self, *args, **kwargs):
        self.email = self.email.lower()
        super().save(*args, **kwargs)

    @property
    def email_verified(self):
        return self.emailaddress_set.filter(email__iexact=self.email, verified=True).exists()


class Skill(models.Model):
    name = models.CharField(max_length=80, unique=True)

    def save(self, *args, **kwargs):
        self.name = self.name.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class StudentProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    name = models.CharField(max_length=255)
    university = models.CharField(max_length=255, blank=True)
    graduation_year = models.PositiveSmallIntegerField(null=True, blank=True)
    skills = models.ManyToManyField(Skill, blank=True, related_name="students")
    experience = models.TextField(blank=True)
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to=student_photo_path, validators=[validate_image], blank=True)
    resume = models.FileField(upload_to=student_resume_path, validators=[validate_pdf], blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_complete(self):
        return all([self.name, self.university, self.graduation_year, self.bio, self.resume]) and self.skills.exists()

    def __str__(self):
        return self.name


class RecruiterProfile(models.Model):
    class Approval(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="recruiter_profile")
    name = models.CharField(max_length=255)
    approval_status = models.CharField(max_length=20, choices=Approval.choices, default=Approval.PENDING)
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_recruiters")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_fully_approved(self):
        return self.approval_status == self.Approval.APPROVED and hasattr(self, "company") and self.company.approval_status == self.company.Approval.APPROVED

    def __str__(self):
        return self.name
