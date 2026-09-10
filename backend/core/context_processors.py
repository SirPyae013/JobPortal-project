def admin_stats(request):
    if not request.path.startswith("/admin/") or not getattr(request.user, "is_staff", False):
        return {}
    from accounts.models import RecruiterProfile, User
    from applications.models import Application
    from companies.models import Company
    from jobs.models import Job
    from notifications.models import Notification

    application_statuses = {
        label: Application.objects.filter(status=value).count()
        for value, label in Application.Status.choices
    }
    return {"job_portal_stats": {
        "students": User.objects.filter(role=User.Role.STUDENT, is_staff=False).count(),
        "recruiters": User.objects.filter(role=User.Role.RECRUITER).count(),
        "pending_recruiters": RecruiterProfile.objects.filter(approval_status="pending").count(),
        "pending_companies": Company.objects.filter(approval_status="pending").count(),
        "jobs": Job.objects.count(),
        "applications": Application.objects.count(),
        "unread_notifications": Notification.objects.filter(read_at__isnull=True).count(),
    }, "application_statuses": application_statuses,
        "recent_activity": Notification.objects.select_related("recipient").order_by("-created_at")[:10],
    }
