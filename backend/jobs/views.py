from django.db.models import Q
from rest_framework import permissions, viewsets

from accounts.permissions import IsApprovedRecruiter
from .models import Job
from .serializers import JobSerializer


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.select_related("company", "recruiter__user").prefetch_related("skills")
    serializer_class = JobSerializer
    filterset_fields = ["job_type", "industry"]
    search_fields = ["title", "company__name", "description", "skills__name"]
    ordering_fields = ["created_at", "title", "compensation_min", "compensation_max"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.AllowAny()]
        return [IsApprovedRecruiter()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("mine") == "1" and self.request.user.is_authenticated and hasattr(self.request.user, "recruiter_profile"):
            queryset = queryset.filter(recruiter=self.request.user.recruiter_profile)
        if self.action not in {"list", "retrieve"} and self.request.user.is_authenticated:
            queryset = queryset.filter(recruiter=self.request.user.recruiter_profile)
        return queryset.distinct()

    def perform_create(self, serializer):
        recruiter = self.request.user.recruiter_profile
        serializer.save(recruiter=recruiter, company=recruiter.company)
