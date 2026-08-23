from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.projects.models import Project
from apps.tasks.models import Task, TaskAssignee, SubTask, TaskAssignmentHistory, SubTaskAssignee
from apps.activity.models import ActivityLog
import datetime
import io
import openpyxl
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class FluxiflowAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_password = 'admin_password123'
        self.member_password = 'member_password123'

        # Create Admin
        self.admin = User.objects.create_superuser(
            email='admin@test.com',
            name='Test Admin',
            password=self.admin_password
        )
        # Create Member 1 (assigned to tasks)
        self.member1 = User.objects.create_user(
            email='member1@test.com',
            name='Test Member 1',
            password=self.member_password,
            role='MEMBER'
        )
        # Create Member 2 (not assigned)
        self.member2 = User.objects.create_user(
            email='member2@test.com',
            name='Test Member 2',
            password=self.member_password,
            role='MEMBER'
        )

        # Obtain JWT tokens
        self.admin_token = self.get_jwt_token(self.admin.email, self.admin_password)
        self.member1_token = self.get_jwt_token(self.member1.email, self.member_password)
        self.member2_token = self.get_jwt_token(self.member2.email, self.member_password)

        # Setup basic project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Project Description',
            created_by=self.admin
        )
        # Setup basic task assigned to Member 1
        self.task = Task.objects.create(
            project=self.project,
            name='Test Task 1',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=self.task, user=self.member1)

    def get_jwt_token(self, email, password=None):
        user = User.objects.get(email=email)
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        return str(refresh.access_token)

    def set_auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def clear_auth(self):
        self.client.credentials()

    # --- 1. Authentication Tests ---
    def test_unauthenticated_requests_are_blocked(self):
        self.clear_auth()
        url = reverse('task-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- 2. Admin Permissions Tests ---
    def test_admin_can_perform_project_crud(self):
        self.set_auth(self.admin_token)
        
        # Create Project
        url = reverse('project-list')
        response = self.client.post(url, {'name': 'New Admin Project', 'description': 'Desc'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_project_id = response.data['id']
        
        # Update Project
        detail_url = reverse('project-detail', args=[new_project_id])
        response = self.client.patch(detail_url, {'name': 'Updated Project Name'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Delete Project
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_can_perform_task_crud(self):
        self.set_auth(self.admin_token)
        
        # Create Task
        url = reverse('task-list')
        response = self.client.post(url, {
            'name': 'New Admin Task',
            'due_date': str(timezone.now().date()),
            'assignee_ids': [str(self.member1.id)],
            'project': str(self.project.id)
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_task_id = response.data['id']
        
        # Update Task
        detail_url = reverse('task-detail', args=[new_task_id])
        response = self.client.patch(detail_url, {'name': 'Updated Task Name', 'assignee_ids': [str(self.member1.id)]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Delete Task
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    # --- 3. Member Read Visibility Tests ---
    def test_member_task_visibility_restricted_to_assigned(self):
        # Create another task not assigned to Member 1 (assigned to admin/self)
        unassigned_task = Task.objects.create(
            name='Unassigned Task',
            due_date=timezone.now().date(),
            created_by=self.admin
        )

        self.set_auth(self.member1_token)
        url = reverse('task-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Member 1 should see Task 1 (assigned) but NOT Unassigned Task
        task_ids = [t['id'] for t in response.data]
        self.assertIn(str(self.task.id), task_ids)
        self.assertNotIn(str(unassigned_task.id), task_ids)

    # --- 4. Critical Authorization Tests: Member Blocks ---
    def test_member_cannot_create_task(self):
        self.set_auth(self.member1_token)
        url = reverse('task-list')
        payload = {
            'name': 'Member Attempt Task',
            'due_date': str(timezone.now().date()),
            'assignee_ids': [str(self.member1.id)]
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_modify_task_metadata(self):
        self.set_auth(self.member1_token)
        url = reverse('task-detail', args=[self.task.id])
        response = self.client.patch(url, {'name': 'Hacked Task Name'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_delete_task(self):
        self.set_auth(self.member1_token)
        url = reverse('task-detail', args=[self.task.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_create_project(self):
        self.set_auth(self.member1_token)
        url = reverse('project-list')
        response = self.client.post(url, {'name': 'Member Attempt Project'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_modify_project(self):
        self.set_auth(self.member1_token)
        url = reverse('project-detail', args=[self.project.id])
        response = self.client.patch(url, {'name': 'Hacked Project Name'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_delete_project(self):
        self.set_auth(self.member1_token)
        url = reverse('project-detail', args=[self.project.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_access_workload_or_activity_logs(self):
        self.set_auth(self.member1_token)
        
        # Activity logs
        url_act = reverse('activity_list')
        response = self.client.get(url_act)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Workload details
        url_wl = reverse('team_workload', args=[self.member1.id])
        response = self.client.get(url_wl)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- 5. Member Task Completion Permissions Tests ---
    def test_assigned_member_can_complete_task(self):
        self.set_auth(self.member1_token)
        url = reverse('task-complete', args=[self.task.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify status database change
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'COMPLETED')
        self.assertEqual(self.task.completed_by, self.member1)
        self.assertIsNotNone(self.task.completed_at)

        # Check ActivityLog was automatically created
        log_exists = ActivityLog.objects.filter(
            user=self.member1,
            action='TASK_COMPLETED',
            entity_id=self.task.id
        ).exists()
        self.assertTrue(log_exists)

    def test_unassigned_member_cannot_complete_task(self):
        self.set_auth(self.member2_token)
        url = reverse('task-complete', args=[self.task.id])
        response = self.client.post(url)
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_admin_restricted_general_tasks(self):
        url = reverse('task-list')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertNotIn(str(self.task.id), task_ids)

        project_url = f"{url}?project={self.project.id}"
        response = self.client.get(project_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_task_ids = [t['id'] for t in response.data]
        self.assertIn(str(self.task.id), project_task_ids)

    def test_member_project_tasks_visibility_and_restrictions(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.member2_token}')
        url = f"{reverse('task-list')}?project={self.project.id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertIn(str(self.task.id), task_ids)

        complete_url = reverse('task-complete', args=[self.task.id])
        response = self.client.post(complete_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_task_relative_dates(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.member1_token}')
        url = reverse('task-detail', args=[self.task.id])
        
        self.task.due_date = timezone.now().date() + datetime.timedelta(days=1)
        self.task.due_time = datetime.time(10, 0, 0)
        self.task.save()
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['date_color'], 'green')
        self.assertIn('Tomorrow · 10:00 AM', response.data['date_display'])

    def test_admin_can_create_unassigned_task(self):
        url = reverse('task-list')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        
        response = self.client.post(url, {
            'name': 'Unassigned Sitemap Task',
            'due_date': str(timezone.now().date()),
            'assignee_ids': [],
            'project': str(self.project.id),
            'priority': 'MEDIUM'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['assignees']), 0)
        self.assertEqual(str(response.data['project']), str(self.project.id))

    def test_unassigned_task_does_not_affect_member_health(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        
        overdue_date = timezone.now().date() - datetime.timedelta(days=5)
        task = Task.objects.create(
            project=self.project,
            name='Overdue Unassigned Task',
            due_date=overdue_date,
            created_by=self.admin
        )
        
        from apps.accounts.views import calculate_user_health_metrics
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_status'], 'excellent')

    def test_admin_assigns_unassigned_task_later(self):
        task = Task.objects.create(
            project=self.project,
            name='Later Assigned Task',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        self.assertEqual(task.assignee_relationships.count(), 0)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        url = reverse('task-detail', args=[task.id])
        response = self.client.patch(url, {
            'assignee_ids': [str(self.member1.id)]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        task.refresh_from_db()
        self.assertEqual(task.assignee_relationships.count(), 1)
        self.assertEqual(task.assignee_relationships.first().user, self.member1)

    def test_admin_removes_all_assignees_from_assigned_task(self):
        self.assertEqual(self.task.assignee_relationships.count(), 1)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        url = reverse('task-detail', args=[self.task.id])
        response = self.client.patch(url, {
            'assignee_ids': []
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.assignee_relationships.count(), 0)

    def test_project_visibility_and_task_access_regression(self):
        project_a = Project.objects.create(name='Project A', created_by=self.admin)
        project_b = Project.objects.create(name='Project B', created_by=self.admin)
        
        task_a = Task.objects.create(project=project_a, name='Task A', due_date=timezone.now().date(), created_by=self.admin)
        TaskAssignee.objects.create(task=task_a, user=self.member1)
        
        task_b = Task.objects.create(project=project_a, name='Task B', due_date=timezone.now().date(), created_by=self.admin)
        TaskAssignee.objects.create(task=task_b, user=self.member2)
        
        task_c = Task.objects.create(project=project_a, name='Task C', due_date=timezone.now().date(), created_by=self.admin)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.member1_token}')
        tasks_url = reverse('task-list')
        response = self.client.get(tasks_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        personal_task_ids = [t['id'] for t in response.data]
        self.assertIn(str(task_a.id), personal_task_ids)
        
        projects_url = reverse('project-list')
        response = self.client.get(projects_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_ids = [p['id'] for p in response.data]
        self.assertIn(str(project_a.id), project_ids)
        self.assertIn(str(project_b.id), project_ids)
        
        project_tasks_url = f"{tasks_url}?project={project_a.id}"
        response = self.client.get(project_tasks_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_task_ids = [t['id'] for t in response.data]
        self.assertIn(str(task_a.id), project_task_ids)
        self.assertIn(str(task_b.id), project_task_ids)
        self.assertIn(str(task_c.id), project_task_ids)
        
        complete_a_url = reverse('task-complete', args=[task_a.id])
        response = self.client.post(complete_a_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        complete_b_url = reverse('task-complete', args=[task_b.id])
        response = self.client.post(complete_b_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        complete_c_url = reverse('task-complete', args=[task_c.id])
        response = self.client.post(complete_c_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_task_completion_blocked_by_incomplete_subtasks(self):
        self.set_auth(self.admin_token)
        
        # Create an incomplete subtask
        subtask = SubTask.objects.create(
            task=self.task,
            name='Test Incomplete Subtask',
            status='PENDING'
        )
        
        url = reverse('task-complete', args=[self.task.id])
        response = self.client.post(url)
        
        # Ticking task should be blocked
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], "All subtasks must be completed before the task can be completed.")
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'PENDING')
        
        # Mark subtask completed
        subtask.status = 'COMPLETED'
        subtask.save()
        
        # Now ticking the task should succeed
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'COMPLETED')


from apps.accounts.views import calculate_user_health_metrics, get_task_due_datetime

class FluxiflowHealthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@healthtest.com',
            name='Health Admin',
            password='password123'
        )
        self.member1 = User.objects.create_user(
            email='member1@healthtest.com',
            name='Health Member 1',
            password='password123',
            role='MEMBER'
        )
        self.member2 = User.objects.create_user(
            email='member2@healthtest.com',
            name='Health Member 2',
            password='password123',
            role='MEMBER'
        )
        
        self.project = Project.objects.create(
            name='Health Project',
            created_by=self.admin
        )
        
    def test_new_member_health_defaults_to_100(self):
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 100)
        self.assertEqual(metrics['health_status'], 'excellent')
        
    def test_upcoming_tasks_no_penalty(self):
        task = Task.objects.create(
            project=self.project,
            name='Upcoming Task',
            due_date=timezone.now().date() + datetime.timedelta(days=5),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)
        
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 100)
        
    def test_today_pending_task_small_penalty(self):
        task = Task.objects.create(
            project=self.project,
            name='Today Task',
            due_date=timezone.now().date(),
            due_time=datetime.time(23, 59, 59),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)
        
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 99)
        
    def test_overdue_task_large_penalty(self):
        task = Task.objects.create(
            project=self.project,
            name='Overdue Task',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)
        
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 97)
        
    def test_on_time_completions_trend_to_100(self):
        task = Task.objects.create(
            project=self.project,
            name='On Time Task',
            due_date=timezone.now().date(),
            status='COMPLETED',
            completed_at=timezone.now(),
            created_by=self.admin
        )
        assignee = TaskAssignee.objects.create(task=task, user=self.member1, completed=True, completed_at=timezone.now())
        
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 100)
        
    def test_late_completions_reduce_health(self):
        task = Task.objects.create(
            project=self.project,
            name='Late Task',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            status='COMPLETED',
            completed_at=timezone.now(),
            created_by=self.admin
        )
        assignee = TaskAssignee.objects.create(task=task, user=self.member1, completed=True, completed_at=timezone.now())
        
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 29)
        self.assertEqual(metrics['health_status'], 'critical')
        
    def test_health_score_capped_at_100_and_0(self):
        for i in range(20):
            t = Task.objects.create(
                project=self.project,
                name=f'Overdue Task {i}',
                due_date=timezone.now().date() - datetime.timedelta(days=1),
                created_by=self.admin
            )
            TaskAssignee.objects.create(task=t, user=self.member1)
            
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 0)
        
    def test_multi_assignee_independent_evaluation(self):
        # Member 1 has an on-time completed task
        task1 = Task.objects.create(
            project=self.project,
            name='Task 1',
            status='COMPLETED',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            due_time=datetime.time(12, 0, 0),
            completed_at=get_task_due_datetime(timezone.now().date() - datetime.timedelta(days=1), datetime.time(12, 0, 0)) - datetime.timedelta(hours=2),
            created_by=self.admin
        )
        TaskAssignee.objects.create(
            task=task1,
            user=self.member1,
            completed=True,
            completed_at=task1.completed_at
        )

        # Member 2 has a late completed task
        task2 = Task.objects.create(
            project=self.project,
            name='Task 2',
            status='COMPLETED',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            due_time=datetime.time(12, 0, 0),
            completed_at=get_task_due_datetime(timezone.now().date() - datetime.timedelta(days=1), datetime.time(12, 0, 0)) + datetime.timedelta(hours=2),
            created_by=self.admin
        )
        TaskAssignee.objects.create(
            task=task2,
            user=self.member2,
            completed=True,
            completed_at=task2.completed_at
        )
        
        metrics1 = calculate_user_health_metrics(self.member1)
        metrics2 = calculate_user_health_metrics(self.member2)
        
        self.assertEqual(metrics1['health_score'], 100)
        self.assertEqual(metrics2['health_score'], 29)
        
    def test_admin_vs_member_health_access(self):
        admin_token = self.get_jwt_token('admin@healthtest.com', 'password123')
        member_token = self.get_jwt_token('member1@healthtest.com', 'password123')
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        response = self.client.get(reverse('team_list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {member_token}')
        response = self.client.get(reverse('team_list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_late_submission_reopen_history_preservation(self):
        from apps.tasks.helpers import get_task_due_datetime
        task = Task.objects.create(
            project=self.project,
            name='History Preservation Task',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            created_by=self.admin
        )
        assignee = TaskAssignee.objects.create(task=task, user=self.member1)
        
        # Verify history is created
        self.assertTrue(TaskAssignmentHistory.objects.filter(task=task, user=self.member1, unassigned_at__isnull=True).exists())
        
        # Complete task
        token = self.get_jwt_token(self.member1.email, 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.post(reverse('task-complete', args=[task.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify assignee is completed and history is closed
        assignee.refresh_from_db()
        self.assertTrue(assignee.completed)
        self.assertIsNotNone(assignee.completed_at)
        
        closed_histories = TaskAssignmentHistory.objects.filter(task=task, user=self.member1, unassigned_at__isnull=False)
        self.assertEqual(closed_histories.count(), 1)
        hist = closed_histories.first()
        self.assertTrue(hist.completed)
        self.assertEqual(hist.completed_at, assignee.completed_at)
        
        # Reopen task
        response = self.client.post(reverse('task-reopen', args=[task.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify new active history is created, old closed history remains intact
        assignee.refresh_from_db()
        self.assertFalse(assignee.completed)
        self.assertIsNone(assignee.completed_at)
        
        self.assertEqual(TaskAssignmentHistory.objects.filter(task=task, user=self.member1, unassigned_at__isnull=False).count(), 1)
        self.assertEqual(TaskAssignmentHistory.objects.filter(task=task, user=self.member1, unassigned_at__isnull=True).count(), 1)

    def get_jwt_token(self, email, password=None):
        user = User.objects.get(email=email)
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        return str(refresh.access_token)


class BulkTaskImportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin_import@test.com',
            name='Import Admin',
            password='password123'
        )
        self.member = User.objects.create_user(
            email='member_import@test.com',
            name='Import Member',
            password='password123',
            role='MEMBER'
        )
        self.inactive_member = User.objects.create_user(
            email='deactivated_import@test.com',
            name='Deactivated Member',
            password='password123',
            role='MEMBER',
            is_active=False
        )
        self.project = Project.objects.create(
            name='Import Test Project',
            description='Project to test bulk import',
            created_by=self.admin
        )
        
        self.admin_token = self.get_jwt_token(self.admin.email)
        self.member_token = self.get_jwt_token(self.member.email)

    def get_jwt_token(self, email):
        user = User.objects.get(email=email)
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        return str(refresh.access_token)

    def set_auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def create_mock_excel(self, rows_data):
        from django.core.files.uploadedfile import SimpleUploadedFile
        wb = openpyxl.Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = "Tasks"
        
        headers = ["Title", "Description", "Priority", "Status", "Due Date", "Due Time", "Assignee Emails"]
        ws.append(headers)
        
        for row in rows_data:
            ws.append(row)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return SimpleUploadedFile("template.xlsx", output.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    def test_non_admin_rejection(self):
        self.set_auth(self.member_token)
        
        # 1. Rejects Template Download
        url = reverse('project-bulk-template', args=[self.project.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 2. Rejects Validate
        url = reverse('project-bulk-import-validate', args=[self.project.id])
        excel_file = self.create_mock_excel([["Task 1", "Desc", "High", "Pending", "2026-08-12", "12:00", ""]])
        response = self.client.post(url, {'file': excel_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 3. Rejects Confirm
        url = reverse('project-bulk-import-confirm', args=[self.project.id])
        response = self.client.post(url, {'tasks': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_template_download(self):
        self.set_auth(self.admin_token)
        url = reverse('project-bulk-template', args=[self.project.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    def test_validation_errors(self):
        self.set_auth(self.admin_token)
        url = reverse('project-bulk-import-validate', args=[self.project.id])
        
        # Scenario A: Missing Title & Invalid Priority / Status
        excel_file = self.create_mock_excel([
            ["", "Desc", "Critical", "In-Progress", "2026-08-12", "12:00", ""]
        ])
        response = self.client.post(url, {'file': excel_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['success'])
        errors = response.data['errors']
        fields = [e['field'] for e in errors]
        self.assertIn("Title", fields)
        self.assertNotIn("Priority", fields)
        self.assertNotIn("Status", fields)
        
        # Verify warnings are present for priority and status
        warnings = response.data['warnings']
        warn_fields = [w['field'] for w in warnings]
        self.assertIn("Priority", warn_fields)
        self.assertIn("Status", warn_fields)
        
        # Scenario B: Duplicate rows within file (blocking error now)
        excel_file = self.create_mock_excel([
            ["Task 1", "Desc", "High", "Pending", "2026-08-12", "12:00", ""],
            ["Task 1", "Desc", "High", "Pending", "2026-08-12", "12:00", ""]
        ])
        response = self.client.post(url, {'file': excel_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['success'])
        errors = response.data['errors']
        messages = [e['message'] for e in errors]
        self.assertTrue(any("already exists" in m for m in messages))

        # Scenario C: Invalid Assignee Email / Inactive Assignee
        excel_file = self.create_mock_excel([
            ["Task 1", "Desc", "High", "Pending", "2026-08-12", "12:00", "nonexistent@test.com"],
            ["Task 2", "Desc", "Medium", "Pending", "2026-08-12", "12:00", "deactivated_import@test.com"]
        ])
        response = self.client.post(url, {'file': excel_file}, format='multipart')
        self.assertFalse(response.data['success'])
        errors = response.data['errors']
        messages = [e['message'] for e in errors]
        self.assertTrue(any("could not be found" in m for m in messages))

    def test_import_confirm_rollback_and_success(self):
        self.set_auth(self.admin_token)
        url_confirm = reverse('project-bulk-import-confirm', args=[self.project.id])
        
        # 1. Test Rollback on payload validation error (e.g. invalid date format)
        bad_payload = {
            "tasks": [
                {
                    "row_number": 2,
                    "title": "Rollback Parent",
                    "description": "Desc",
                    "priority": "HIGH",
                    "status": "PENDING",
                    "due_date": "invalid-date",
                    "due_time": "12:00",
                    "assignee_emails_str": ""
                }
            ]
        }
        response = self.client.post(url_confirm, bad_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Task.objects.filter(name="Rollback Parent").exists())

        # 2. Test Success Import (2 Tasks, Assignee and Completed states)
        success_payload = {
            "tasks": [
                {
                    "row_number": 2,
                    "title": "Website Redesign",
                    "description": "Corporate site redesign",
                    "priority": "HIGH",
                    "status": "PENDING",
                    "due_date": "2026-08-15",
                    "due_time": "18:00",
                    "assignee_emails_str": "member_import@test.com"
                },
                {
                    "row_number": 3,
                    "title": "Homepage Design",
                    "description": "Wireframe first",
                    "priority": "MEDIUM",
                    "status": "COMPLETED",
                    "due_date": "2026-08-16",
                    "due_time": "12:00",
                    "assignee_emails_str": ""
                }
            ]
        }
        
        response = self.client.post(url_confirm, success_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tasks_created'], 2)
        
        # Verify database structures
        task1 = Task.objects.get(name="Website Redesign", project=self.project)
        self.assertEqual(task1.priority, "HIGH")
        self.assertEqual(task1.status, "PENDING")
        self.assertEqual(str(task1.due_date), "2026-08-15")
        
        # Check assignee creation
        self.assertTrue(TaskAssignee.objects.filter(task=task1, user=self.member).exists())
        
        # Check assignment history
        self.assertTrue(TaskAssignmentHistory.objects.filter(task=task1, user=self.member, unassigned_at__isnull=True).exists())
        
        # Check ActivityLog entry
        self.assertTrue(ActivityLog.objects.filter(
            user=self.admin,
            action='TASK_IMPORTED',
            entity_type='Project',
            entity_id=self.project.id
        ).exists())


class SubTaskIndependentWorkItemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin_sub@test.com',
            name='Sub Admin',
            password='password123'
        )
        self.member1 = User.objects.create_user(
            email='member1_sub@test.com',
            name='Member 1',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        self.member2 = User.objects.create_user(
            email='member2_sub@test.com',
            name='Member 2',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        self.project = Project.objects.create(
            name='Sub Project',
            created_by=self.admin
        )
        self.task = Task.objects.create(
            project=self.project,
            name='Parent Task',
            due_date=timezone.now().date() + datetime.timedelta(days=10),
            created_by=self.admin
        )
        self.admin_token = self.get_jwt_token(self.admin.email)
        self.member1_token = self.get_jwt_token(self.member1.email)
        self.member2_token = self.get_jwt_token(self.member2.email)

    def get_jwt_token(self, email):
        user = User.objects.get(email=email)
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        return str(refresh.access_token)

    def set_auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_subtask_crud_and_assignees(self):
        # 1. Admin creates subtask with due date/time and assignees
        self.set_auth(self.admin_token)
        url = reverse('subtask-list')
        data = {
            'task': str(self.task.id),
            'name': 'Homepage subtask',
            'due_date': str(timezone.now().date() + datetime.timedelta(days=2)),
            'due_time': '15:00',
            'assignee_ids': [str(self.member1.id), str(self.member2.id)]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        subtask_id = response.data['id']
        
        # Verify subtask database fields
        subtask = SubTask.objects.get(id=subtask_id)
        self.assertEqual(subtask.name, 'Homepage subtask')
        self.assertEqual(str(subtask.due_date), data['due_date'])
        self.assertEqual(subtask.due_time.strftime('%H:%M'), '15:00')
        self.assertEqual(subtask.status, 'PENDING')
        
        # Check subtask assignees
        self.assertEqual(SubTaskAssignee.objects.filter(subtask=subtask).count(), 2)
        
        # Check history constraint integrity (exactly one of task or subtask is set)
        histories = TaskAssignmentHistory.objects.filter(subtask=subtask)
        self.assertEqual(histories.count(), 2)
        for h in histories:
            self.assertIsNone(h.task)
            self.assertIsNotNone(h.subtask)
            self.assertEqual(h.unassigned_at, None)

        # 2. Member cannot edit/delete subtasks
        self.set_auth(self.member1_token)
        detail_url = reverse('subtask-detail', args=[subtask_id])
        edit_response = self.client.put(detail_url, {'name': 'hacked'}, format='json')
        self.assertEqual(edit_response.status_code, status.HTTP_403_FORBIDDEN)
        
        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_independent_completion_and_reopen(self):
        # Admin creates subtask with two assignees
        subtask = SubTask.objects.create(
            task=self.task,
            name='Homepage Design',
            due_date=timezone.now().date() - datetime.timedelta(days=1), # Yesterday (overdue)
            due_time=datetime.time(12, 0)
        )
        sa1 = SubTaskAssignee.objects.create(subtask=subtask, user=self.member1)
        sa2 = SubTaskAssignee.objects.create(subtask=subtask, user=self.member2)
        
        # 1. Member 1 completes their assignment
        self.set_auth(self.member1_token)
        complete_url = reverse('subtask-complete', args=[subtask.id])
        response = self.client.post(complete_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify Member 1 assignee completed, but Subtask itself remains PENDING
        sa1.refresh_from_db()
        sa2.refresh_from_db()
        subtask.refresh_from_db()
        self.assertTrue(sa1.completed)
        self.assertFalse(sa2.completed)
        self.assertEqual(subtask.status, 'PENDING')
        
        # Check that assignment history for Member 1 has unassigned_at = completed_at
        h1 = TaskAssignmentHistory.objects.get(subtask=subtask, user=self.member1, completed=True)
        self.assertEqual(h1.unassigned_at, sa1.completed_at)
        
        # 2. Member 1 tries to complete again or complete for Member 2 -> 403
        response = self.client.post(complete_url, {'user_id': str(self.member2.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Member 2 completes their assignment late
        self.set_auth(self.member2_token)
        response = self.client.post(complete_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify subtask is now COMPLETED
        sa2.refresh_from_db()
        subtask.refresh_from_db()
        self.assertTrue(sa2.completed)
        self.assertEqual(subtask.status, 'COMPLETED')
        self.assertEqual(subtask.completed_by, self.member2)
        self.assertIsNotNone(subtask.completed_at)
        
        # 4. Member 1 reopens their assignment
        self.set_auth(self.member1_token)
        reopen_url = reverse('subtask-reopen', args=[subtask.id])
        response = self.client.post(reopen_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify subtask goes back to PENDING and Member 1 assignee is incomplete
        sa1.refresh_from_db()
        subtask.refresh_from_db()
        self.assertFalse(sa1.completed)
        self.assertEqual(subtask.status, 'PENDING')
        self.assertIsNone(subtask.completed_at)
        
        # Verify new active assignment history record created for Member 1
        self.assertTrue(TaskAssignmentHistory.objects.filter(subtask=subtask, user=self.member1, unassigned_at__isnull=True).exists())

    def test_health_metrics_and_workload(self):
        # Make parent task overdue
        self.task.due_date = timezone.now().date() - datetime.timedelta(days=5)
        self.task.save()

        # Member 1 is assigned to parent task AND subtask
        TaskAssignee.objects.create(task=self.task, user=self.member1)
        subtask = SubTask.objects.create(
            task=self.task,
            name='Sarah subtask',
            due_date=timezone.now().date() - datetime.timedelta(days=2),
            due_time=datetime.time(12, 0)
        )
        SubTaskAssignee.objects.create(subtask=subtask, user=self.member1)
        
        # Both are overdue! Check health metrics for Member 1
        from apps.accounts.views import calculate_user_health_metrics
        metrics = calculate_user_health_metrics(self.member1)
        
        self.assertEqual(metrics['pending_tasks'], 2)
        self.assertEqual(metrics['overdue_tasks'], 2)
        self.assertEqual(metrics['health_score'], 94)

    def test_reports_compilation_and_export(self):
        # Admin creates subtask assignment
        subtask = SubTask.objects.create(
            task=self.task,
            name='Report subtask',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            due_time=datetime.time(12, 0)
        )
        SubTaskAssignee.objects.create(subtask=subtask, user=self.member1)
        
        # Member 1 completes it
        self.set_auth(self.member1_token)
        complete_url = reverse('subtask-complete', args=[subtask.id])
        self.client.post(complete_url, format='json')
        
        # Compile report data
        from apps.reports.services import ReportGenerator
        today = str(timezone.now().date())
        data = ReportGenerator.compile_report_data(today, today, member_id=str(self.member1.id))
        tasks = data['tasks']
        subtask_log = next((t for t in tasks if t['subtask_name'] == 'Report subtask'), None)
        self.assertIsNotNone(subtask_log)
        self.assertEqual(subtask_log['task_name'], 'Parent Task')
        self.assertEqual(subtask_log['on_time'], 'Late')
        
        # Verify Excel, CSV, PDF exports run successfully
        csv_data = ReportGenerator.export_csv(today, today)
        self.assertIn(b"Subtask", csv_data)
        self.assertIn(b"Report subtask", csv_data)
        
        pdf_file = ReportGenerator.export_pdf(today, today)
        self.assertIsNotNone(pdf_file.read())

    def test_project_cascade_deletion_regression(self):
        """Regression test for project deletion cascade with tasks, subtasks, and assignees."""
        # Create Project A
        project_a = Project.objects.create(
            name='Project A',
            description='Test A',
            created_by=self.admin
        )
        # Create Task A1 and A2
        task_a1 = Task.objects.create(
            project=project_a,
            name='Task A1',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        task_a2 = Task.objects.create(
            project=project_a,
            name='Task A2',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        # Assign members
        TaskAssignee.objects.create(task=task_a1, user=self.member1)
        TaskAssignee.objects.create(task=task_a1, user=self.member2)
        TaskAssignee.objects.create(task=task_a2, user=self.member1)

        # Create subtask under task A1
        subtask = SubTask.objects.create(
            task=task_a1,
            name='Subtask A1.1',
            due_date=timezone.now().date()
        )
        SubTaskAssignee.objects.create(subtask=subtask, user=self.member1)

        # Project B (which must remain unaffected)
        project_b = Project.objects.create(
            name='Project B',
            description='Test B',
            created_by=self.admin
        )
        task_b1 = Task.objects.create(
            project=project_b,
            name='Task B1',
            due_date=timezone.now().date(),
            created_by=self.admin
        )

        # Delete Project A
        try:
            project_a.delete()
        except Exception as e:
            self.fail(f"Project deletion raised an unexpected exception: {e}")

        # Assert Project A and its related records are deleted
        self.assertFalse(Project.objects.filter(id=project_a.id).exists())
        self.assertFalse(Task.objects.filter(id=task_a1.id).exists())
        self.assertFalse(Task.objects.filter(id=task_a2.id).exists())
        self.assertFalse(SubTask.objects.filter(id=subtask.id).exists())
        self.assertFalse(TaskAssignee.objects.filter(task_id=task_a1.id).exists())
        self.assertFalse(SubTaskAssignee.objects.filter(subtask_id=subtask.id).exists())

        # Assert Project B and Task B1 remain
        self.assertTrue(Project.objects.filter(id=project_b.id).exists())
        self.assertTrue(Task.objects.filter(id=task_b1.id).exists())

        # Assert Member tasks API still loads and executes successfully
        self.set_auth(self.member1_token)
        url = reverse('task-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_member_tasks_api_scenarios(self):
        """Verify list scenarios for member tasks and subtasks list combinations."""
        # Clean existing test data assignments for self.member1
        TaskAssignee.objects.filter(user=self.member1).delete()
        SubTaskAssignee.objects.filter(user=self.member1).delete()
        
        url = reverse('task-list')
        self.set_auth(self.member1_token)
        
        def get_results(res_data):
            return res_data.get('results', res_data) if isinstance(res_data, dict) else res_data

        # Scenario 1: No assignments
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = get_results(response.data)
        for item in results:
            if item.get('is_subtask'):
                assignees = [a['id'] for a in item['assignees']]
                self.assertNotIn(str(self.member1.id), assignees)

        # Scenario 2: Normal tasks only assigned to self.member1
        task_normal = Task.objects.create(
            project=self.project,
            name='Normal Task For Member1',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task_normal, user=self.member1)
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = get_results(response.data)
        normal_item = next((t for t in results if t['id'] == str(task_normal.id)), None)
        self.assertIsNotNone(normal_item)
        self.assertFalse(normal_item.get('is_subtask', False))
        
        # Scenario 3: Assigned subtasks only
        TaskAssignee.objects.filter(task=task_normal, user=self.member1).delete() # remove task assignment
        
        subtask_assigned = SubTask.objects.create(
            task=task_normal,
            name='SubTask For Member1',
            due_date=timezone.now().date()
        )
        SubTaskAssignee.objects.create(subtask=subtask_assigned, user=self.member1)
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = get_results(response.data)
        sub_item = next((t for t in results if t['id'] == f"subtask_{subtask_assigned.id}"), None)
        self.assertIsNotNone(sub_item)
        self.assertTrue(sub_item.get('is_subtask'))
        self.assertEqual(sub_item.get('parent_task_id'), str(task_normal.id))
        self.assertEqual(sub_item.get('parent_task_name'), task_normal.name)
        
        # Scenario 4: Both tasks and subtasks
        TaskAssignee.objects.create(task=task_normal, user=self.member1) # re-assign normal task
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = get_results(response.data)
        
        normal_item = next((t for t in results if t['id'] == str(task_normal.id)), None)
        sub_item = next((t for t in results if t['id'] == f"subtask_{subtask_assigned.id}"), None)
        self.assertIsNotNone(normal_item)
        self.assertIsNotNone(sub_item)
        
        # Scenario 5: Subtask assigned to a different member must not appear
        # Assign subtask to member2, unassign from member1
        SubTaskAssignee.objects.filter(subtask=subtask_assigned, user=self.member1).delete()
        SubTaskAssignee.objects.create(subtask=subtask_assigned, user=self.member2)
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = get_results(response.data)
        sub_item = next((t for t in results if t['id'] == f"subtask_{subtask_assigned.id}"), None)
        self.assertIsNone(sub_item)

    def test_bulk_import_normalization_and_warnings(self):
        """Verify priority/status normalization and warnings work as expected."""
        from apps.tasks.bulk_import import validate_bulk_import_data
        
        tasks_list = [
            {
                "row_number": 2,
                "title": "Task 1",
                "priority": "Low",
                "status": "Pending",
                "due_date": "2026-08-20",
                "due_time": "12:00"
            },
            {
                "row_number": 3,
                "title": "Task 2",
                "priority": "Urgent",  # Invalid priority
                "status": "InvalidStatus",  # Invalid status
                "due_date": "2026-08-21",
                "due_time": ""
            },
            {
                "row_number": 4,
                "title": "Task 3",
                "priority": "",  # Empty priority
                "status": "",  # Empty status
                "due_date": "2026-08-22",
                "due_time": ""
            }
        ]
        
        result = validate_bulk_import_data(tasks_list, self.project)
        self.assertEqual(len(result["errors"]), 0)
        self.assertEqual(len(result["warnings"]), 4)  # 2 for row 3 (priority & status), 2 for row 4 (priority & status)
        
        # Verify normalized values in list
        self.assertEqual(tasks_list[0]["priority"], "LOW")
        self.assertEqual(tasks_list[0]["status"], "PENDING")
        
        self.assertEqual(tasks_list[1]["priority"], "LOW")
        self.assertEqual(tasks_list[1]["status"], "PENDING")
        self.assertEqual(result["warnings"][0]["message"], 'Row 3: "Urgent" is not a supported priority. Low priority will be used.')
        self.assertEqual(result["warnings"][1]["message"], 'Row 3: "InvalidStatus" is not a supported status. Pending status will be used instead.')
        
        self.assertEqual(tasks_list[2]["priority"], "LOW")
        self.assertEqual(tasks_list[2]["status"], "PENDING")

    def test_bulk_import_blocking_errors(self):
        """Verify that validation flags errors for missing title, invalid date, and duplicate tasks."""
        from apps.tasks.bulk_import import validate_bulk_import_data
        
        # Create an existing task to trigger duplicate check
        Task.objects.create(
            project=self.project,
            name="Existing Task",
            due_date="2026-08-20",
            created_by=self.admin
        )
        
        tasks_list = [
            {
                "row_number": 2,
                "title": "",  # Missing title
                "priority": "Low",
                "status": "Pending",
                "due_date": "2026-08-20",
                "due_time": "12:00"
            },
            {
                "row_number": 3,
                "title": "Task 2",
                "priority": "Low",
                "status": "Pending",
                "due_date": "invalid-date",  # Invalid date format
                "due_time": ""
            },
            {
                "row_number": 4,
                "title": "Existing Task",  # Duplicate task name & due date
                "priority": "Low",
                "status": "Pending",
                "due_date": "2026-08-20",
                "due_time": ""
            }
        ]
        
        result = validate_bulk_import_data(tasks_list, self.project)
        self.assertEqual(len(result["errors"]), 3)
        self.assertEqual(result["errors"][0]["message"], "Row 2: Task name is missing.")
        self.assertEqual(result["errors"][1]["message"], "Row 3: Due date is invalid. Please select a valid date.")
        self.assertEqual(result["errors"][2]["message"], "Row 4: A task with this name and due date already exists in this project.")

    def test_bulk_import_confirm_rollback_on_failure(self):
        """Verify confirm API rolls back all creations if any row validation fails."""
        # Use bulk_import_confirm API endpoint
        url = reverse('project-detail', args=[self.project.id]) + 'tasks/bulk-import/confirm/'
        # Generate token dynamically
        refresh = RefreshToken.for_user(self.admin)
        refresh['email'] = self.admin.email
        refresh['name'] = self.admin.name
        refresh['role'] = self.admin.role
        token = str(refresh.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        # Valid row and invalid row
        tasks_data = [
            {
                "row_number": 2,
                "title": "Should Not Be Created",
                "priority": "Low",
                "status": "Pending",
                "due_date": "2026-08-20",
                "due_time": "12:00"
            },
            {
                "row_number": 3,
                "title": "A" * 300,  # exceeds 255 max_length, throws ValidationError in serializer
                "priority": "Low",
                "status": "Pending",
                "due_date": "2026-08-20",
                "due_time": ""
            }
        ]
        
        response = self.client.post(url, {"tasks": tasks_data}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["message"], "Some tasks could not be imported.")
        
        # Ensure row 2 task was NOT created (rolled back)
        self.assertFalse(Task.objects.filter(name="Should Not Be Created").exists())


class FluxiflowTaskConsistencyTests(FluxiflowAPITests):
    def setUp(self):
        super().setUp()
        from apps.accounts.models import Organization, Membership
        self.org = Organization.objects.create(name='Test Org')
        self.project.organization = self.org
        self.project.save(update_fields=['organization'])
        
        Membership.objects.create(organization=self.org, user=self.admin)
        Membership.objects.create(organization=self.org, user=self.member1)
        Membership.objects.create(organization=self.org, user=self.member2)

    def test_completion_consistency_and_refreshed_db(self):
        """Verify task status remains absolute source of truth."""
        self.set_auth(self.admin_token)
        url = reverse('task-complete', args=[self.task.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'COMPLETED')
        self.assertEqual(self.task.completed_by, self.admin)
        
    def test_subtask_reopen_parent_signal(self):
        """Verify signals propagate status changes to parent tasks."""
        parent = Task.objects.create(
            project=self.project,
            name='Parent Task',
            status='COMPLETED',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        subtask = SubTask.objects.create(
            task=parent,
            name='Subtask',
            status='COMPLETED'
        )
        
        # When subtask is reopened, parent should reopen
        subtask.status = 'PENDING'
        subtask.save()
        
        parent.refresh_from_db()
        self.assertEqual(parent.status, 'PENDING')
        
    def test_bulk_copy_paste_atomic_transaction(self):
        """Verify transaction rollback during bulk copy/paste failures."""
        self.set_auth(self.admin_token)
        
        # Post to bulk_paste with empty/invalid payload to trigger error and ensure atomic rollback
        url = reverse('task-list') + 'bulk_paste/'
        payload = {
            "destination_project_id": self.project.id,
            "destination_assignee_id": self.member1.id,
            "tasks": [
                {
                    "name": "" # Invalid empty name, raises validation error
                }
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Ensure only the original task exists because of atomic transaction rollback
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)




