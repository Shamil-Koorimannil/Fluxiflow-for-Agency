from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.projects.models import Project
from apps.tasks.models import Task, TaskAssignee, SubTask, TaskAssignmentHistory
from apps.activity.models import ActivityLog
import datetime
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
            created_by=self.admin
        )
        assignee = TaskAssignee.objects.create(task=task, user=self.member1)
        
        assignee.completed = True
        assignee.completed_at = timezone.now()
        assignee.save()
        
        metrics = calculate_user_health_metrics(self.member1)
        self.assertEqual(metrics['health_score'], 100)
        
    def test_late_completions_reduce_health(self):
        task = Task.objects.create(
            project=self.project,
            name='Late Task',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            created_by=self.admin
        )
        assignee = TaskAssignee.objects.create(task=task, user=self.member1)
        
        assignee.completed = True
        assignee.completed_at = timezone.now()
        assignee.save()
        
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
        task = Task.objects.create(
            project=self.project,
            name='Shared Task',
            due_date=timezone.now().date() - datetime.timedelta(days=1),
            created_by=self.admin
        )
        a1 = TaskAssignee.objects.create(task=task, user=self.member1)
        a2 = TaskAssignee.objects.create(task=task, user=self.member2)
        
        task.due_date = timezone.now().date() - datetime.timedelta(days=1)
        task.due_time = datetime.time(12, 0, 0)
        task.save()
        
        a1.completed = True
        a1.completed_at = get_task_due_datetime(task.due_date, task.due_time) - datetime.timedelta(hours=2)
        a1.save()
        
        a2.completed = True
        a2.completed_at = get_task_due_datetime(task.due_date, task.due_time) + datetime.timedelta(hours=2)
        a2.save()
        
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
