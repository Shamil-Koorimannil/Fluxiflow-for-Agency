from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.projects.models import Project, SubProject
from apps.tasks.models import Task, TaskAssignee, SubTask
from apps.activity.models import ActivityLog

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
        self.subproject = SubProject.objects.create(
            project=self.project,
            name='Test SubProject',
            created_by=self.admin
        )

        # Setup basic task assigned to Member 1
        self.task = Task.objects.create(
            project=self.project,
            sub_project=self.subproject,
            name='Test Task 1',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=self.task, user=self.member1)

    def get_jwt_token(self, email, password):
        response = self.client.post(reverse('login'), {'email': email, 'password': password})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['access']

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

    def test_login_works_and_returns_payload(self):
        self.clear_auth()
        response = self.client.post(reverse('login'), {
            'email': self.member1.email,
            'password': self.member_password
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], self.member1.email)
        self.assertEqual(response.data['user']['role'], 'MEMBER')

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
