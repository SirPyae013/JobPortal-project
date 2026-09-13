import tempfile

from allauth.account.models import EmailAddress
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User, StudentProfile, RecruiterProfile, Skill
from companies.models import Company
from jobs.models import Job


class ResumeDownloadTests(TestCase):
    def setUp(self):
        self.storage = tempfile.TemporaryDirectory()
        self.settings_override = override_settings(MEDIA_ROOT=self.storage.name)
        self.settings_override.enable()
        self.addCleanup(self.storage.cleanup)
        self.addCleanup(self.settings_override.disable)
        self.client = APIClient()
        self.student = self.make_user('student@example.test', 'student')
        self.profile_bytes = b'%PDF-1.4\nCurrent profile resume\n'
        self.profile = StudentProfile.objects.create(user=self.student, name='Applicant', university='Campus', bio='Student', resume=self.pdf(self.profile_bytes))
        self.profile.skills.add(Skill.objects.create(name='python'))
        self.owner = self.make_user('owner@example.test', 'recruiter')
        self.recruiter = RecruiterProfile.objects.create(user=self.owner, name='Owner', approval_status='approved')
        self.company = Company.objects.create(recruiter=self.recruiter, name='Company', contact_email=self.owner.email, approval_status='approved')

    def make_user(self, email, role):
        user = User.objects.create_user(email, role=role)
        EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
        return user

    def pdf(self, content):
        return SimpleUploadedFile('resume.pdf', content, content_type='application/octet-stream')

    def apply(self, source, content=None):
        job = Job.objects.create(recruiter=self.recruiter, company=self.company, title='Intern', job_type='Internship', industry='Computer Science', description='Build', compensation_min=100)
        self.client.force_authenticate(self.student)
        payload = {'job': str(job.pk), 'resume_source': source}
        if content:
            payload['resume_file'] = self.pdf(content)
        response = self.client.post('/api/v1/applications/', payload, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data['resume_download_url'])
        return response.data['id']

    def download(self, url, expected):
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(b''.join(response.streaming_content), expected)
        response.close()

    def test_each_application_returns_its_own_file_for_incomplete_profile(self):
        first = b'%PDF-1.4\nFirst application-specific resume\n'
        second = b'%PDF-1.4\nSecond application-specific resume\n'
        first_id = self.apply('upload', first)
        second_id = self.apply('upload', second)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/v1/students/').data['count'], 1)
        self.download(f'/api/v1/applications/{first_id}/resume/', first)
        self.download(f'/api/v1/applications/{second_id}/resume/', second)

    def test_profile_update_changes_directory_file_but_preserves_application_snapshot(self):
        application_id = self.apply('profile')
        latest = b'%PDF-1.4\nUpdated profile resume\n'
        response = self.client.patch('/api/v1/student-profile/me/', {'resume': self.pdf(latest), 'graduation_year': 2027}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['is_complete'])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/v1/students/').data['count'], 1)
        self.download(f'/api/v1/students/{self.profile.pk}/resume/', latest)
        self.download(f'/api/v1/applications/{application_id}/resume/', self.profile_bytes)

    def test_another_recruiter_cannot_download_application(self):
        application_id = self.apply('profile')
        other = self.make_user('other@example.test', 'recruiter')
        recruiter = RecruiterProfile.objects.create(user=other, name='Other', approval_status='approved')
        Company.objects.create(recruiter=recruiter, name='Other', contact_email=other.email, approval_status='approved')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(f'/api/v1/applications/{application_id}/resume/').status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/v1/applications/{application_id}/resume/').status_code, 401)

    def test_missing_file_returns_not_found_without_a_fallback(self):
        application_id = self.apply('profile')
        from applications.models import Application
        application = Application.objects.get(pk=application_id)
        application.resume.storage.delete(application.resume.name)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(f'/api/v1/applications/{application_id}/resume/').status_code, 404)
