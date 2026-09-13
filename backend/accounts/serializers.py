from allauth.account.models import EmailAddress
from allauth.account.utils import setup_user_email
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from companies.models import Company
from core.fields import SkillNamesField
from .models import RecruiterProfile, Skill, StudentProfile, User


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=User.Role.choices)
    full_name = serializers.CharField(max_length=255)
    university = serializers.CharField(max_length=255, required=False, allow_blank=True)
    company_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    company_website = serializers.URLField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["role"] == User.Role.STUDENT and not attrs.get("university"):
            raise serializers.ValidationError({"university": "University is required for students."})
        if attrs["role"] == User.Role.RECRUITER and not attrs.get("company_name"):
            raise serializers.ValidationError({"company_name": "Company name is required for recruiters."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data["role"]
        user = User.objects.create_user(
            email=validated_data["email"], password=validated_data["password"], role=role
        )
        if role == User.Role.STUDENT:
            StudentProfile.objects.create(user=user, name=validated_data["full_name"], university=validated_data.get("university", ""))
        else:
            recruiter = RecruiterProfile.objects.create(user=user, name=validated_data["full_name"])
            Company.objects.create(
                recruiter=recruiter,
                name=validated_data["company_name"],
                website=validated_data.get("company_website", ""),
                contact_email=user.email,
            )
        setup_user_email(self.context["request"], user, [])
        email_address = EmailAddress.objects.get(user=user, email=user.email)
        if settings.EMAIL_VERIFICATION_ENABLED:
            email_address.send_confirmation(self.context["request"], signup=True)
        else:
            email_address.verified = True
            email_address.primary = True
            email_address.save(update_fields=["verified", "primary"])
        return user


class StudentProfileSerializer(serializers.ModelSerializer):
    skills = SkillNamesField(required=False)
    is_complete = serializers.BooleanField(read_only=True)
    has_resume = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = ["id", "name", "university", "graduation_year", "skills", "experience", "bio", "photo", "photo_url", "resume", "has_resume", "is_complete", "updated_at"]
        read_only_fields = ["id", "is_complete", "updated_at"]
        extra_kwargs = {"resume": {"write_only": True}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["skills"] = list(instance.skills.values_list("name", flat=True))
        return data

    def get_has_resume(self, instance) -> bool:
        return bool(instance.resume)

    def get_photo_url(self, instance) -> str | None:
        return self.context["request"].build_absolute_uri(instance.photo.url) if instance.photo else None

    def update(self, instance, validated_data):
        skill_names = validated_data.pop("skills", None)
        instance = super().update(instance, validated_data)
        if skill_names is not None:
            skills = [Skill.objects.get_or_create(name=name.strip().lower())[0] for name in skill_names if name.strip()]
            instance.skills.set(skills)
        return instance


class RecruiterProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = ["id", "name", "email", "job_title", "phone", "bio", "photo", "photo_url", "approval_status", "rejection_reason"]
        read_only_fields = ["id", "email", "approval_status", "rejection_reason"]
        extra_kwargs = {"photo": {"write_only": True}}

    def get_photo_url(self, instance) -> str | None:
        return self.context["request"].build_absolute_uri(instance.photo.url) if instance.photo else None


class CurrentUserSerializer(serializers.ModelSerializer):
    email_verified = serializers.BooleanField(read_only=True)
    capabilities = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "role", "email_verified", "capabilities", "profile"]

    def get_capabilities(self, user) -> dict:
        recruiter = getattr(user, "recruiter_profile", None)
        approved = bool(user.role == User.Role.RECRUITER and recruiter and recruiter.is_fully_approved and user.email_verified)
        return {
            "browse_jobs": True,
            "apply": user.role == User.Role.STUDENT and user.email_verified,
            "manage_jobs": approved,
            "browse_students": approved,
        }

    def get_profile(self, user) -> dict | None:
        if user.role == User.Role.STUDENT and hasattr(user, "student_profile"):
            return {"name": user.student_profile.name, "is_complete": user.student_profile.is_complete}
        if user.role == User.Role.RECRUITER and hasattr(user, "recruiter_profile"):
            recruiter = user.recruiter_profile
            company = getattr(recruiter, "company", None)
            return {
                "name": recruiter.name,
                "photo_url": self.context["request"].build_absolute_uri(recruiter.photo.url) if recruiter.photo else None,
                "approval_status": recruiter.approval_status,
                "rejection_reason": recruiter.rejection_reason,
                "company_approval_status": company.approval_status if company else None,
                "company_rejection_reason": company.rejection_reason if company else "",
            }
        return None
