from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers

from accounts.serializers import StudentProfileSerializer
from core.validators import validate_pdf
from jobs.serializers import JobSerializer
from notifications.services import notify
from .models import Application


class ApplicationSerializer(serializers.ModelSerializer):
    job_details = JobSerializer(source="job", read_only=True)
    student_profile = serializers.SerializerMethodField()
    resume_source = serializers.ChoiceField(choices=Application.ResumeSource.choices, write_only=True, required=False, default=Application.ResumeSource.NONE)
    resume_file = serializers.FileField(write_only=True, required=False, validators=[validate_pdf])
    resume_download_url = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = ["id", "job", "job_details", "student_profile", "resume_source", "resume_file", "resume_download_url", "cover_letter", "status", "submitted_at", "updated_at"]
        read_only_fields = ["id", "student_profile", "resume_download_url", "status", "submitted_at", "updated_at"]

    def get_student_profile(self, application) -> dict:
        profile = getattr(application.student, "student_profile", None)
        return {
            "id": str(profile.id) if profile else None,
            "name": application.applicant_name,
            "university": profile.university if profile else "",
            "graduation_year": profile.graduation_year if profile else None,
            "skills": list(profile.skills.values_list("name", flat=True)) if profile else [],
        }

    def get_resume_download_url(self, application) -> str | None:
        if not application.resume:
            return None
        return self.context["request"].build_absolute_uri(f"/api/v1/applications/{application.id}/resume/")

    def validate(self, attrs):
        job = attrs.get("job")
        source = attrs.get("resume_source", Application.ResumeSource.NONE)
        upload = attrs.get("resume_file")
        profile = self.context["request"].user.student_profile
        if job and Application.objects.filter(job=job, student=self.context["request"].user).exists():
            raise serializers.ValidationError({"job": "You have already applied for this job."})
        if source == Application.ResumeSource.PROFILE and not profile.resume:
            raise serializers.ValidationError({"resume_source": "Your profile does not have a saved resume."})
        if source == Application.ResumeSource.UPLOAD and not upload:
            raise serializers.ValidationError({"resume_file": "Choose a PDF resume to upload."})
        if job.resume_required and source == Application.ResumeSource.NONE:
            raise serializers.ValidationError({"resume_source": "This job requires a resume."})
        if job.cover_letter_required and not attrs.get("cover_letter", "").strip():
            raise serializers.ValidationError({"cover_letter": "This job requires a cover letter."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        source = validated_data.pop("resume_source", Application.ResumeSource.NONE)
        upload = validated_data.pop("resume_file", None)
        student = self.context["request"].user
        application = Application.objects.create(student=student, resume_source=source, **validated_data)
        if source == Application.ResumeSource.PROFILE:
            profile_resume = student.student_profile.resume
            profile_resume.open("rb")
            application.resume.save(f"profile-{Path(profile_resume.name).name}", ContentFile(profile_resume.read()), save=False)
            profile_resume.close()
        elif source == Application.ResumeSource.UPLOAD:
            application.resume = upload
        try:
            application.full_clean()
            application.save()
        finally:
            # PDF validation opens saved snapshots; release the handle on Windows too.
            if application.resume:
                application.resume.close()
        notify(
            application.job.recruiter.user,
            "new_application",
            "New application received",
            f"{student.student_profile.name} applied for {application.job.title}.",
            job=application.job,
            application=application,
        )
        return application


class ApplicationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ["status"]

    def validate_status(self, value):
        if value == Application.Status.WITHDRAWN:
            raise serializers.ValidationError("Only the student can withdraw an application.")
        return value

    def update(self, instance, validated_data):
        previous = instance.status
        instance = super().update(instance, validated_data)
        if previous != instance.status:
            notify(
                instance.student,
                "application_status",
                "Application status updated",
                f"Your application for {instance.job.title} is now {instance.get_status_display()}.",
                job=instance.job,
                application=instance,
            )
        return instance
