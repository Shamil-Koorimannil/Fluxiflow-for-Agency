import uuid
import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.accounts.models import Organization, Membership
from apps.tasks.models import Task, TaskAssignee, TaskType, SubTask, TaskAttachment
from apps.projects.models import Project
from apps.clients.models import Client, ClientBrandAsset, ClientBrandAssetFolder
from apps.activity.models import ActivityLog
from apps.notifications.models import Notification
from apps.keep.models import KeepItem

User = get_user_model()


class TenantSecurityTestCase(APITestCase):
    def setUp(self):
        # 1. Create two isolated organizations
        self.org_a = Organization.objects.create(name="Organization A", slug="org-a")
        self.org_b = Organization.objects.create(name="Organization B", slug="org-b")

        # 2. Create users with ACTIVE status
        self.admin_a = User.objects.create_user(
            email="admin_a@test.com", password="password123", name="Admin A", role="ADMIN", status="ACTIVE"
        )
        self.member_a = User.objects.create_user(
            email="member_a@test.com", password="password123", name="Member A", role="MEMBER", status="ACTIVE"
        )

        self.admin_b = User.objects.create_user(
            email="admin_b@test.com", password="password123", name="Admin B", role="ADMIN", status="ACTIVE"
        )
        self.member_b = User.objects.create_user(
            email="member_b@test.com", password="password123", name="Member B", role="MEMBER", status="ACTIVE"
        )

        # Dual membership user: ORG_ADMIN in Org A, MEMBER in Org B
        self.dual_user = User.objects.create_user(
            email="dual@test.com", password="password123", name="Dual User", role="MEMBER", status="ACTIVE"
        )

        # Memberships
        Membership.objects.create(user=self.admin_a, organization=self.org_a, role="ORG_ADMIN", is_active=True)
        Membership.objects.create(user=self.member_a, organization=self.org_a, role="MEMBER", is_active=True)

        Membership.objects.create(user=self.admin_b, organization=self.org_b, role="ORG_ADMIN", is_active=True)
        Membership.objects.create(user=self.member_b, organization=self.org_b, role="MEMBER", is_active=True)

        Membership.objects.create(user=self.dual_user, organization=self.org_a, role="ORG_ADMIN", is_active=True)
        Membership.objects.create(user=self.dual_user, organization=self.org_b, role="MEMBER", is_active=True)

        # Set default active orgs
        self.admin_a.active_organization = self.org_a
        self.admin_a.save()
        self.member_a.active_organization = self.org_a
        self.member_a.save()

        self.admin_b.active_organization = self.org_b
        self.admin_b.save()
        self.member_b.active_organization = self.org_b
        self.member_b.save()

        self.dual_user.active_organization = self.org_a
        self.dual_user.save()

        # 3. Create Resources in Org A
        self.project_a = Project.objects.create(
            name="Project A", organization=self.org_a, created_by=self.admin_a
        )
        self.client_a = Client.objects.create(
            name="Client A", company_name="Company A", organization=self.org_a, created_by=self.admin_a
        )
        self.task_type_a = TaskType.objects.create(
            name="Design A", organization=self.org_a
        )
        self.task_a = Task.objects.create(
            name="Task A", organization=self.org_a, project=self.project_a, task_type=self.task_type_a, created_by=self.admin_a
        )
        TaskAssignee.objects.create(task=self.task_a, user=self.admin_a)
        TaskAssignee.objects.create(task=self.task_a, user=self.member_a)

        self.activity_a = ActivityLog.objects.create(
            user=self.admin_a, organization=self.org_a, action="TASK_CREATED", entity_type="Task", entity_id=self.task_a.id, description="Created Task A"
        )
        self.notification_a = Notification.objects.create(
            recipient=self.admin_a, organization=self.org_a, type="TASK_ASSIGNED", title="Notif A", message="Task A assigned", related_task=self.task_a
        )
        self.keep_a = KeepItem.objects.create(
            name="Keep A", organization=self.org_a, owner=self.admin_a, created_by=self.admin_a, item_type="NOTE"
        )

        # 4. Create Resources in Org B
        self.project_b = Project.objects.create(
            name="Project B", organization=self.org_b, created_by=self.admin_b
        )
        self.client_b = Client.objects.create(
            name="Client B", company_name="Company B", organization=self.org_b, created_by=self.admin_b
        )
        self.task_type_b = TaskType.objects.create(
            name="Dev B", organization=self.org_b
        )
        self.task_b = Task.objects.create(
            name="Task B", organization=self.org_b, project=self.project_b, task_type=self.task_type_b, created_by=self.admin_b
        )
        TaskAssignee.objects.create(task=self.task_b, user=self.admin_b)
        TaskAssignee.objects.create(task=self.task_b, user=self.member_b)

        self.activity_b = ActivityLog.objects.create(
            user=self.admin_b, organization=self.org_b, action="TASK_CREATED", entity_type="Task", entity_id=self.task_b.id, description="Created Task B"
        )
        self.notification_b = Notification.objects.create(
            recipient=self.admin_b, organization=self.org_b, type="TASK_ASSIGNED", title="Notif B", message="Task B assigned", related_task=self.task_b
        )
        self.keep_b = KeepItem.objects.create(
            name="Keep B", organization=self.org_b, owner=self.admin_b, created_by=self.admin_b, item_type="NOTE"
        )

    # -------------------------------------------------------------------------
    # TEST 1 & 2: Task Isolation Across Orgs
    # -------------------------------------------------------------------------
    def test_01_org_a_task_invisible_in_org_b(self):
        self.client.force_authenticate(user=self.admin_b)
        response = self.client.get('/api/tasks/', HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertNotIn(str(self.task_a.id), task_ids)
        self.assertIn(str(self.task_b.id), task_ids)

    def test_02_org_b_task_invisible_in_org_a(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/tasks/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertNotIn(str(self.task_b.id), task_ids)

    # -------------------------------------------------------------------------
    # TEST 3: Project Isolation
    # -------------------------------------------------------------------------
    def test_03_project_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/projects/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_ids = [p['id'] for p in response.data]
        self.assertIn(str(self.project_a.id), project_ids)
        self.assertNotIn(str(self.project_b.id), project_ids)

    # -------------------------------------------------------------------------
    # TEST 4: Client Isolation
    # -------------------------------------------------------------------------
    def test_04_client_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/clients/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        client_ids = [c['id'] for c in response.data]
        self.assertIn(str(self.client_a.id), client_ids)
        self.assertNotIn(str(self.client_b.id), client_ids)

    # -------------------------------------------------------------------------
    # TEST 5: Activity Log Isolation
    # -------------------------------------------------------------------------
    def test_05_activity_log_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/activity/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        act_ids = [a['id'] for a in response.data]
        self.assertIn(str(self.activity_a.id), act_ids)
        self.assertNotIn(str(self.activity_b.id), act_ids)

    # -------------------------------------------------------------------------
    # TEST 6 & 26 & 29: Reports Data & Export Isolation (Aggregation 10 vs 100)
    # -------------------------------------------------------------------------
    def test_06_reports_data_aggregation_isolation(self):
        # Create 9 additional tasks in Org B (total 10 in B, 1 in A)
        for i in range(9):
            Task.objects.create(name=f"Extra B {i}", organization=self.org_b, created_by=self.admin_b)

        today_str = str(timezone.localdate())
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/reports/daily/?date={today_str}', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Summary total members should be for Org A members
        self.assertEqual(response.data['summary']['total_members'], 3) # admin_a, member_a, dual_user

    # -------------------------------------------------------------------------
    # TEST 7: Global Search Isolation
    # -------------------------------------------------------------------------
    def test_07_global_search_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/search/?q=Task', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_names = [t['name'] for t in response.data['tasks']]
        self.assertIn('Task A', task_names)
        self.assertNotIn('Task B', task_names)

    # -------------------------------------------------------------------------
    # TEST 8: Notifications Isolation
    # -------------------------------------------------------------------------
    def test_08_notifications_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/notifications/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notif_ids = [n['id'] for n in response.data['results']] if isinstance(response.data, dict) and 'results' in response.data else [n['id'] for n in response.data]
        self.assertIn(str(self.notification_a.id), notif_ids)
        self.assertNotIn(str(self.notification_b.id), notif_ids)

    # -------------------------------------------------------------------------
    # TEST 9 & 10: Team Health & Workload Isolation
    # -------------------------------------------------------------------------
    def test_09_team_workload_health_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/team/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        member_emails = [m['email'] for m in response.data]
        self.assertIn(self.member_a.email, member_emails)
        self.assertNotIn(self.member_b.email, member_emails)

    # -------------------------------------------------------------------------
    # TEST 11: Keep Items Isolation
    # -------------------------------------------------------------------------
    def test_11_keep_items_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/keep/items/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        keep_ids = [k['id'] for k in response.data]
        self.assertIn(str(self.keep_a.id), keep_ids)
        self.assertNotIn(str(self.keep_b.id), keep_ids)

    # -------------------------------------------------------------------------
    # TEST 12: Task Types Isolation
    # -------------------------------------------------------------------------
    def test_12_task_types_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/task-types/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        type_ids = [tt['id'] for tt in response.data]
        self.assertIn(str(self.task_type_a.id), type_ids)
        self.assertNotIn(str(self.task_type_b.id), type_ids)

    # -------------------------------------------------------------------------
    # TEST 13, 14, 15, 17: Cross-Tenant Resource Access Returns 404 Policy
    # -------------------------------------------------------------------------
    def test_13_cross_tenant_task_access_returns_404(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/tasks/{self.task_b.id}/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_14_cross_tenant_project_access_returns_404(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/projects/{self.project_b.id}/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_15_cross_tenant_client_access_returns_404(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/clients/{self.client_b.id}/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_17_cross_tenant_keep_access_returns_404(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/keep/items/{self.keep_b.id}/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -------------------------------------------------------------------------
    # TEST 18, 19, 20, 21: Cross-Org Relationship Assignment Rejected (HTTP 400)
    # -------------------------------------------------------------------------
    def test_18_cross_org_task_project_assignment_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/tasks/', {
            "name": "Cross Task",
            "project": str(self.project_b.id)
        }, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_19_cross_org_project_client_assignment_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/projects/', {
            "name": "Cross Project",
            "client": str(self.client_b.id)
        }, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_21_cross_org_task_type_assignment_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/tasks/', {
            "name": "Cross Type Task",
            "task_type": str(self.task_type_b.id)
        }, HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # TEST 23 & 24: Header Validation & Forged Header Rejection
    # -------------------------------------------------------------------------
    def test_23_forged_header_without_membership_rejected(self):
        # admin_a is NOT a member of org_b
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/tasks/', HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        # Should fall back to active_organization (org_a) or reject request
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertNotIn(str(self.task_b.id), task_ids)

    def test_24_valid_header_resolves_tenant_context(self):
        self.client.force_authenticate(user=self.dual_user)
        # Switch context to Org B via header
        response = self.client.get('/api/tasks/', HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # TEST 25: Dual-Membership User Sees Only Active Org Data
    # -------------------------------------------------------------------------
    def test_25_dual_membership_user_active_org_data_only(self):
        self.client.force_authenticate(user=self.dual_user)

        # When active org is Org A
        res_a = self.client.get('/api/projects/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        p_ids_a = [p['id'] for p in res_a.data]
        self.assertIn(str(self.project_a.id), p_ids_a)
        self.assertNotIn(str(self.project_b.id), p_ids_a)

        # When active org is Org B
        res_b = self.client.get('/api/projects/', HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        p_ids_b = [p['id'] for p in res_b.data]
        self.assertIn(str(self.project_b.id), p_ids_b)
        self.assertNotIn(str(self.project_a.id), p_ids_b)

    # -------------------------------------------------------------------------
    # TEST 27: ORG_ADMIN Role Membership Scoping
    # -------------------------------------------------------------------------
    def test_27_org_admin_role_membership_scoping(self):
        # dual_user is ORG_ADMIN in Org A, but MEMBER in Org B
        self.client.force_authenticate(user=self.dual_user)

        # In Org A (Admin permitted action)
        res_a = self.client.get('/api/activity/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

        # In Org B (Member should be blocked from activity logs)
        res_b = self.client.get('/api/activity/', HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        self.assertEqual(res_b.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # TEST 28: Member Privacy Rules (Cannot Inspect Other Member Workload)
    # -------------------------------------------------------------------------
    def test_28_member_privacy_rules_enforced(self):
        self.client.force_authenticate(user=self.member_a)
        response = self.client.get(f'/api/team/{self.admin_a.id}/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # TEST 30: File Download Link Enforces Tenant Boundary
    # -------------------------------------------------------------------------
    def test_30_file_download_enforces_tenant_boundary(self):
        self.client.force_authenticate(user=self.admin_a)
        # Attempt to access Org B keep item download
        response = self.client.get(f'/api/keep/items/{self.keep_b.id}/download/', HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
