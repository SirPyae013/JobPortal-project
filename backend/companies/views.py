from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers

from accounts.models import RecruiterProfile, User
from .models import Company
from .serializers import CompanySerializer


class CompanyMeView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    def get_company(self, request):
        if request.user.role != User.Role.RECRUITER or not hasattr(request.user, "recruiter_profile"):
            return None
        return getattr(request.user.recruiter_profile, "company", None)

    def get_object(self):
        company = self.get_company(self.request)
        if not company:
            from rest_framework.exceptions import NotFound
            raise NotFound("Recruiter company not found.")
        return company


class CompanyResubmitView(APIView):
    @extend_schema(
        request=None,
        responses=inline_serializer(
            name="CompanyResubmitResponse",
            fields={"message": serializers.CharField()},
        ),
    )
    def post(self, request):
        if request.user.role != User.Role.RECRUITER or not hasattr(request.user, "recruiter_profile"):
            return Response({"detail": "Recruiter profile not found."}, status=status.HTTP_404_NOT_FOUND)
        recruiter = request.user.recruiter_profile
        company = getattr(recruiter, "company", None)
        if recruiter.approval_status == RecruiterProfile.Approval.REJECTED:
            recruiter.approval_status = RecruiterProfile.Approval.PENDING
            recruiter.rejection_reason = ""
            recruiter.reviewed_by = None
            recruiter.reviewed_at = None
            recruiter.save(update_fields=["approval_status", "rejection_reason", "reviewed_by", "reviewed_at"])
        if company and company.approval_status == Company.Approval.REJECTED:
            company.approval_status = Company.Approval.PENDING
            company.rejection_reason = ""
            company.reviewed_by = None
            company.reviewed_at = None
            company.save(update_fields=["approval_status", "rejection_reason", "reviewed_by", "reviewed_at"])
        return Response({"message": "Approval request resubmitted."})
