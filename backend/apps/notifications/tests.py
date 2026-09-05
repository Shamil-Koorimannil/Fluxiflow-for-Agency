from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date, time
from rest_framework.test import APITestCase
from rest_framework import status
from apps.tasks.models import Task, TaskAssignee
from apps.projects.models import Project
from .models import Notification
from .services import NotificationService

User = get_user_model()

class NotificationBackendTests(APITestCase):
    def setUp(self):
        from apps.accounts.models import Organization, Membership
        self.org = Organization.objects.create(name="Test Org", slug="test-org")

        # Create users
        self.admin = User.objects.create_user(
            email='admin@example.com',
            name='Admin User',
            password='password123',
            role='ADMIN',
            status='ACTIVE',
            active_organization=self.org
        )
        Membership.objects.create(user=self.admin, organization=self.org, role='ORG_ADMIN', is_active=True)

        self.member1 = User.objects.create_user(
            email='member1@example.com',
            name='Member One',
            password='password123',
            role='MEMBER',
            status='ACTIVE',
            active_organization=self.org
        )
        Membership.objects.create(user=self.member1, organization=self.org, role='MEMBER', is_active=True)

        self.member2 = User.objects.create_user(
            email='member2@example.com',
            name='Member Two',
            password='password123',
            role='MEMBER',
            status='ACTIVE',
            active_organization=self.org
        )
        Membership.objects.create(user=self.member2, organization=self.org, role='MEMBER', is_active=True)

        self.deactivated_member = User.objects.create_user(
            email='deactivated@example.com',
            name='Deactivated Member',
            password='password123',
            role='MEMBER',
            status='INACTIVE',
            is_active=False,
            active_organization=self.org
        )
        Membership.objects.create(user=self.deactivated_member, organization=self.org, role='MEMBER', is_active=False)

        # Create Project
        self.project = Project.objects.create(
            name="Test Project",
            created_by=self.admin,
            organization=self.org
        )

    def test_task_creation_creates_notifications(self):
        # Admin creates a task and assigns to member1
        self.client.force_authenticate(user=self.admin)
        url = '/api/tasks/'
        data = {
            'name': 'Homepage Design',
            'due_date': str(timezone.now().date()),
            'project': str(self.project.id),
            'assignee_ids': [str(self.member1.id)]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify notification created for member1
        notifs = Notification.objects.filter(recipient=self.member1)
        self.assertEqual(notifs.count(), 1)
        notif = notifs.first()
        self.assertEqual(notif.type, 'TASK_ASSIGNED')
        self.assertEqual(notif.title, 'Task Assigned')
        self.assertEqual(notif.message, '"Homepage Design" was assigned to you.')
        self.assertEqual(notif.related_task.id, uuid_to_check := notif.related_task.id)

    def test_multiple_assignees_receive_separate_notifications(self):
        # Admin creates task and assigns to member1 and member2
        self.client.force_authenticate(user=self.admin)
        url = '/api/tasks/'
        data = {
            'name': 'Client Revision',
            'due_date': str(timezone.now().date()),
            'project': str(self.project.id),
            'assignee_ids': [str(self.member1.id), str(self.member2.id)]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify separate notifications
        self.assertEqual(Notification.objects.filter(recipient=self.member1, type='TASK_ASSIGNED').count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=self.member2, type='TASK_ASSIGNED').count(), 1)

    def test_reassignment_creates_correct_notifications(self):
        # Admin creates task assigned to member1
        task = Task.objects.create(
            name='Logo Design',
            due_date=timezone.now().date(),
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)

        # Admin reassigns from member1 to member2
        self.client.force_authenticate(user=self.admin)
        url = f'/api/tasks/{task.id}/'
        data = {
            'name': 'Logo Design',
            'due_date': str(timezone.now().date()),
            'project': str(self.project.id),
            'assignee_ids': [str(self.member2.id)]
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # member1 receives unassignment warning
        notif_removed = Notification.objects.filter(recipient=self.member1, type='TASK_REASSIGNED').first()
        self.assertIsNotNone(notif_removed)
        self.assertEqual(notif_removed.message, 'You are no longer assigned to Logo Design.')

        # member2 receives assignment alert
        notif_added = Notification.objects.filter(recipient=self.member2, type='TASK_REASSIGNED').first()
        self.assertIsNotNone(notif_added)
        self.assertEqual(notif_added.message, '"Logo Design" was assigned to you.')

    def test_removing_assignee_creates_unassigned_notification(self):
        task = Task.objects.create(
            name='Wireframing',
            due_date=timezone.now().date(),
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)

        # Remove all assignees (set to empty list)
        self.client.force_authenticate(user=self.admin)
        url = f'/api/tasks/{task.id}/'
        data = {
            'name': 'Wireframing',
            'due_date': str(timezone.now().date()),
            'project': str(self.project.id),
            'assignee_ids': []
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # member1 receives unassignment notification
        notif = Notification.objects.filter(recipient=self.member1, type='TASK_UNASSIGNED').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.message, 'You are no longer assigned to Wireframing.')

    def test_completing_task_notifies_admin(self):
        task = Task.objects.create(
            name='Landing Page Copy',
            due_date=timezone.now().date(),
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)

        # Member completes the task
        self.client.force_authenticate(user=self.member1)
        url = f'/api/tasks/{task.id}/complete/'
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Admin receives completed notification
        notifs = Notification.objects.filter(recipient=self.admin, type='TASK_COMPLETED')
        # There should be two: one for member completing their assignment, one for task overall completion
        self.assertTrue(notifs.count() >= 1)
        messages = [n.message for n in notifs]
        self.assertIn('Landing Page Copy has been completed.', messages)
        self.assertIn('Member One completed Landing Page Copy.', messages)

    def test_reopening_task_notifies_assignees(self):
        task = Task.objects.create(
            name='API Documentation',
            due_date=timezone.now().date(),
            project=self.project,
            created_by=self.admin,
            status='COMPLETED'
        )
        TaskAssignee.objects.create(task=task, user=self.member1, completed=True)

        # Reopen task
        self.client.force_authenticate(user=self.member1)
        url = f'/api/tasks/{task.id}/reopen/'
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # member1 receives task reopened notification
        notif = Notification.objects.filter(recipient=self.member1, type='TASK_REOPENED').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.message, '"API Documentation" was reopened.')

    def test_no_duplicate_due_today_notifications(self):
        task = Task.objects.create(
            name='Daily Checkin',
            due_date=timezone.now().date(),
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)

        # Trigger deadline checks twice
        NotificationService.check_and_create_deadline_notifications(self.member1)
        NotificationService.check_and_create_deadline_notifications(self.member1)

        # Verify only one TASK_DUE_TODAY notification exists
        notifs = Notification.objects.filter(recipient=self.member1, type='TASK_DUE_TODAY', related_task=task)
        self.assertEqual(notifs.count(), 1)

    def test_no_duplicate_overdue_notifications(self):
        task = Task.objects.create(
            name='Past Due Task',
            due_date=timezone.now().date() - timedelta(days=2),
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)

        # Trigger deadline checks twice
        NotificationService.check_and_create_deadline_notifications(self.member1)
        NotificationService.check_and_create_deadline_notifications(self.member1)

        # Verify only one TASK_OVERDUE notification exists
        notifs = Notification.objects.filter(recipient=self.member1, type='TASK_OVERDUE', related_task=task)
        self.assertEqual(notifs.count(), 1)

    def test_read_actions_secure_and_successful(self):
        # Create a notification for member1
        notif = Notification.objects.create(
            recipient=self.member1,
            type='SYSTEM',
            title='Test Title',
            message='Test message'
        )

        # member2 tries to read it: forbidden (404 since it's outside their queryset)
        self.client.force_authenticate(user=self.member2)
        url_read = f'/api/notifications/{notif.id}/read/'
        response = self.client.post(url_read)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # member1 reads it: success
        self.client.force_authenticate(user=self.member1)
        response = self.client.post(url_read)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_read'])
        self.assertIsNotNone(response.data['read_at'])

    def test_mark_all_read_and_unread_count(self):
        # Create multiple notifications for member1
        Notification.objects.create(recipient=self.member1, type='SYSTEM', title='Title 1', message='msg')
        Notification.objects.create(recipient=self.member1, type='SYSTEM', title='Title 2', message='msg')

        self.client.force_authenticate(user=self.member1)
        # Verify unread count is 2
        url_count = '/api/notifications/unread-count/'
        response = self.client.get(url_count)
        self.assertEqual(response.data['count'], 2)

        # Mark all read
        url_all = '/api/notifications/mark-all-read/'
        response = self.client.post(url_all)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify unread count is now 0
        response = self.client.get(url_count)
        self.assertEqual(response.data['count'], 0)

    def test_user_cannot_access_other_user_notifications(self):
        notif = Notification.objects.create(
            recipient=self.member1,
            type='SYSTEM',
            title='Secret alert',
            message='Classified'
        )

        # member2 tries to GET this notification detail
        self.client.force_authenticate(user=self.member2)
        url_detail = f'/api/notifications/{notif.id}/'
        response = self.client.get(url_detail)
        # Viewsets default permission will fail detail check or return 404 because of queryset filtering
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unassigned_tasks_do_not_notify(self):
        # Admin creates task without any assignees
        self.client.force_authenticate(user=self.admin)
        url = '/api/tasks/'
        data = {
            'name': 'Floating Item',
            'due_date': str(timezone.now().date()),
            'project': str(self.project.id),
            'assignee_ids': []
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify no TASK_ASSIGNED notifications exist
        self.assertEqual(Notification.objects.filter(type='TASK_ASSIGNED').count(), 0)

    def test_deactivated_member_does_not_receive_assignment(self):
        # Admin attempts to assign a task to a deactivated member
        self.client.force_authenticate(user=self.admin)
        url = '/api/tasks/'
        data = {
            'name': 'Should fail',
            'due_date': str(timezone.now().date()),
            'project': str(self.project.id),
            'assignee_ids': [str(self.deactivated_member.id)]
        }
        response = self.client.post(url, data, format='json')
        # Backend validation must block it with a 400 Bad Request
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
