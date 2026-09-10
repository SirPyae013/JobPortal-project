from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.account.models import EmailAddress
from dj_rest_auth.registration.serializers import ResendEmailVerificationSerializer
from dj_rest_auth.registration.views import SocialLoginView
from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from .models import StudentProfile
from .permissions import IsApprovedRecruiter, IsStudent
from .serializers import CurrentUserSerializer, RegisterSerializer, StudentProfileSerializer
from .throttles import AuthEmailIPThrottle, VerificationEmailThrottle


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
            "Registration received. Check your email to verify your account."
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
            "detail": "If an unverified account exists, a verification email has been sent."
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


class StudentDirectoryView(generics.ListAPIView):
    serializer_class = StudentProfileSerializer
    permission_classes = [IsApprovedRecruiter]
    search_fields = ["name", "university", "skills__name"]
    filterset_fields = ["university", "graduation_year", "skills__name"]
    ordering_fields = ["name", "graduation_year", "updated_at"]

    def get_queryset(self):
        return StudentProfile.objects.filter(
            user__emailaddress__verified=True,
        ).exclude(name="").exclude(university="").exclude(graduation_year=None).exclude(bio="").exclude(resume="").filter(skills__isnull=False).distinct().order_by("name")


class StudentResumeView(APIView):
    permission_classes = [IsApprovedRecruiter]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        profile = get_object_or_404(StudentDirectoryView().get_queryset(), pk=pk)
        return FileResponse(profile.resume.open("rb"), as_attachment=True, filename=f"{profile.name}-resume.pdf")
