from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.account.models import EmailAddress
from dj_rest_auth.registration.serializers import ResendEmailVerificationSerializer
from dj_rest_auth.registration.views import SocialLoginView
from django.conf import settings
from core.files import private_resume_response
from django.shortcuts import get_object_or_404
from django.db.models import Exists, OuterRef
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from .models import RecruiterProfile, StudentProfile
from .permissions import IsApprovedRecruiter, IsRecruiter, IsStudent
from .serializers import CurrentUserSerializer, RecruiterProfileSerializer, RegisterSerializer, StudentProfileSerializer
from .throttles import AuthEmailIPThrottle, VerificationEmailThrottle
from .verification import verify_code


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^[0-9]{6}$", min_length=6, max_length=6)


class VerifyEmailCodeView(generics.GenericAPIView):
    serializer_class = VerifyCodeSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [AuthEmailIPThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Return outside the transaction so failed attempts remain persisted.
        if not verify_code(serializer.validated_data["email"].strip().lower(), serializer.validated_data["code"]):
            return Response({"detail": "Invalid or expired code. After five incorrect attempts, request a new code."}, status=400)
        return Response({"detail": "Email verified. You can now sign in."})


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [AuthEmailIPThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        message = (
            "Registration received. Enter the six-digit code sent to your email."
            if settings.EMAIL_VERIFICATION_ENABLED
            else "Registration successful. You can sign in now."
        )
        return Response({
            "message": message,
            "email_verification_required": settings.EMAIL_VERIFICATION_ENABLED,
        }, status=status.HTTP_201_CREATED)


class ResendVerificationView(generics.GenericAPIView):
    serializer_class = ResendEmailVerificationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthEmailIPThrottle, VerificationEmailThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = EmailAddress.objects.filter(
            email__iexact=serializer.validated_data["email"].strip(),
            verified=False, user__is_active=True,
        ).first()
        if address:
            address.send_confirmation(request)
        return Response({
            "detail": "If an unverified account exists, a verification code has been sent. Use the latest code; new codes can be requested once a minute."
        })


class GoogleLoginView(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user


class StudentProfileMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsStudent]
    serializer_class = StudentProfileSerializer

    def get_object(self):
        return self.request.user.student_profile


class RecruiterProfileMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsRecruiter]
    serializer_class = RecruiterProfileSerializer

    def get_object(self):
        return get_object_or_404(RecruiterProfile, user=self.request.user)


class StudentDirectoryView(generics.ListAPIView):
    serializer_class = StudentProfileSerializer
    permission_classes = [IsApprovedRecruiter]
    search_fields = ["name", "university", "skills__name"]
    filterset_fields = ["university", "graduation_year", "skills__name"]
    ordering_fields = ["name", "graduation_year", "updated_at"]

    def get_queryset(self):
        return StudentProfile.objects.filter(
            user__is_active=True, user__role="student", user__is_staff=False, user__is_superuser=False,
        ).annotate(current_email_verified=Exists(
            EmailAddress.objects.filter(user_id=OuterRef("user_id"), email__iexact=OuterRef("user__email"), verified=True)
        )).filter(current_email_verified=True).select_related("user").prefetch_related("skills").order_by("name", "id")


class StudentResumeView(APIView):
    permission_classes = [IsApprovedRecruiter]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        profile = get_object_or_404(StudentDirectoryView().get_queryset(), pk=pk)
        return private_resume_response(profile.resume, f"{profile.name}-profile-resume.pdf")
