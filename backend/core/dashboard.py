"""Restricted operations for the custom administration workspace."""
from allauth.account.models import EmailAddress
from django.contrib.auth import authenticate, login, logout
from django.contrib.admin.models import LogEntry, CHANGE, DELETION
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Q, Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import BasePermission, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from accounts.models import User, RecruiterProfile
from companies.models import Company
from jobs.models import Job
from applications.models import Application
from notifications.services import notify
from .pagination import StandardPagination


class IsDashboardAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active and request.user.is_superuser)


@method_decorator(never_cache, name="dispatch")
class AdminView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsDashboardAdmin]


@method_decorator(csrf_protect, name="dispatch")
class AdminLogin(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        email, password = request.data.get("email"), request.data.get("password")
        if not isinstance(email, str) or not isinstance(password, str):
            raise ValidationError("Email and password are required.")
        user = authenticate(request, username=email.strip().lower(), password=password)
        if not user or not user.is_active or not user.is_superuser:
            return Response({"detail": "Invalid administrator credentials."}, status=403)
        login(request, user)
        return Response({"email": user.email})


class AdminSession(AdminView):
    def get(self, request):
        return Response({"email": request.user.email})

    def delete(self, request):
        logout(request)
        return Response(status=204)


def audit(actor, obj, message, flag=CHANGE):
    LogEntry.objects.create(user=actor, content_type=ContentType.objects.get_for_model(obj),
                            object_id=str(obj.pk), object_repr=str(obj)[:200],
                            action_flag=flag, change_message=message)


def user_data(user):
    student = getattr(user, "student_profile", None)
    recruiter = getattr(user, "recruiter_profile", None)
    return {
        "id": str(user.pk), "email": user.email,
        "name": student.name if student else recruiter.name if recruiter else user.get_full_name(),
        "role": "admin" if user.is_superuser else user.role,
        "active": user.is_active, "email_verified": user.email_verified,
        "joined": user.date_joined, "last_login": user.last_login,
        "protected": user.is_staff or user.is_superuser,
        "approval": recruiter.approval_status if recruiter else None,
        "university": student.university if student else None,
        "graduation_year": student.graduation_year if student else None,
        "bio": student.bio if student else None,
        "experience": student.experience if student else None,
        "skills": list(student.skills.values_list("name", flat=True)) if student else [],
    }


class AdminOverview(AdminView):
    def get(self, request):
        return Response({
            "users": User.objects.count(), "jobs": Job.objects.count(),
            "companies": Company.objects.count(), "applications": Application.objects.count(),
            "unverified_users": unverified_users(User.objects.all()).count(),
            "pending_recruiters": RecruiterProfile.objects.filter(approval_status="pending").count(),
            "pending_companies": Company.objects.filter(approval_status="pending").count(),
            "application_statuses": dict(Application.objects.values("status").annotate(total=Count("id")).values_list("status", "total")),
        })


def unverified_users(queryset):
    return queryset.annotate(current_email_verified=Exists(
        EmailAddress.objects.filter(user_id=OuterRef("pk"), email__iexact=OuterRef("email"), verified=True)
    )).filter(current_email_verified=False)


class AdminRecords(AdminView):
    def get(self, request, resource):
        search = request.query_params.get("search", "").strip()[:200]
        state = request.query_params.get("status", "")
        if resource == "users":
            queryset = User.objects.select_related("student_profile", "recruiter_profile").prefetch_related("student_profile__skills").order_by("-date_joined", "id")
            if search:
                queryset = queryset.filter(Q(email__icontains=search) | Q(student_profile__name__icontains=search) | Q(recruiter_profile__name__icontains=search))
            if state == "unverified":
                queryset = unverified_users(queryset)
            elif state in ("student", "recruiter"):
                queryset = queryset.filter(role=state, is_superuser=False)
            elif state == "pending":
                queryset = queryset.filter(recruiter_profile__approval_status="pending")
            serialize = user_data
        elif resource == "companies":
            queryset = Company.objects.select_related("recruiter__user").order_by("-updated_at", "id")
            if search:
                queryset = queryset.filter(Q(name__icontains=search) | Q(contact_email__icontains=search))
            if state in ("pending", "approved", "rejected"):
                queryset = queryset.filter(approval_status=state)
            serialize = lambda c: {"id": str(c.pk), "name": c.name, "email": c.contact_email, "recruiter": c.recruiter.user.email, "approval": c.approval_status, "website": c.website, "description": c.description, "industry": c.industry, "location": c.location, "rejection_reason": c.rejection_reason, "reviewed_at": c.reviewed_at}
        elif resource == "jobs":
            queryset = Job.objects.select_related("company", "recruiter__user").prefetch_related("skills").order_by("-created_at", "id")
            if search:
                queryset = queryset.filter(Q(title__icontains=search) | Q(company__name__icontains=search))
            serialize = lambda j: {"id": str(j.pk), "title": j.title, "company": j.company.name, "recruiter": j.recruiter.user.email, "type": j.job_type, "industry": j.industry, "compensation": j.compensation, "description": j.description, "skills": list(j.skills.values_list("name", flat=True)), "resume_required": j.resume_required, "cover_letter_required": j.cover_letter_required, "created": j.created_at}
        elif resource == "applications":
            queryset = Application.objects.select_related("student", "job__company").order_by("-submitted_at", "id")
            if search:
                queryset = queryset.filter(Q(student__email__icontains=search) | Q(job__title__icontains=search))
            if state in Application.Status.values:
                queryset = queryset.filter(status=state)
            serialize = lambda a: {"id": str(a.pk), "student": a.student.email, "job": a.job.title, "company": a.job.company.name, "status": a.status, "cover_letter": a.cover_letter, "resume_source": a.resume_source, "submitted": a.submitted_at}
        else:
            return Response(status=404)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response([serialize(obj) for obj in page])


class AdminUserAction(AdminView):
    @transaction.atomic
    def post(self, request, pk, action):
        user = get_object_or_404(User.objects.select_for_update(), pk=pk)
        if user.is_staff or user.is_superuser:
            raise ValidationError("Administrator and staff accounts are protected.")
        if action == "verify":
            address, _ = EmailAddress.objects.get_or_create(user=user, email=user.email, defaults={"primary": True})
            if not address.verified:
                address.verified = True
                address.save(update_fields=["verified"])
                audit(request.user, user, "Email manually verified through dashboard.")
        elif action == "approve":
            profile = get_object_or_404(RecruiterProfile.objects.select_for_update(), user=user)
            if profile.approval_status != "approved":
                profile.approval_status = "approved"
                profile.rejection_reason = ""
                profile.reviewed_by = request.user
                profile.reviewed_at = timezone.now()
                profile.save()
                audit(request.user, profile, "Recruiter approved through dashboard.")
                notify(user, "recruiter_approved", "Recruiter account approved", "Your recruiter account has been approved.")
        else:
            return Response(status=404)
        return Response(user_data(user))


class AdminUserDelete(AdminView):
    @transaction.atomic
    def delete(self, request, pk):
        user = get_object_or_404(User.objects.select_for_update(), pk=pk)
        if user.is_staff or user.is_superuser or user.pk == request.user.pk:
            raise ValidationError("Administrator and staff accounts cannot be deleted here.")
        if request.data.get("confirm_email") != user.email:
            raise ValidationError("Enter the user's exact email to confirm deletion.")
        audit(request.user, user, "User and linked records deleted through dashboard.", DELETION)
        user.delete()
        return Response(status=204)


class AdminCompanyApprove(AdminView):
    @transaction.atomic
    def post(self, request, pk):
        company = get_object_or_404(Company.objects.select_for_update(), pk=pk)
        if company.approval_status != "approved":
            company.approval_status = "approved"
            company.rejection_reason = ""
            company.reviewed_by = request.user
            company.reviewed_at = timezone.now()
            company.save()
            audit(request.user, company, "Company approved through dashboard.")
            notify(company.recruiter.user, "company_approved", "Company approved", f"{company.name} has been approved.")
        return Response({"detail": "Company approved."})
