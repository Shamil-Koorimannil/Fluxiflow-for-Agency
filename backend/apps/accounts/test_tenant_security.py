import io
import datetime
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import CustomUser as User, Organization, Membership, Invitation
from apps.projects.models import Project
from apps.tasks.models import Task, TaskAssignee, SubTask, SubTaskAssignee
from apps.accounts.views import calculate_user_health_metrics

class StrictTenantDataIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Shared Global User (John)
        self.john = User.objects.create_user(
            email='john_dual@test.com',
            name='John Dual',
            password='password123',
            role='ADMIN'
        )

        # Member belonging ONLY to Org B (Bob)
        self.bob = User.objects.create_user(
            email='bob_org_b@test.com',
            name='Bob OrgB',
            password='password123',
            role='MEMBER'
        )

        # Organization A (Zywo)
        self.org_a = Organization.objects.create(
            name='Zywo Org A',
            slug='zywo-a',
            is_active=True
        )
        self.mem_a_john = Membership.objects.create(
            organization=self.org_a,
            user=self.john,
            role='ORG_ADMIN',
            is_active=True
        )

        # Organization B (Test Org B)
        self.org_b = Organization.objects.create(
            name='Test Org B',
            slug='test-b',
            is_active=True
        )
        self.mem_b_john = Membership.objects.create(
            organization=self.org_b,
            user=self.john,
            role='MEMBER',
            is_active=True
        )
        self.mem_b_bob = Membership.objects.create(
            organization=self.org_b,
            user=self.bob,
            role='MEMBER',
            is_active=True
        )

        # Set John's active organization to Org A initially
        self.john.active_organization = self.org_a
        self.john.save()

        # Generate JWT token for John
        refresh = RefreshToken.for_user(self.john)
        refresh['email'] = self.john.email
        refresh['name'] = self.john.name
        refresh['role'] = self.john.role
        self.john_token = str(refresh.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.john_token}')

        # Projects
        self.proj_a = Project.objects.create(
            name='Project A',
            organization=self.org_a,
            created_by=self.john
        )
        self.proj_b = Project.objects.create(
            name='Project B',
            organization=self.org_b,
            created_by=self.john
        )

        # Tasks
        self.task_a = Task.objects.create(
            name='Task A in Org A',
            organization=self.org_a,
            project=self.proj_a,
            due_date=datetime.date(2026, 9, 10),
            created_by=self.john
        )
        TaskAssignee.objects.create(task=self.task_a, user=self.john)

        self.task_b = Task.objects.create(
            name='Task B in Org B',
            organization=self.org_b,
            project=self.proj_b,
            due_date=datetime.date(2026, 9, 12),
            created_by=self.john
        )
        TaskAssignee.objects.create(task=self.task_b, user=self.john)

    def test_1_task_visibility_isolation(self):
        """Org A view returns Task A and excludes Task B."""
        url = reverse('task-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in res.data if not t.get('is_subtask')]
        self.assertIn(str(self.task_a.id), task_ids)
        self.assertNotIn(str(self.task_b.id), task_ids)

        # Switch to Org B via header
        res_b = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        task_ids_b = [t['id'] for t in res_b.data if not t.get('is_subtask')]
        self.assertIn(str(self.task_b.id), task_ids_b)
        self.assertNotIn(str(self.task_a.id), task_ids_b)

    def test_2_dual_organization_user_isolation(self):
        """Same global user sees only active organization tasks."""
        url = reverse('task-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for task_data in res.data:
            if not task_data.get('is_subtask'):
                t = Task.objects.get(id=task_data['id'])
                self.assertEqual(t.organization_id, self.org_a.id)

    def test_3_assignment_isolation(self):
        """User assigned in both orgs sees only Org A assignments in Org A."""
        url = reverse('task-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        names = [t['name'] for t in res.data if not t.get('is_subtask')]
        self.assertIn('Task A in Org A', names)
        self.assertNotIn('Task B in Org B', names)

    def test_4_team_member_task_isolation(self):
        """Team member view in Org A shows Org A tasks only."""
        url = reverse('team_workload', args=[str(self.john.id)])
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        workload = res.data.get('workload', {})
        all_tasks = (
            workload.get('today', []) +
            workload.get('tomorrow', []) +
            workload.get('upcoming', []) +
            workload.get('overdue', []) +
            workload.get('no_due_date', []) +
            workload.get('completed', [])
        )
        task_ids = [t['id'] for t in all_tasks]
        self.assertIn(str(self.task_a.id), task_ids)
        self.assertNotIn(str(self.task_b.id), task_ids)

    def test_5_health_isolation(self):
        """Org B tasks have 0 influence on Org A health metrics."""
        metrics_a = calculate_user_health_metrics(self.john, organization=self.org_a)
        metrics_b = calculate_user_health_metrics(self.john, organization=self.org_b)
        self.assertEqual(metrics_a['pending_tasks'], 1)
        self.assertEqual(metrics_b['pending_tasks'], 1)

    def test_6_project_isolation(self):
        """Org B project does not appear in Org A project list."""
        url = reverse('project-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        proj_ids = [p['id'] for p in res.data]
        self.assertIn(str(self.proj_a.id), proj_ids)
        self.assertNotIn(str(self.proj_b.id), proj_ids)

    def test_7_cross_tenant_task_detail_returns_404(self):
        """Accessing Org B task ID in Org A returns HTTP 404."""
        url = reverse('task-detail', args=[str(self.task_b.id)])
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_8_cross_tenant_project_detail_returns_404(self):
        """Accessing Org B project ID in Org A returns HTTP 404."""
        url = reverse('project-detail', args=[str(self.proj_b.id)])
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_9_cross_tenant_task_assignment_rejected(self):
        """Assigning an Org B-only member (Bob) to an Org A task returns 400."""
        url = reverse('task-list')
        res = self.client.post(url, {
            'name': 'Cross Assign Task',
            'project': str(self.proj_a.id),
            'assignee_ids': [str(self.bob.id)]
        }, format='json', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignee_ids', res.data)

    def test_10_cross_tenant_project_relationship_rejected(self):
        """Linking an Org B project to an Org A task returns 400."""
        url = reverse('task-list')
        res = self.client.post(url, {
            'name': 'Cross Project Task',
            'project': str(self.proj_b.id)
        }, format='json', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('project', res.data)

    def test_11_bulk_upload_isolation(self):
        """Bulk uploading tasks for an Org B project while Org A active is rejected."""
        url = reverse('project-bulk-import-validate', args=[self.proj_b.id])
        file_content = b"Title\nTask 1\n"
        csv_file = io.BytesIO(file_content)
        csv_file.name = "test_bulk.csv"
        res = self.client.post(url, {'file': csv_file}, format='multipart', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_12_role_isolation(self):
        """John has ORG_ADMIN role in Org A, but MEMBER role in Org B."""
        url = reverse('organizations-detail', args=[str(self.org_a.id)])
        res_a = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_a.data['role'], 'ORG_ADMIN')

        url_b = reverse('organizations-detail', args=[str(self.org_b.id)])
        res_b = self.client.get(url_b, HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(res_b.data['role'], 'MEMBER')

    def test_13_invitation_creates_membership_without_duplicating_user(self):
        """Inviting an existing user into a new organization creates a Membership without duplicate User records."""
        initial_user_count = User.objects.count()
        url = reverse('team_list')
        res = self.client.post(url, {
            'email': self.bob.email,
            'name': self.bob.name,
            'role': 'MEMBER'
        }, format='json', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), initial_user_count)
        self.assertTrue(Membership.objects.filter(organization=self.org_a, user=self.bob).exists())

    def test_14_header_validation_security(self):
        """Forged X-Organization-Id for unjoined organization falls back securely."""
        unjoined_org = Organization.objects.create(name='Unjoined Org', slug='unjoined')
        url = reverse('task-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(unjoined_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Verify fallback did not expose unjoined organization
        for task_data in res.data:
            if not task_data.get('is_subtask'):
                t = Task.objects.get(id=task_data['id'])
                self.assertNotEqual(t.organization_id, unjoined_org.id)

    def test_15_cross_tenant_comment_access(self):
        """Org B task comments cannot be accessed while Org A is active."""
        from apps.tasks.models import TaskComment
        comment_b = TaskComment.objects.create(task=self.task_b, author=self.john, content='Secret Org B Comment')
        
        # Accessing comment list for Org B task while Org A is active
        url = reverse('comment-list') + f'?task={self.task_b.id}'
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

        # Accessing comment detail directly
        detail_url = reverse('comment-detail', args=[comment_b.id])
        res_detail = self.client.get(detail_url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_16_cross_tenant_attachment_access(self):
        """Org B task attachments cannot be accessed while Org A is active."""
        from apps.tasks.models import TaskAttachment
        from django.core.files.uploadedfile import SimpleUploadedFile
        dummy_file = SimpleUploadedFile("b.png", b"file_content", content_type="image/png")
        attachment_b = TaskAttachment.objects.create(
            task=self.task_b,
            uploaded_by=self.john,
            original_name='b.png',
            mime_type='image/png',
            size=12,
            file=dummy_file
        )
        
        # Accessing attachment list for Org B task while Org A active
        url = reverse('attachment-list') + f'?task={self.task_b.id}'
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

        # Accessing attachment detail directly
        detail_url = reverse('attachment-detail', args=[attachment_b.id])
        res_detail = self.client.get(detail_url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_17_cross_tenant_timer_session_access(self):
        """Timer control endpoints on Org B tasks return 404 while Org A is active."""
        url = f"/tasks/{self.task_b.id}/timer/"
        res = self.client.post(url, {'action': 'start'}, format='json', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_18_cross_tenant_task_history_activity_access(self):
        """History & activity endpoints on Org B tasks return 404 while Org A is active."""
        url = f"/tasks/{self.task_b.id}/history/"
        res = self.client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
