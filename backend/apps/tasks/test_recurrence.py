import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Organization, Membership
from apps.projects.models import Project
from apps.tasks.models import Task, TaskAssignee, SubTask, RecurringTaskSeries
from apps.tasks.recurrence_service import RecurrenceService

User = get_user_model()

class RecurrenceFeatureTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = 'pass1234'

        self.org_a = Organization.objects.create(name='Org A', slug='org-a', timezone='Asia/Kolkata')
        self.org_b = Organization.objects.create(name='Org B', slug='org-b', timezone='America/New_York')

        self.user_a1 = User.objects.create_user(email='a1@test.com', name='User A1', password=self.password, role='ORG_ADMIN')
        self.user_a2 = User.objects.create_user(email='a2@test.com', name='User A2', password=self.password, role='MEMBER')
        self.user_b1 = User.objects.create_user(email='b1@test.com', name='User B1', password=self.password, role='ORG_ADMIN')

        Membership.objects.create(organization=self.org_a, user=self.user_a1, role='ORG_ADMIN', is_active=True)
        Membership.objects.create(organization=self.org_a, user=self.user_a2, role='MEMBER', is_active=True)
        Membership.objects.create(organization=self.org_b, user=self.user_b1, role='ORG_ADMIN', is_active=True)

        self.user_a1.active_organization = self.org_a
        self.user_a1.save()
        self.user_a2.active_organization = self.org_a
        self.user_a2.save()
        self.user_b1.active_organization = self.org_b
        self.user_b1.save()

        self.project_a = Project.objects.create(name='Project A', organization=self.org_a, created_by=self.user_a1)
        self.project_b = Project.objects.create(name='Project B', organization=self.org_b, created_by=self.user_b1)

        self.token_a1 = self.get_jwt(self.user_a1)
        self.token_a2 = self.get_jwt(self.user_a2)
        self.token_b1 = self.get_jwt(self.user_b1)

    def get_jwt(self, user):
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        if user.active_organization_id:
            refresh['org_id'] = str(user.active_organization_id)
        return str(refresh.access_token)

    def set_auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    # --- 1. Basic Recurrence ---
    def test_01_normal_task_defaults_to_non_recurring(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Normal Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertFalse(data['is_recurring'])
        self.assertIsNone(data['recurrence'])

    def test_02_create_daily_recurring_task(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Daily Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'recurrence': {
                'frequency': 'day',
                'interval': 1,
                'end_type': 'never'
            }
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertTrue(data['is_recurring'])
        self.assertEqual(data['recurrence']['frequency'], 'day')
        self.assertEqual(data['recurrence']['interval'], 1)

    def test_03_create_weekly_recurring_task(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Weekly Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'recurrence': {
                'frequency': 'week',
                'interval': 1,
                'weekdays': ['MO'],
                'end_type': 'never'
            }
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data['recurrence']['frequency'], 'week')
        self.assertEqual(data['recurrence']['weekdays'], ['MO'])

    def test_04_create_monthly_recurring_task(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Monthly Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-15',
            'recurrence': {
                'frequency': 'month',
                'interval': 1,
                'month_day': 15,
                'end_type': 'never'
            }
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data['recurrence']['frequency'], 'month')
        self.assertEqual(data['recurrence']['month_day'], 15)

    def test_05_create_yearly_recurring_task(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Yearly Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'recurrence': {
                'frequency': 'year',
                'interval': 1,
                'end_type': 'never'
            }
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data['recurrence']['frequency'], 'year')

    def test_06_create_custom_interval_recurrence(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Custom Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'recurrence': {
                'frequency': 'week',
                'interval': 2,
                'weekdays': ['MO', 'WE'],
                'end_type': 'never'
            }
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data['recurrence']['interval'], 2)
        self.assertIn('MO', data['recurrence']['weekdays'])
        self.assertIn('WE', data['recurrence']['weekdays'])

    def test_07_end_date_stops_recurrence(self):
        series = RecurringTaskSeries.objects.create(
            organization=self.org_a,
            created_by=self.user_a1,
            frequency='DAY',
            interval=1,
            start_date=datetime.date(2026, 9, 14),
            end_type='ON',
            end_date=datetime.date(2026, 9, 15)
        )
        task = Task.objects.create(
            project=self.project_a, organization=self.org_a, name='Day 1',
            due_date=datetime.date(2026, 9, 14), created_by=self.user_a1,
            recurring_series=series, recurrence_instance_date=datetime.date(2026, 9, 14), occurrence_index=1
        )
        TaskAssignee.objects.create(task=task, user=self.user_a1)

        # Complete 14 Sep -> Creates 15 Sep
        next1 = RecurrenceService.materialize_next_occurrence(task)
        self.assertIsNotNone(next1)
        self.assertEqual(next1.due_date, datetime.date(2026, 9, 15))

        # Complete 15 Sep -> Reaches end date 15 Sep -> Returns None
        next2 = RecurrenceService.materialize_next_occurrence(next1)
        self.assertIsNone(next2)
        series.refresh_from_db()
        self.assertFalse(series.is_active)

    def test_08_occurrence_count_stops_recurrence(self):
        series = RecurringTaskSeries.objects.create(
            organization=self.org_a,
            created_by=self.user_a1,
            frequency='DAY',
            interval=1,
            start_date=datetime.date(2026, 9, 14),
            end_type='AFTER',
            occurrence_count=2
        )
        task = Task.objects.create(
            project=self.project_a, organization=self.org_a, name='Occ 1',
            due_date=datetime.date(2026, 9, 14), created_by=self.user_a1,
            recurring_series=series, recurrence_instance_date=datetime.date(2026, 9, 14), occurrence_index=1
        )
        TaskAssignee.objects.create(task=task, user=self.user_a1)

        next1 = RecurrenceService.materialize_next_occurrence(task)
        self.assertIsNotNone(next1)
        self.assertEqual(next1.occurrence_index, 2)

        # Occurrence index 3 > occurrence_count 2 -> Stop
        next2 = RecurrenceService.materialize_next_occurrence(next1)
        self.assertIsNone(next2)

    # --- 2. Completion & Multi-Assignee ---
    def test_09_multi_assignee_partial_completion_does_not_trigger_next_occurrence(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Multi Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'assignee_ids': [str(self.user_a1.id), str(self.user_a2.id)],
            'recurrence': {
                'frequency': 'day',
                'interval': 1,
                'end_type': 'never'
            }
        }, format='json')
        task_id = resp.json()['id']

        # User A1 completes -> Task still pending overall because User A2 has not completed
        self.client.post(f'/api/tasks/{task_id}/complete/')
        task = Task.objects.get(id=task_id)
        self.assertNotEqual(task.status, 'COMPLETED')
        self.assertEqual(Task.objects.filter(recurring_series=task.recurring_series).count(), 1)

    def test_10_multi_assignee_full_completion_triggers_next_occurrence_with_reset_assignees(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Multi Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'assignee_ids': [str(self.user_a1.id), str(self.user_a2.id)],
            'recurrence': {
                'frequency': 'day',
                'interval': 1,
                'end_type': 'never'
            }
        }, format='json')
        task_id = resp.json()['id']

        # User A1 completes
        self.client.post(f'/api/tasks/{task_id}/complete/')

        # User A2 completes as Member
        self.set_auth(self.token_a2)
        self.client.post(f'/api/tasks/{task_id}/complete/')

        task = Task.objects.get(id=task_id)
        self.assertEqual(task.status, 'COMPLETED')

        instances = Task.objects.filter(recurring_series=task.recurring_series).order_by('due_date')
        self.assertEqual(instances.count(), 2)

        next_inst = instances.last()
        self.assertEqual(next_inst.due_date, datetime.date(2026, 9, 15))
        self.assertEqual(next_inst.status, 'PENDING')

        # Verify assignee states are reset to incomplete
        rels = list(next_inst.assignee_relationships.all())
        self.assertEqual(len(rels), 2)
        for r in rels:
            self.assertFalse(r.completed)
            self.assertIsNone(r.completed_at)

    def test_11_idempotent_completion_does_not_create_duplicate_next_occurrence(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Single Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'assignee_ids': [str(self.user_a1.id)],
            'recurrence': {
                'frequency': 'week',
                'interval': 1,
                'end_type': 'never'
            }
        }, format='json')
        task_id = resp.json()['id']

        # Call complete twice
        self.client.post(f'/api/tasks/{task_id}/complete/')
        self.client.post(f'/api/tasks/{task_id}/complete/')

        task = Task.objects.get(id=task_id)
        instances = Task.objects.filter(recurring_series=task.recurring_series)
        self.assertEqual(instances.count(), 2) # Original + Next, no extra duplicates!

    # --- 3. Subtasks Restriction ---
    def test_12_task_with_subtasks_cannot_be_set_to_repeat(self):
        task = Task.objects.create(
            project=self.project_a, organization=self.org_a, name='Task with Subtask',
            due_date=datetime.date(2026, 9, 14), created_by=self.user_a1
        )
        SubTask.objects.create(task=task, name='Sub 1')

        self.set_auth(self.token_a1)
        resp = self.client.patch(f'/api/tasks/{task.id}/', {
            'recurrence': {
                'frequency': 'day',
                'interval': 1
            }
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Tasks with subtasks cannot be repeated', str(resp.json()))

    # --- 4. Editing & Stopping Recurrence ---
    def test_13_stop_recurrence(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'To Stop',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'recurrence': {
                'frequency': 'day',
                'interval': 1
            }
        }, format='json')
        task_id = resp.json()['id']

        # Update recurrence to null / does not repeat
        patch_resp = self.client.patch(f'/api/tasks/{task_id}/', {
            'recurrence': None
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        data = patch_resp.json()
        self.assertFalse(data['is_recurring'])
        self.assertIsNone(data['recurrence'])

    # --- 5. Tenant Isolation ---
    def test_14_tenant_isolation(self):
        self.set_auth(self.token_a1)
        resp = self.client.post('/api/tasks/', {
            'name': 'Org A Task',
            'project': str(self.project_a.id),
            'due_date': '2026-09-14',
            'recurrence': {
                'frequency': 'week',
                'interval': 1
            }
        }, format='json')
        task_id = resp.json()['id']

        # User B1 from Org B cannot read or modify Org A task
        self.set_auth(self.token_b1)
        get_resp = self.client.get(f'/api/tasks/{task_id}/')
        self.assertEqual(get_resp.status_code, status.HTTP_404_NOT_FOUND)

        patch_resp = self.client.patch(f'/api/tasks/{task_id}/', {'name': 'Hacked'}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_404_NOT_FOUND)
