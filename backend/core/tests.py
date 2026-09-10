from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from allauth.account.models import EmailAddress

from accounts.models import RecruiterProfile, Skill, StudentProfile, User
from applications.models import Application
from companies.models import Company
from jobs.models import Job
from notifications.models import Notification


def verified(user):
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    return user


class JobPortalApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = verified(User.objects.create_user("student@example.com", "Strong-pass-123", role="student"))
        self.student_profile = StudentProfile.objects.create(
            user=self.student,
            name="Mya Student",
            university="University of Yangon",
            graduation_year=2027,
            bio="Backend-focused computer science student.",
            resume=SimpleUploadedFile("resume.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
        )
        self.skill = Skill.objects.create(name="python")
        self.student_profile.skills.add(self.skill)
        self.recruiter_user = verified(User.objects.create_user("recruiter@example.com", "Strong-pass-123", role="recruiter"))
        self.recruiter = RecruiterProfile.objects.create(user=self.recruiter_user, name="Aung Recruiter", approval_status="approved")
        self.company = Company.objects.create(recruiter=self.recruiter, name="Yangon Tech", website="https://example.com", contact_email="jobs@example.com", approval_status="approved")
        self.job = Job.objects.create(recruiter=self.recruiter, company=self.company, title="Backend Intern", job_type="Internship", industry="Computer Science", description="Build APIs", compensation_min=400000, compensation_max=600000)
        self.job.skills.add(self.skill)

    def test_jobs_are_public_and_sorted_by_compensation(self):
        response = self.client.get("/api/v1/jobs/?ordering=-compensation_min")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["compensation"], "MMK 400,000-600,000/month")

    def test_unapproved_recruiter_cannot_create_job(self):
        self.recruiter.approval_status = "pending"
        self.recruiter.save()
        self.client.force_authenticate(self.recruiter_user)
        response = self.client.post("/api/v1/jobs/", {"title": "Blocked", "job_type": "Internship", "industry": "Design", "description": "No", "compensation_min": 1}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_complete_student_is_visible_to_approved_recruiter(self):
        self.client.force_authenticate(self.recruiter_user)
        response = self.client.get("/api/v1/students/?search=python")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_application_snapshot_duplicate_and_notification(self):
        self.client.force_authenticate(self.student)
        response = self.client.post("/api/v1/applications/", {"job": str(self.job.id), "resume_source": "profile", "cover_letter": "I would like to apply."}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Application.objects.get().resume.name.startswith("application-resumes/"))
        self.assertTrue(Notification.objects.filter(recipient=self.recruiter_user, kind="new_application").exists())
        duplicate = self.client.post("/api/v1/applications/", {"job": str(self.job.id), "resume_source": "profile"}, format="multipart")
        self.assertEqual(duplicate.status_code, 400)

    def test_application_accepts_pdf_with_generic_mime_type(self):
        self.client.force_authenticate(self.student)
        resume = SimpleUploadedFile(
            "resume.pdf", b"%PDF-1.4 test", content_type="application/octet-stream"
        )
        response = self.client.post(
            "/api/v1/applications/",
            {"job": str(self.job.id), "resume_source": "upload", "resume_file": resume},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)

    def test_invalid_pdf_returns_validation_error(self):
        self.client.force_authenticate(self.student)
        resume = SimpleUploadedFile(
            "resume.pdf", b"not a pdf", content_type="application/pdf"
        )
        response = self.client.post(
            "/api/v1/applications/",
            {"job": str(self.job.id), "resume_source": "upload", "resume_file": resume},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("resume_file", response.data["fields"])

    def test_job_delete_cascades_applications_and_notifications(self):
        application = Application.objects.create(job=self.job, student=self.student)
        Notification.objects.create(recipient=self.student, kind="application_status", title="Update", message="Updated", job=self.job, application=application)
        self.client.force_authenticate(self.recruiter_user)
        response = self.client.delete(f"/api/v1/jobs/{self.job.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Application.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_company_identity_edit_requires_reapproval(self):
        self.client.force_authenticate(self.recruiter_user)
        response = self.client.patch("/api/v1/company/me/", {"name": "New Company Name"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.approval_status, "pending")

    def test_student_can_withdraw_non_final_application(self):
        application = Application.objects.create(job=self.job, student=self.student, status="under_review")
        self.client.force_authenticate(self.student)
        response = self.client.post(f"/api/v1/applications/{application.id}/withdraw/")
        self.assertEqual(response.status_code, 200)
        application.refresh_from_db()
        self.assertEqual(application.status, "withdrawn")

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        EMAIL_VERIFICATION_ENABLED=True,
        ACCOUNT_EMAIL_VERIFICATION="mandatory",
    )
    def test_registration_creates_unverified_pending_recruiter_and_company(self):
        response = self.client.post("/api/v1/auth/register/", {
            "email": "new-recruiter@example.com",
            "password": "A-very-strong-password-456",
            "role": "recruiter",
            "full_name": "New Recruiter",
            "company_name": "New Company",
            "company_website": "https://new.example.com",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="new-recruiter@example.com")
        self.assertFalse(user.email_verified)
        self.assertEqual(user.recruiter_profile.approval_status, "pending")
        self.assertEqual(user.recruiter_profile.company.approval_status, "pending")

    def test_job_requirements_are_enforced(self):
        self.client.force_authenticate(self.student)
        response = self.client.post("/api/v1/applications/", {
            "job": str(self.job.id), "resume_source": "none"
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.job.resume_required = False
        self.job.cover_letter_required = True
        self.job.save()
        response = self.client.post("/api/v1/applications/", {
            "job": str(self.job.id), "resume_source": "none"
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_recruiter_status_update_notifies_student(self):
        application = Application.objects.create(job=self.job, student=self.student)
        self.client.force_authenticate(self.recruiter_user)
        response = self.client.patch(
            f"/api/v1/applications/{application.id}/status/",
            {"status": "accepted"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(
            recipient=self.student, kind="application_status"
        ).exists())

    def test_private_resumes_require_permission_and_are_not_public_media(self):
        direct = self.client.get(f"/media/{self.student_profile.resume.name}")
        self.assertEqual(direct.status_code, 404)
        protected = self.client.get(f"/api/v1/students/{self.student_profile.id}/resume/")
        self.assertEqual(protected.status_code, 401)
        self.client.force_authenticate(self.recruiter_user)
        allowed = self.client.get(f"/api/v1/students/{self.student_profile.id}/resume/")
        self.assertEqual(allowed.status_code, 200)

    def test_notification_read_actions_are_scoped_to_current_user(self):
        notification = Notification.objects.create(
            recipient=self.student, kind="application_status", title="Update", message="Changed"
        )
        Notification.objects.create(
            recipient=self.recruiter_user, kind="new_application", title="Other", message="Other"
        )
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get("/api/v1/notifications/unread-count/").data["count"], 1)
        response = self.client.post(f"/api/v1/notifications/{notification.id}/read/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/v1/notifications/unread-count/").data["count"], 0)

    @override_settings(EMAIL_VERIFICATION_ENABLED=True, ACCOUNT_EMAIL_VERIFICATION="mandatory")
    def test_unverified_user_cannot_login(self):
        user = User.objects.create_user(
            "unverified@example.com", "A-very-strong-password-789", role="student"
        )
        StudentProfile.objects.create(user=user, name="Unverified Student")
        EmailAddress.objects.create(
            user=user, email=user.email, verified=False, primary=True
        )
        response = self.client.post("/api/v1/auth/login/", {
            "email": user.email, "password": "A-very-strong-password-789"
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_verified_login_sets_http_only_jwt_cookies(self):
        response = self.client.post("/api/v1/auth/login/", {
            "email": self.student.email, "password": "Strong-pass-123"
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("jobportal_access", response.cookies)
        self.assertIn("jobportal_refresh", response.cookies)
        self.assertTrue(response.cookies["jobportal_access"]["httponly"])
        self.assertTrue(response.cookies["jobportal_refresh"]["httponly"])
