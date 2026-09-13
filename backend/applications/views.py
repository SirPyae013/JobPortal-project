from core.files import private_resume_response
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsStudent
from notifications.services import notify
from .models import Application
from .serializers import ApplicationSerializer, ApplicationStatusSerializer


class ApplicationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Application.objects.none()
    serializer_class = ApplicationSerializer
    filterset_fields = ["status", "job"]
    ordering_fields = ["submitted_at", "updated_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Application.objects.none()
        queryset = Application.objects.select_related("job__company", "job__recruiter__user", "student__student_profile").prefetch_related("job__skills", "student__student_profile__skills")
        if not self.request.user.is_authenticated:
            return queryset.none()
        if self.request.user.role == User.Role.STUDENT:
            return queryset.filter(student=self.request.user)
        recruiter = getattr(self.request.user, "recruiter_profile", None)
        if recruiter and recruiter.is_fully_approved:
            return queryset.filter(job__recruiter=recruiter)
        return queryset.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != User.Role.STUDENT or not request.user.email_verified:
            return Response({"detail": "A verified student account is required."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        application = self.get_object()
        if application.student != request.user:
            return Response({"detail": "Only the applicant can withdraw this application."}, status=status.HTTP_403_FORBIDDEN)
        if application.status not in {Application.Status.SUBMITTED, Application.Status.UNDER_REVIEW}:
            return Response({"detail": "This application can no longer be withdrawn."}, status=status.HTTP_400_BAD_REQUEST)
        application.status = Application.Status.WITHDRAWN
        application.save(update_fields=["status", "updated_at"])
        notify(application.job.recruiter.user, "application_withdrawn", "Application withdrawn", f"{request.user.student_profile.name} withdrew from {application.job.title}.", job=application.job, application=application)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        application = self.get_object()
        if request.user.role != User.Role.RECRUITER or application.job.recruiter != request.user.recruiter_profile:
            return Response({"detail": "Only the job owner can update this status."}, status=status.HTTP_403_FORBIDDEN)
        if application.status == Application.Status.WITHDRAWN:
            return Response({"detail": "Withdrawn applications cannot be reopened."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ApplicationStatusSerializer(application, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["get"], url_path="resume")
    def resume(self, request, pk=None):
        application = self.get_object()
        if not application.resume:
            return Response({"detail": "No resume was submitted."}, status=status.HTTP_404_NOT_FOUND)
        return private_resume_response(application.resume, f"{application.applicant_name}-application-{application.pk}-resume.pdf")
