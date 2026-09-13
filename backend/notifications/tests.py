from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from .services import notify


class NotificationIsolationTests(TestCase):
    def test_account_switch_never_returns_other_recruiter_approval(self):
        first = User.objects.create_user('first@example.test', role='recruiter')
        second = User.objects.create_user('second@example.test', role='recruiter')
        student = User.objects.create_user('student@example.test', role='student')
        notice = notify(first, 'recruiter_approved', 'Recruiter approved', 'Your account is approved.')
        client = APIClient()
        client.force_authenticate(first)
        response = client.get('/api/v1/notifications/')
        self.assertEqual(response.data['count'], 1)
        self.assertIn('no-store', response['Cache-Control'])
        for user in (second, student):
            client.force_authenticate(user)
            self.assertEqual(client.get('/api/v1/notifications/').data['count'], 0)
            self.assertEqual(client.get('/api/v1/notifications/unread-count/').data['count'], 0)
            self.assertEqual(client.get(f'/api/v1/notifications/{notice.pk}/').status_code, 404)
            self.assertEqual(client.post(f'/api/v1/notifications/{notice.pk}/read/').status_code, 404)
            self.assertEqual(client.post('/api/v1/notifications/read-all/').data['updated'], 0)
        notice.refresh_from_db()
        self.assertIsNone(notice.read_at)
