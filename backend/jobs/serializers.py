from rest_framework import serializers

from accounts.models import Skill
from core.fields import SkillNamesField
from .models import Job


class JobSerializer(serializers.ModelSerializer):
    skills = SkillNamesField(required=False)
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_logo_url = serializers.SerializerMethodField()
    compensation = serializers.CharField(read_only=True)

    class Meta:
        model = Job
        fields = ["id", "title", "company", "company_name", "company_logo_url", "job_type", "industry", "description", "skills", "compensation_min", "compensation_max", "compensation", "resume_required", "cover_letter_required", "created_at", "updated_at"]
        read_only_fields = ["id", "company", "company_name", "company_logo_url", "compensation", "created_at", "updated_at"]

    def get_company_logo_url(self, job) -> str | None:
        return self.context["request"].build_absolute_uri(job.company.logo.url) if job.company.logo else None

    def validate(self, attrs):
        minimum = attrs.get("compensation_min", getattr(self.instance, "compensation_min", None))
        maximum = attrs.get("compensation_max", getattr(self.instance, "compensation_max", None))
        if maximum is not None and minimum is not None and maximum < minimum:
            raise serializers.ValidationError({"compensation_max": "Maximum compensation cannot be below the minimum."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["skills"] = list(instance.skills.values_list("name", flat=True))
        return data

    def _set_skills(self, job, names):
        if names is not None:
            job.skills.set([Skill.objects.get_or_create(name=name.strip().lower())[0] for name in names if name.strip()])

    def create(self, validated_data):
        names = validated_data.pop("skills", [])
        job = super().create(validated_data)
        self._set_skills(job, names)
        return job

    def update(self, instance, validated_data):
        names = validated_data.pop("skills", None)
        job = super().update(instance, validated_data)
        self._set_skills(job, names)
        return job
