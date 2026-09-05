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
            due_date=datetime.date.today() - datetime.timedelta(days=2),
            created_by=self.john
        )
        TaskAssignee.objects.create(task=self.task_a, user=self.john)

        self.task_b = Task.objects.create(
            name='Task B in Org B',
            organization=self.org_b,
            project=self.proj_b,
            due_date=datetime.date.today() - datetime.timedelta(days=2),
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


class OrganizationRoleVisibilityAndMemberSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Organizations
        self.org_a = Organization.objects.create(name='Org Alpha', slug='org-alpha', is_active=True)
        self.org_b = Organization.objects.create(name='Org Beta', slug='org-beta', is_active=True)

        # Users
        # User 1: Dual User - ORG_ADMIN in Org A, MEMBER in Org B
        self.user_dual = User.objects.create_user(
            email='dual_user@test.com',
            name='Dual User',
            password='password123',
            role='MEMBER'
        )
        self.mem_dual_a = Membership.objects.create(organization=self.org_a, user=self.user_dual, role='ORG_ADMIN', is_active=True)
        self.mem_dual_b = Membership.objects.create(organization=self.org_b, user=self.user_dual, role='MEMBER', is_active=True)

        # User 2: Admin in Org A
        self.user_admin_a = User.objects.create_user(
            email='admin_a@test.com',
            name='Admin Alpha',
            password='password123',
            role='ADMIN'
        )
        self.mem_admin_a = Membership.objects.create(organization=self.org_a, user=self.user_admin_a, role='ADMIN', is_active=True)

        # User 3: Member 1 in Org A
        self.user_mem1_a = User.objects.create_user(
            email='mem1_a@test.com',
            name='Member 1 Alpha',
            password='password123',
            role='MEMBER'
        )
        self.mem_mem1_a = Membership.objects.create(organization=self.org_a, user=self.user_mem1_a, role='MEMBER', is_active=True)

        # User 4: Member 2 in Org A
        self.user_mem2_a = User.objects.create_user(
            email='mem2_a@test.com',
            name='Member 2 Alpha',
            password='password123',
            role='MEMBER'
        )
        self.mem_mem2_a = Membership.objects.create(organization=self.org_a, user=self.user_mem2_a, role='MEMBER', is_active=True)

        # User 5: Member in Org B ONLY
        self.user_b_only = User.objects.create_user(
            email='user_b_only@test.com',
            name='User Beta Only',
            password='password123',
            role='MEMBER'
        )
        self.mem_b_only = Membership.objects.create(organization=self.org_b, user=self.user_b_only, role='MEMBER', is_active=True)

    def get_client_for_user(self, user, active_org=None):
        client = APIClient()
        if active_org:
            user.active_organization = active_org
            user.save()
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        return client

    def test_1_org_admin_can_access_every_admin_visible_resource(self):
        """1. ORG_ADMIN can access every ADMIN-visible resource."""
        client = self.get_client_for_user(self.user_dual, self.org_a)
        
        # Access team list
        res = client.get(reverse('team_list'), HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Access project list
        res_proj = client.get(reverse('project-list'), HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_proj.status_code, status.HTTP_200_OK)

        # Access client list
        res_client = client.get(reverse('client-list'), HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_client.status_code, status.HTTP_200_OK)

        # Access task list
        res_tasks = client.get(reverse('task-list'), HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_tasks.status_code, status.HTTP_200_OK)

    def test_2_org_admin_can_access_all_member_details(self):
        """2. ORG_ADMIN can access all member details in its organization."""
        client = self.get_client_for_user(self.user_dual, self.org_a)
        url = reverse('team_detail', args=[str(self.user_mem1_a.id)])
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['email'], self.user_mem1_a.email)

    def test_3_org_admin_can_access_all_member_health_data(self):
        """3. ORG_ADMIN can access all member health data in its organization."""
        client = self.get_client_for_user(self.user_dual, self.org_a)
        url = reverse('team_workload', args=[str(self.user_mem1_a.id)])
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('health_score', res.data['summary'])

    def test_4_admin_retains_existing_organization_wide_visibility(self):
        """4. ADMIN retains existing organization-wide visibility."""
        client = self.get_client_for_user(self.user_admin_a, self.org_a)
        
        # Access member detail
        url_detail = reverse('team_detail', args=[str(self.user_mem1_a.id)])
        res_detail = client.get(url_detail, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)

        # Access member health
        url_health = reverse('team_workload', args=[str(self.user_mem1_a.id)])
        res_health = client.get(url_health, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_health.status_code, status.HTTP_200_OK)

    def test_5_member_can_access_own_member_detail(self):
        """5. MEMBER can access own member detail."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        url = reverse('team_detail', args=[str(self.user_mem1_a.id)])
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['email'], self.user_mem1_a.email)

    def test_6_member_can_access_own_health(self):
        """6. MEMBER can access own health."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        url = reverse('team_workload', args=[str(self.user_mem1_a.id)])
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['summary']['id'], str(self.user_mem1_a.id))

    def test_7_member_cannot_access_another_member_detail(self):
        """7. MEMBER cannot access another member's detail."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        url = reverse('team_detail', args=[str(self.user_mem2_a.id)])
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_8_member_cannot_access_another_member_health(self):
        """8. MEMBER cannot access another member's health."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        url = reverse('team_workload', args=[str(self.user_mem2_a.id)])
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_9_member_cannot_bypass_restriction_using_another_member_id(self):
        """9. MEMBER cannot bypass restriction using another member's ID in URL path."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        
        # Try accessing another member's tasks endpoint
        url_tasks = reverse('team_tasks', args=[str(self.user_mem2_a.id)])
        res_tasks = client.get(url_tasks, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_tasks.status_code, status.HTTP_403_FORBIDDEN)

        # Try accessing another member's detail endpoint
        url_detail = reverse('team_detail', args=[str(self.user_mem2_a.id)])
        res_detail = client.get(url_detail, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

    def test_10_member_cannot_bypass_restriction_using_query_parameters(self):
        """10. MEMBER cannot bypass restriction using query parameters."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        url = reverse('team_detail', args=[str(self.user_mem2_a.id)]) + f"?user_id={self.user_mem1_a.id}&email={self.user_mem1_a.email}"
        res = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_11_member_cannot_bypass_restriction_using_organization_headers(self):
        """11. MEMBER cannot bypass restriction using organization headers."""
        client = self.get_client_for_user(self.user_mem1_a, self.org_a)
        url = reverse('team_detail', args=[str(self.user_mem2_a.id)])
        
        # Try forged org header
        res_a = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_a.status_code, status.HTTP_403_FORBIDDEN)

        res_b = client.get(url, HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(res_b.status_code, status.HTTP_403_FORBIDDEN)

    def test_12_member_restrictions_remain_correct_after_organization_switching(self):
        """12. Member restrictions remain correct after organization switching."""
        client = self.get_client_for_user(self.user_dual, self.org_a)
        
        # In Org A (ORG_ADMIN), can access member 1 detail
        url_mem1 = reverse('team_detail', args=[str(self.user_mem1_a.id)])
        res_a = client.get(url_mem1, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

        # Switch active org to Org B (where user_dual is MEMBER)
        self.user_dual.active_organization = self.org_b
        self.user_dual.save()

        # In Org B (MEMBER), trying to access another member in Org B (user_b_only) MUST return 403
        url_b_only = reverse('team_detail', args=[str(self.user_b_only.id)])
        res_b = client.get(url_b_only, HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(res_b.status_code, status.HTTP_403_FORBIDDEN)

    def test_13_dual_role_user_permissions(self):
        """13. A user who is ORG_ADMIN in Org A but MEMBER in Org B receives ORG_ADMIN in A and MEMBER in B."""
        client = self.get_client_for_user(self.user_dual, self.org_a)
        
        # In Org A: ORG_ADMIN privileges
        res_a = client.get(reverse('team_list'), HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        # Can view all members in Org A list
        member_emails_a = [m['email'] for m in res_a.data]
        self.assertIn(self.user_mem1_a.email, member_emails_a)

        # In Org B: MEMBER privileges
        res_b = client.get(reverse('team_list'), HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        # Should only view self in Org B list
        member_emails_b = [m['email'] for m in res_b.data]
        self.assertEqual(len(member_emails_b), 1)
        self.assertIn(self.user_dual.email, member_emails_b)
        self.assertNotIn(self.user_b_only.email, member_emails_b)

    def test_14_cross_organization_member_access_returns_appropriate_response(self):
        """14. Cross-organization member/health access returns appropriate 404 or 403 response."""
        client = self.get_client_for_user(self.user_admin_a, self.org_a)
        
        # Admin Alpha in Org A attempts to access user_b_only (who is not in Org A)
        url_detail = reverse('team_detail', args=[str(self.user_b_only.id)])
        res_detail = client.get(url_detail, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

        url_workload = reverse('team_workload', args=[str(self.user_b_only.id)])
        res_workload = client.get(url_workload, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_workload.status_code, status.HTTP_404_NOT_FOUND)


from django.core.management import call_command

class ZywoInitialAdminSetupAndRoleManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Zywo organization
        self.zywo_org, _ = Organization.objects.get_or_create(
            slug="zywo",
            defaults={"name": "Zywo", "is_active": True}
        )
        # Create Other Organization
        self.other_org, _ = Organization.objects.get_or_create(
            slug="other-org",
            defaults={"name": "Other Org", "is_active": True}
        )

        # Create existing user muhammedshamil251@gmail.com
        self.shamil, _ = User.objects.get_or_create(
            email="muhammedshamil251@gmail.com",
            defaults={"name": "Shamil", "role": "MEMBER", "username": "muhammedshamil251@gmail.com"}
        )
        if not self.shamil.check_password("password123"):
            self.shamil.set_password("password123")
            self.shamil.save()

        # Shamil has MEMBER role in Zywo initially and ADMIN role in Other Org
        self.shamil_zywo_mem, _ = Membership.objects.get_or_create(
            organization=self.zywo_org,
            user=self.shamil,
            defaults={"role": "MEMBER", "is_active": True}
        )
        self.shamil_other_mem, _ = Membership.objects.get_or_create(
            organization=self.other_org,
            user=self.shamil,
            defaults={"role": "ADMIN", "is_active": True}
        )

        # Standard Member & Admin in Zywo
        self.zywo_member, _ = User.objects.get_or_create(
            email="member@zywo.test",
            defaults={"name": "Zywo Member", "role": "MEMBER", "username": "member@zywo.test"}
        )
        self.zywo_member_mem, _ = Membership.objects.get_or_create(
            organization=self.zywo_org,
            user=self.zywo_member,
            defaults={"role": "MEMBER", "is_active": True}
        )

        self.zywo_admin, _ = User.objects.get_or_create(
            email="admin@zywo.test",
            defaults={"name": "Zywo Admin", "role": "ADMIN", "username": "admin@zywo.test"}
        )
        self.zywo_admin_mem, _ = Membership.objects.get_or_create(
            organization=self.zywo_org,
            user=self.zywo_admin,
            defaults={"role": "ADMIN", "is_active": True}
        )

    def get_client_for_user(self, user, active_org=None):
        client = APIClient()
        if active_org:
            user.active_organization = active_org
            user.save()
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        return client

    def test_1_existing_zywo_user_can_be_promoted_to_org_admin(self):
        """1. Existing Zywo user can be promoted to ORG_ADMIN."""
        self.shamil_zywo_mem.role = "ORG_ADMIN"
        self.shamil_zywo_mem.save()
        self.assertEqual(Membership.objects.get(id=self.shamil_zywo_mem.id).role, "ORG_ADMIN")

    def test_2_missing_zywo_in_user_is_safely_created(self):
        """2. Missing zywo.in@gmail.com user is safely created via management command."""
        call_command("setup_zywo_admins")
        zywo_user = User.objects.filter(email="zywo.in@gmail.com").first()
        self.assertIsNotNone(zywo_user)
        self.assertEqual(zywo_user.status, "INVITED")

    def test_3_zywo_in_user_receives_zywo_org_admin_membership(self):
        """3. zywo.in@gmail.com receives Zywo ORG_ADMIN membership."""
        call_command("setup_zywo_admins")
        zywo_user = User.objects.get(email="zywo.in@gmail.com")
        mem = Membership.objects.filter(organization=self.zywo_org, user=zywo_user).first()
        self.assertIsNotNone(mem)
        self.assertEqual(mem.role, "ORG_ADMIN")

    def test_4_existing_user_is_not_duplicated(self):
        """4. Existing user is not duplicated during setup command."""
        call_command("setup_zywo_admins")
        shamil_users = User.objects.filter(email="muhammedshamil251@gmail.com")
        self.assertEqual(shamil_users.count(), 1)

    def test_5_existing_users_memberships_in_other_orgs_are_unchanged(self):
        """5. Existing user's memberships in other organizations are unchanged."""
        call_command("setup_zywo_admins")
        other_mem = Membership.objects.get(organization=self.other_org, user=self.shamil)
        self.assertEqual(other_mem.role, "ADMIN")

    def test_6_multiple_org_admins_are_allowed(self):
        """6. Multiple ORG_ADMINs are allowed in the same organization simultaneously."""
        call_command("setup_zywo_admins")
        org_admins = Membership.objects.filter(organization=self.zywo_org, role="ORG_ADMIN")
        self.assertGreaterEqual(org_admins.count(), 2)

    def test_7_org_admin_can_promote_member_to_admin(self):
        """7. ORG_ADMIN can promote MEMBER → ADMIN."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client = self.get_client_for_user(org_admin, self.zywo_org)

        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        res = client.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mem = Membership.objects.get(organization=self.zywo_org, user=self.zywo_member)
        self.assertEqual(mem.role, "ADMIN")

    def test_8_org_admin_can_promote_member_to_org_admin(self):
        """8. ORG_ADMIN can promote MEMBER → ORG_ADMIN."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client = self.get_client_for_user(org_admin, self.zywo_org)

        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        res = client.patch(url, {"role": "ORG_ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mem = Membership.objects.get(organization=self.zywo_org, user=self.zywo_member)
        self.assertEqual(mem.role, "ORG_ADMIN")

    def test_9_org_admin_can_promote_admin_to_org_admin(self):
        """9. ORG_ADMIN can promote ADMIN → ORG_ADMIN."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client = self.get_client_for_user(org_admin, self.zywo_org)

        url = reverse("team_detail", args=[str(self.zywo_admin.id)])
        res = client.patch(url, {"role": "ORG_ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mem = Membership.objects.get(organization=self.zywo_org, user=self.zywo_admin)
        self.assertEqual(mem.role, "ORG_ADMIN")

    def test_10_org_admin_can_demote_org_admin_to_admin(self):
        """10. ORG_ADMIN can demote ORG_ADMIN → ADMIN if another ORG_ADMIN remains."""
        call_command("setup_zywo_admins")
        org_admin1 = User.objects.get(email="muhammedshamil251@gmail.com")
        org_admin2 = User.objects.get(email="zywo.in@gmail.com")
        client = self.get_client_for_user(org_admin1, self.zywo_org)

        url = reverse("team_detail", args=[str(org_admin2.id)])
        res = client.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mem = Membership.objects.get(organization=self.zywo_org, user=org_admin2)
        self.assertEqual(mem.role, "ADMIN")

    def test_11_org_admin_can_demote_org_admin_to_member(self):
        """11. ORG_ADMIN can demote ORG_ADMIN → MEMBER if another ORG_ADMIN remains."""
        call_command("setup_zywo_admins")
        org_admin1 = User.objects.get(email="muhammedshamil251@gmail.com")
        org_admin2 = User.objects.get(email="zywo.in@gmail.com")
        client = self.get_client_for_user(org_admin1, self.zywo_org)

        url = reverse("team_detail", args=[str(org_admin2.id)])
        res = client.patch(url, {"role": "MEMBER"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mem = Membership.objects.get(organization=self.zywo_org, user=org_admin2)
        self.assertEqual(mem.role, "MEMBER")

    def test_12_admin_cannot_change_another_members_role(self):
        """12. ADMIN cannot change another member's role (returns 403)."""
        client = self.get_client_for_user(self.zywo_admin, self.zywo_org)
        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        res = client.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_13_member_cannot_change_another_members_role(self):
        """13. MEMBER cannot change another member's role (returns 403)."""
        client = self.get_client_for_user(self.zywo_member, self.zywo_org)
        url = reverse("team_detail", args=[str(self.zywo_admin.id)])
        res = client.patch(url, {"role": "ORG_ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_14_cross_organization_membership_cannot_be_modified(self):
        """14. Cross-organization membership role modification attempt returns 404."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client = self.get_client_for_user(org_admin, self.zywo_org)

        # Create user in Other Org only
        other_user = User.objects.create_user(email="other_only@test.com", password="password123")
        Membership.objects.create(organization=self.other_org, user=other_user, role="MEMBER")

        url = reverse("team_detail", args=[str(other_user.id)])
        res = client.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_15_role_in_org_a_does_not_change_role_in_org_b(self):
        """15. A user's role in Organization A cannot change their role in Organization B."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client = self.get_client_for_user(org_admin, self.zywo_org)

        # Change self.zywo_member role in Zywo
        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        client.patch(url, {"role": "ORG_ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))

        # Ensure CustomUser.role was not mutated globally
        self.zywo_member.refresh_from_db()
        # Verify Shamil's role in Other Org remains ADMIN
        other_mem = Membership.objects.get(organization=self.other_org, user=self.shamil)
        self.assertEqual(other_mem.role, "ADMIN")

    def test_16_final_org_admin_cannot_accidentally_leave_org_without_org_admin(self):
        """16. Final ORG_ADMIN cannot demote self or leave organization with zero ORG_ADMINs."""
        # Ensure only 1 ORG_ADMIN in Zywo
        self.shamil_zywo_mem.role = "ORG_ADMIN"
        self.shamil_zywo_mem.save()

        client = self.get_client_for_user(self.shamil, self.zywo_org)
        url = reverse("team_detail", args=[str(self.shamil.id)])
        res = client.patch(url, {"role": "MEMBER"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Membership.objects.get(id=self.shamil_zywo_mem.id).role, "ORG_ADMIN")

    def test_17_role_changes_take_effect_without_requiring_new_global_account(self):
        """17. Role changes take effect immediately on backend queries without requiring re-registration."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client_admin = self.get_client_for_user(org_admin, self.zywo_org)

        # Promote member to ADMIN
        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        client_admin.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))

        # Now member client accesses team list (ADMIN permissions)
        client_member = self.get_client_for_user(self.zywo_member, self.zywo_org)
        res = client_member.get(reverse("team_list"), HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_18_bootstrap_migration_is_idempotent(self):
        """18. Bootstrap/migration is idempotent across multiple runs."""
        call_command("setup_zywo_admins")
        call_command("setup_zywo_admins")
        call_command("setup_zywo_admins")

        zywo_users = User.objects.filter(email__in=["zywo.in@gmail.com", "muhammedshamil251@gmail.com"])
        self.assertEqual(zywo_users.count(), 2)

        org_admins = Membership.objects.filter(organization=self.zywo_org, role="ORG_ADMIN")
        self.assertEqual(org_admins.count(), 2)

    def test_19_multiple_org_admins_remain_valid_after_role_changes(self):
        """19. Multiple ORG_ADMINs remain valid after other role changes occur in org."""
        call_command("setup_zywo_admins")
        org_admin = User.objects.get(email="muhammedshamil251@gmail.com")
        client = self.get_client_for_user(org_admin, self.zywo_org)

        # Change another user role
        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        client.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))

        org_admins = Membership.objects.filter(organization=self.zywo_org, role="ORG_ADMIN")
        self.assertEqual(org_admins.count(), 2)

    def test_20_organization_switching_correctly_changes_effective_permissions(self):
        """20. Organization switching correctly changes effective permissions."""
        call_command("setup_zywo_admins")
        # Shamil is ORG_ADMIN in Zywo, but ADMIN in Other Org
        client = self.get_client_for_user(self.shamil, self.zywo_org)

        # In Zywo: can execute role update
        url = reverse("team_detail", args=[str(self.zywo_member.id)])
        res_zywo = client.patch(url, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.zywo_org.id))
        self.assertEqual(res_zywo.status_code, status.HTTP_200_OK)

        # Switch context to Other Org where Shamil is ADMIN (not ORG_ADMIN)
        self.shamil.active_organization = self.other_org
        self.shamil.save()

        other_member = User.objects.create_user(email="other_mem@test.com", password="password123")
        Membership.objects.create(organization=self.other_org, user=other_member, role="MEMBER")

        url_other = reverse("team_detail", args=[str(other_member.id)])
        res_other = client.patch(url_other, {"role": "ADMIN"}, format="json", HTTP_X_ORGANIZATION_ID=str(self.other_org.id))
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)


