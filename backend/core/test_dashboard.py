from allauth.account.models import EmailAddress
from django.contrib.admin.models import LogEntry
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User, RecruiterProfile
from companies.models import Company
from jobs.models import Job
from applications.models import Application
from notifications.models import Notification


class DashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser('admin@example.com', 'Strong-pass-123')
        self.user = User.objects.create_user('recruiter@example.com', 'Strong-pass-123', role='recruiter')
        self.recruiter = RecruiterProfile.objects.create(user=self.user, name='Recruiter')
        self.company = Company.objects.create(recruiter=self.recruiter, name='Campus Co', contact_email=self.user.email)
        self.root = '/api/v1/dashboard/'

    def test_admin_login_and_session(self):
        response = self.client.post(self.root + 'login/', {'email': self.admin.email, 'password': 'Strong-pass-123'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(self.root + 'overview/').status_code, 200)
        self.assertEqual(self.client.delete(self.root + 'session/').status_code, 204)
        self.assertEqual(self.client.get(self.root + 'overview/').status_code, 403)

    def test_non_admin_denied_all_operations(self):
        for user in (None, self.user, User.objects.create_user('staff@example.com', is_staff=True)):
            self.client.force_authenticate(user=user)
            for path in ('overview/', 'users/', 'companies/', 'jobs/', 'applications/', 'session/'):
                self.assertEqual(self.client.get(self.root + path).status_code, 403)
            self.assertEqual(self.client.post(self.root + f'users/{self.user.pk}/verify/').status_code, 403)
            self.assertEqual(self.client.delete(self.root + f'users/{self.user.pk}/').status_code, 403)
            self.assertEqual(self.client.post(self.root + f'companies/{self.company.pk}/approve/').status_code, 403)

    def test_read_only_search_and_no_sensitive_fields(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.root + 'users/?search=recruiter&status=unverified')
        self.assertEqual(response.data['count'], 1)
        self.assertNotIn('password', response.data['results'][0])
        for resource in ('users', 'companies', 'jobs', 'applications'):
            self.assertEqual(self.client.get(self.root + resource + '/').status_code, 200)
            self.assertEqual(self.client.post(self.root + resource + '/', {}).status_code, 405)
        self.assertEqual(self.client.patch(self.root + f'users/{self.user.pk}/', {'email': 'changed@example.com'}).status_code, 405)

    def test_verification_and_approval_are_separate_and_audited(self):
        self.client.force_authenticate(self.admin)
        for _ in range(2):
            self.assertEqual(self.client.post(self.root + f'users/{self.user.pk}/verify/').status_code, 200)
            self.assertEqual(self.client.post(self.root + f'users/{self.user.pk}/approve/').status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.approval_status, 'pending')
        self.assertTrue(EmailAddress.objects.get(user=self.user).verified)
        self.assertEqual(self.client.post(self.root + f'companies/{self.company.pk}/approve/').status_code, 200)
        self.recruiter.refresh_from_db()
        self.assertTrue(self.recruiter.is_fully_approved)
        self.assertEqual(self.recruiter.reviewed_by, self.admin)
        self.assertEqual(LogEntry.objects.count(), 3)
        self.assertEqual(Notification.objects.count(), 2)

    def test_deletion_requires_confirmation_and_protects_admins(self):
        self.client.force_authenticate(self.admin)
        path = self.root + f'users/{self.user.pk}/'
        self.assertEqual(self.client.delete(path, {'confirm_email': 'wrong'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(self.root + f'users/{self.admin.pk}/', {'confirm_email': self.admin.email}, format='json').status_code, 400)
        job = Job.objects.create(recruiter=self.recruiter, company=self.company, title='Intern', job_type='Internship', industry='Computer Science', description='Build', compensation_min=100)
        student = User.objects.create_user('student@example.com', role='student')
        Application.objects.create(job=job, student=student)
        self.assertEqual(self.client.delete(path, {'confirm_email': self.user.email}, format='json').status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Job.objects.exists())
        self.assertFalse(Application.objects.exists())
        self.assertTrue(User.objects.filter(pk=student.pk).exists())
        self.assertEqual(LogEntry.objects.get().action_flag, 3)

    def test_csrf_required_on_login_and_actions(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post(self.root + 'login/', {'email': self.admin.email, 'password': 'Strong-pass-123'}).status_code, 403)
        client.force_login(self.admin)
        self.assertEqual(client.post(self.root + f'users/{self.user.pk}/verify/').status_code, 403)
        self.assertEqual(client.delete(self.root + f'users/{self.user.pk}/').status_code, 403)
