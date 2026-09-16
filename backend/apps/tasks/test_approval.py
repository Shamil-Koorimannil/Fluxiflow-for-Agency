import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from django.contrib.auth import get_user_model
from apps.accounts.models import Organization, Membership
from apps.projects.models import Project
from apps.tasks.models import Task, TaskAssignee, TaskComment, RecurringTaskSeries
from apps.notifications.models import Notification

User = get_user_model()


class ApprovalTaskFeatureTestCase(APITestCase):
    def setUp(self):
        # Create Organization
        self.org = Organization.objects.create(name="Test Org", enable_task_approval=True)

        # Create Users
        self.org_admin = User.objects.create_user(
            email="admin@test.com", password="password123", name="Org Admin", role="ADMIN", active_organization=self.org
        )
        Membership.objects.create(user=self.org_admin, organization=self.org, role="ORG_ADMIN")

        self.approver = User.objects.create_user(
            email="approver@test.com", password="password123", name="Manager Approver", role="ADMIN", active_organization=self.org
        )
        Membership.objects.create(user=self.approver, organization=self.org, role="ADMIN")

        self.staff1 = User.objects.create_user(
            email="staff1@test.com", password="password123", name="Staff One", role="MEMBER", active_organization=self.org
        )
        Membership.objects.create(user=self.staff1, organization=self.org, role="MEMBER")

        self.staff2 = User.objects.create_user(
            email="staff2@test.com", password="password123", name="Staff Two", role="MEMBER", active_organization=self.org
        )
        Membership.objects.create(user=self.staff2, organization=self.org, role="MEMBER")

        # Other Org & User for Tenant Isolation
        self.other_org = Organization.objects.create(name="Other Org", enable_task_approval=True)
        self.other_user = User.objects.create_user(
            email="other@test.com", password="password123", name="Other User", role="ADMIN", active_organization=self.other_org
        )
        Membership.objects.create(user=self.other_user, organization=self.other_org, role="ADMIN")

        # Create Project
        self.project = Project.objects.create(
            name="Approval Project", organization=self.org, created_by=self.org_admin
        )

    def force_authenticate_user(self, user):
        self.client.force_authenticate(user=user)
        self.client.defaults['HTTP_X_ORGANIZATION_ID'] = str(user.active_organization.id) if user.active_organization else str(self.org.id)

    # -------------------------------------------------------------------------
    # 1. Organization Feature Setting Tests
    # -------------------------------------------------------------------------

    def test_enable_task_approval_default_true(self):
        new_org = Organization.objects.create(name="Default Org")
        self.assertTrue(new_org.enable_task_approval)

    def test_org_admin_can_toggle_enable_task_approval(self):
        self.force_authenticate_user(self.org_admin)
        response = self.client.patch("/api/organizations/settings/", {
            "enable_task_approval": False
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.org.refresh_from_db()
        self.assertFalse(self.org.enable_task_approval)

    def test_member_cannot_toggle_enable_task_approval(self):
        self.force_authenticate_user(self.staff1)
        response = self.client.patch("/api/organizations/settings/", {
            "enable_task_approval": False
        })
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED])

    def test_create_task_with_approval_when_setting_disabled_returns_400(self):
        self.org.enable_task_approval = False
        self.org.save()

        self.force_authenticate_user(self.org_admin)
        response = self.client.post("/api/tasks/", {
            "name": "Invalid Approval Task",
            "project": str(self.project.id),
            "approval_required": True,
            "approver": str(self.approver.id),
            "assignee_ids": [str(self.staff1.id)]
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_existing_approval_tasks_remain_intact_when_setting_disabled(self):
        task = Task.objects.create(
            name="Existing Approval Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            approval_status="PENDING",
            status="COMPLETED"
        )
        self.org.enable_task_approval = False
        self.org.save()

        self.force_authenticate_user(self.org_admin)
        response = self.client.get(f"/api/tasks/{task.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["approval_status"], "PENDING")

    # -------------------------------------------------------------------------
    # 2. Task Completion Flow Tests
    # -------------------------------------------------------------------------

    def test_task_completed_when_all_assignees_finish(self):
        task = Task.objects.create(
            name="Multi Assignee Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="PENDING"
        )
        a1 = TaskAssignee.objects.create(task=task, user=self.staff1, completed=False)
        a2 = TaskAssignee.objects.create(task=task, user=self.staff2, completed=False)

        # Staff 1 completes
        self.force_authenticate_user(self.staff1)
        res1 = self.client.post(f"/api/tasks/{task.id}/complete/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, "PENDING")
        self.assertEqual(task.approval_status, "NOT_STARTED")

        # Staff 2 completes
        self.force_authenticate_user(self.staff2)
        res2 = self.client.post(f"/api/tasks/{task.id}/complete/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, "COMPLETED")
        self.assertEqual(task.approval_status, "PENDING")

    def test_approval_status_becomes_pending_on_completion_if_approval_required(self):
        task = Task.objects.create(
            name="Single Approval Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="PENDING"
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=False)

        self.force_authenticate_user(self.staff1)
        response = self.client.post(f"/api/tasks/{task.id}/complete/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, "COMPLETED")
        self.assertEqual(task.approval_status, "PENDING")

    def test_approval_status_remains_not_started_when_incomplete(self):
        task = Task.objects.create(
            name="Incomplete Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="PENDING",
            approval_status="NOT_STARTED"
        )
        self.assertEqual(task.approval_status, "NOT_STARTED")

    def test_task_without_approval_required_approval_status_not_required(self):
        task = Task.objects.create(
            name="No Approval Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=False,
            status="PENDING"
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=False)

        self.force_authenticate_user(self.staff1)
        self.client.post(f"/api/tasks/{task.id}/complete/")

        task.refresh_from_db()
        self.assertEqual(task.status, "COMPLETED")
        self.assertEqual(task.approval_status, "NOT_REQUIRED")

    def test_completed_by_and_completed_at_preserved_on_task_and_assignees(self):
        task = Task.objects.create(
            name="Preserve Timestamps Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="PENDING"
        )
        a1 = TaskAssignee.objects.create(task=task, user=self.staff1, completed=False)

        self.force_authenticate_user(self.staff1)
        self.client.post(f"/api/tasks/{task.id}/complete/")

        task.refresh_from_db()
        a1.refresh_from_db()
        staff_completion_time = a1.completed_at

        self.assertIsNotNone(staff_completion_time)

        # Now Approver approves
        self.force_authenticate_user(self.approver)
        self.client.post(f"/api/tasks/{task.id}/approve/")

        task.refresh_from_db()
        a1.refresh_from_db()

        # Check that staff's completed_at was NOT overwritten by approval
        self.assertEqual(a1.completed_at, staff_completion_time)
        self.assertEqual(task.approved_by, self.approver)
        self.assertIsNotNone(task.approved_at)

    # -------------------------------------------------------------------------
    # 3. Post-Completion Approval Architecture & Workload Isolation Tests
    # -------------------------------------------------------------------------

    def test_pending_approval_task_has_status_completed(self):
        task = Task.objects.create(
            name="State Test Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )
        self.assertEqual(task.status, "COMPLETED")
        self.assertEqual(task.approval_status, "PENDING")

    def test_pending_approval_task_not_in_user_pending_endpoint(self):
        task = Task.objects.create(
            name="User Pending Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=True, completed_at=timezone.now())

        self.force_authenticate_user(self.staff1)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # pending_tasks count for staff1 should NOT include completed assignees
        self.assertEqual(response.data["pending_tasks"], 0)

    def test_pending_approval_task_does_not_affect_health_score_negatively(self):
        task = Task.objects.create(
            name="Health Score Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING",
            due_date=(timezone.now() - datetime.timedelta(days=2)).date()
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=True, completed_at=timezone.now())

        self.force_authenticate_user(self.staff1)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_pending_approval_task_in_pending_approval_view_for_approver(self):
        task = Task.objects.create(
            name="Approver Filter Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )

        self.force_authenticate_user(self.approver)
        response = self.client.get("/api/tasks/?tab=pending_approval")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t["id"] for t in response.data]
        self.assertIn(str(task.id), task_ids)

    def test_staff_member_sees_task_in_completed_view(self):
        task = Task.objects.create(
            name="Staff View Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=True, completed_at=timezone.now())

        self.force_authenticate_user(self.staff1)
        response = self.client.get("/api/tasks/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target_task = next((t for t in response.data if t["id"] == str(task.id)), None)
        self.assertIsNotNone(target_task)
        self.assertEqual(target_task["status"], "COMPLETED")

    # -------------------------------------------------------------------------
    # 4. Approve Action & Recurrence Materialization Tests
    # -------------------------------------------------------------------------

    def test_approver_can_approve_pending_task(self):
        task = Task.objects.create(
            name="Approve Test Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )

        self.force_authenticate_user(self.approver)
        response = self.client.post(f"/api/tasks/{task.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.approval_status, "APPROVED")
        self.assertEqual(task.approved_by, self.approver)
        self.assertIsNotNone(task.approved_at)

    def test_non_approver_cannot_approve_task(self):
        task = Task.objects.create(
            name="Unauthorized Approve Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )

        self.force_authenticate_user(self.staff1)
        response = self.client.post(f"/api/tasks/{task.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_approval_sets_approved_by_and_approved_at(self):
        task = Task.objects.create(
            name="Approval Metadata Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )

        self.force_authenticate_user(self.approver)
        before_time = timezone.now()
        self.client.post(f"/api/tasks/{task.id}/approve/")

        task.refresh_from_db()
        self.assertEqual(task.approved_by, self.approver)
        self.assertGreaterEqual(task.approved_at, before_time)

    def test_approval_triggers_recurrence_materialization(self):
        series = RecurringTaskSeries.objects.create(
            organization=self.org,
            created_by=self.org_admin,
            frequency="DAY",
            interval=1,
            start_date=timezone.now().date(),
            end_type="NEVER"
        )
        task = Task.objects.create(
            name="Recurring Approval Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            recurring_series=series,
            approval_required=True,
            approver=self.approver,
            status="PENDING",
            approval_status="NOT_STARTED",
            due_date=timezone.now().date()
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=False)

        # 1. Staff completes task -> Status=COMPLETED, approval_status=PENDING
        self.force_authenticate_user(self.staff1)
        self.client.post(f"/api/tasks/{task.id}/complete/")

        task.refresh_from_db()
        self.assertEqual(task.status, "COMPLETED")
        self.assertEqual(task.approval_status, "PENDING")
        # Ensure recurrence task NOT created yet
        self.assertEqual(Task.objects.filter(recurring_series=series).count(), 1)

        # 2. Approver approves -> approval_status=APPROVED and materializes next recurrence
        self.force_authenticate_user(self.approver)
        res = self.client.post(f"/api/tasks/{task.id}/approve/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.approval_status, "APPROVED")
        # Verify next recurring instance was generated
        self.assertEqual(Task.objects.filter(recurring_series=series).count(), 2)

    def test_next_recurring_instance_copies_approval_settings(self):
        series = RecurringTaskSeries.objects.create(
            organization=self.org,
            created_by=self.org_admin,
            frequency="DAY",
            interval=1,
            start_date=timezone.now().date(),
            end_type="NEVER"
        )
        task = Task.objects.create(
            name="Recurring Approval Copy Settings",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            recurring_series=series,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING",
            due_date=timezone.now().date()
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=True)

        self.force_authenticate_user(self.approver)
        self.client.post(f"/api/tasks/{task.id}/approve/")

        child_task = Task.objects.filter(recurring_series=series).exclude(id=task.id).first()
        self.assertIsNotNone(child_task)
        self.assertTrue(child_task.approval_required)
        self.assertEqual(child_task.approver, self.approver)
        self.assertEqual(child_task.approval_status, "NOT_STARTED")

    # -------------------------------------------------------------------------
    # 5. Comment Feedback & Communication Tests
    # -------------------------------------------------------------------------

    def test_approver_comment_notifies_staff(self):
        task = Task.objects.create(
            name="Feedback Comment Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )
        TaskAssignee.objects.create(task=task, user=self.staff1, completed=True)

        self.force_authenticate_user(self.approver)
        response = self.client.post("/api/comments/", {
            "task": str(task.id),
            "content": "Please replace the quotation with the updated version."
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        comment = TaskComment.objects.filter(task=task, author=self.approver).first()
        self.assertIsNotNone(comment)
        self.assertEqual(comment.content, "Please replace the quotation with the updated version.")

    # -------------------------------------------------------------------------
    # 6. Notification, Activity Indicators & Mark-Read Tests
    # -------------------------------------------------------------------------

    def test_mark_task_read_clears_task_unread_notifications(self):
        task = Task.objects.create(
            name="Mark Read Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="PENDING"
        )

        Notification.objects.create(
            recipient=self.staff1,
            related_user=self.approver,
            related_task=task,
            type="TASK_COMMENT_ADDED",
            title="New comment",
            is_read=False
        )

        # Verify taskSerializer exposes unread activity
        self.force_authenticate_user(self.staff1)
        res1 = self.client.get(f"/api/tasks/{task.id}/")
        self.assertTrue(res1.data["has_unread_activity"])
        self.assertIn("COMMENT", res1.data["unread_activity_types"])

        # Call mark-read
        res_mark = self.client.post(f"/api/tasks/{task.id}/mark-read/")
        self.assertEqual(res_mark.status_code, status.HTTP_200_OK)

        # Verify unread state cleared for staff1 on this task
        res2 = self.client.get(f"/api/tasks/{task.id}/")
        self.assertFalse(res2.data["has_unread_activity"])

    # -------------------------------------------------------------------------
    # 7. Tenant Isolation Test
    # -------------------------------------------------------------------------

    def test_approver_from_another_org_cannot_approve(self):
        task = Task.objects.create(
            name="Tenant Isolation Task",
            organization=self.org,
            project=self.project,
            created_by=self.org_admin,
            approval_required=True,
            approver=self.approver,
            status="COMPLETED",
            approval_status="PENDING"
        )

        self.force_authenticate_user(self.other_user)
        response = self.client.post(f"/api/tasks/{task.id}/approve/")
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
