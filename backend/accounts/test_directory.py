from allauth.account.models import EmailAddress
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, StudentProfile, RecruiterProfile, Skill
from companies.models import Company


class StudentDirectoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user = User.objects.create_user('recruiter@example.test', role='recruiter')
        EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
        recruiter = RecruiterProfile.objects.create(user=user, name='Recruiter', approval_status='approved')
        Company.objects.create(recruiter=recruiter, name='Company', contact_email=user.email, approval_status='approved')
        self.client.force_authenticate(user)

    def student(self, email, verified=True, **flags):
        user = User.objects.create_user(email, role='student', **flags)
        EmailAddress.objects.create(user=user, email=email, verified=verified, primary=True)
        return StudentProfile.objects.create(user=user, name='Actual Student', university='Actual University')

    def test_incomplete_student_is_listed_with_actual_details(self):
        profile = self.student('student@example.test')
        response = self.client.get('/api/v1/students/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        record = response.data['results'][0]
        self.assertEqual(str(record['id']), str(profile.pk))
        self.assertEqual(record['name'], profile.name)
        self.assertEqual(record['university'], profile.university)
        self.assertIsNone(record['graduation_year'])
        self.assertFalse(record['has_resume'])
        self.assertFalse(record['is_complete'])
        self.assertEqual(self.client.get(f'/api/v1/students/{profile.pk}/resume/').status_code, 404)

    def test_inactive_unverified_admin_and_old_email_verification_are_excluded(self):
        self.student('inactive@example.test', is_active=False)
        self.student('unverified@example.test', verified=False)
        self.student('admin@example.test', is_staff=True, is_superuser=True)
        changed = self.student('changed@example.test', verified=False)
        EmailAddress.objects.create(user=changed.user, email='old@example.test', verified=True)
        self.assertEqual(self.client.get('/api/v1/students/').data['count'], 0)

    def test_search_and_refresh_return_updated_database_values(self):
        profile = self.student('student@example.test')
        skill = Skill.objects.create(name='python')
        profile.skills.add(skill)
        self.assertEqual(self.client.get('/api/v1/students/?search=python').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/students/?search=missing').data['count'], 0)
        profile.name = 'Updated Name'
        profile.save()
        result = self.client.get('/api/v1/students/?search=Updated').data['results'][0]
        self.assertEqual(result['name'], 'Updated Name')

    def test_directory_remains_private_to_approved_recruiters(self):
        profile = self.student('student@example.test')
        self.client.force_authenticate(profile.user)
        self.assertEqual(self.client.get('/api/v1/students/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/students/').status_code, 401)
