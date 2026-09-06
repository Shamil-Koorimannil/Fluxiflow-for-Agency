from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date, time
from rest_framework.test import APITestCase
from rest_framework import status
from apps.tasks.models import Task, TaskAssignee, TaskAssignmentHistory
from apps.projects.models import Project
from apps.clients.models import Client
from apps.accounts.models import Organization
from apps.reports.services import ReportGenerator

User = get_user_model()

class ReportBackendTests(APITestCase):
    def setUp(self):
        # Create users
        self.admin = User.objects.create_user(
            email='admin@example.com',
            name='Admin User',
            password='password123',
            role='ADMIN',
            status='ACTIVE'
        )
        self.member1 = User.objects.create_user(
            email='member1@example.com',
            name='Sarah Thomas',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        self.member2 = User.objects.create_user(
            email='member2@example.com',
            name='John Mathew',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )

        self.project = Project.objects.create(
            name="Alpha Project",
            created_by=self.admin
        )

    def test_daily_completed_and_pending_calculations(self):
        # Assign task to Sarah, created on Monday
        monday = date(2026, 8, 10)
        t_monday_start, t_monday_end = ReportGenerator.get_day_boundaries(monday)
        
        # Override created_at to Monday morning
        task = Task.objects.create(
            name='Task A',
            due_date=monday,
            project=self.project,
            created_by=self.admin
        )
        # Manually align created_at to Monday
        Task.objects.filter(id=task.id).update(created_at=t_monday_start + timedelta(hours=2))
        task.refresh_from_db()

        # Signal handles history creation automatically!
        assignee = TaskAssignee.objects.create(task=task, user=self.member1)
        # Correct history creation date to monday too
        TaskAssignmentHistory.objects.filter(task=task, user=self.member1).update(assigned_at=t_monday_start + timedelta(hours=2))

        # 1. Monday Report: Sarah has 0 completed, 1 pending
        data_monday = ReportGenerator.compile_report_data(monday, monday)
        self.assertEqual(data_monday["summary"]["completed"], 0)
        self.assertEqual(data_monday["summary"]["pending"], 1)

        # 2. Sarah completes it on Tuesday morning
        tuesday = date(2026, 8, 11)
        t_tuesday_start, _ = ReportGenerator.get_day_boundaries(tuesday)
        completion_time = t_tuesday_start + timedelta(hours=10) # Tuesday 10:00 AM
        
        assignee.completed = True
        assignee.completed_at = completion_time
        assignee.save() # Signal automatically propagates to history!

        # 3. Monday Report MUST STILL SHOW Completed = 0, Pending = 1 (Historical Accuracy check)
        data_monday_after = ReportGenerator.compile_report_data(monday, monday)
        self.assertEqual(data_monday_after["summary"]["completed"], 0)
        self.assertEqual(data_monday_after["summary"]["pending"], 1)

        # 4. Tuesday Report shows Completed = 1, Pending = 0
        data_tuesday = ReportGenerator.compile_report_data(tuesday, tuesday)
        self.assertEqual(data_tuesday["summary"]["completed"], 1)
        self.assertEqual(data_tuesday["summary"]["pending"], 0)

    def test_daily_overdue_calculation(self):
        # Create overdue task
        yesterday = timezone.localdate() - timedelta(days=1)
        yest_start, _ = ReportGenerator.get_day_boundaries(yesterday)
        task = Task.objects.create(
            name='Task Overdue',
            due_date=yesterday,
            due_time=time(12, 0, 0),
            project=self.project,
            created_by=self.admin
        )
        Task.objects.filter(id=task.id).update(created_at=yest_start + timedelta(hours=1))
        TaskAssignee.objects.create(task=task, user=self.member1)
        TaskAssignmentHistory.objects.filter(task=task, user=self.member1).update(assigned_at=yest_start + timedelta(hours=1))
        
        # Yesterday report counts it as pending/overdue for yesterday's report
        data_yest = ReportGenerator.compile_report_data(yesterday, yesterday)
        self.assertEqual(data_yest["summary"]["pending"] + data_yest["summary"]["overdue"], 1)

        # Today report excludes yesterday's task under strict day date filtering
        today = timezone.localdate()
        data_today = ReportGenerator.compile_report_data(today, today)
        self.assertEqual(len(data_today["tasks"]), 0)

    def test_multi_assignee_task_reporting(self):
        # Task assigned to both Sarah and John
        today = timezone.localdate()
        task = Task.objects.create(
            name='Homepage Design',
            due_date=today,
            project=self.project,
            created_by=self.admin
        )
        a1 = TaskAssignee.objects.create(task=task, user=self.member1) # Sarah
        a2 = TaskAssignee.objects.create(task=task, user=self.member2) # John

        # Sarah completes it today
        _, day_end = ReportGenerator.get_day_boundaries(today)
        completion_time = day_end - timedelta(hours=3) # Today afternoon
        a1.completed = True
        a1.completed_at = completion_time
        a1.save()

        # Compile report
        data = ReportGenerator.compile_report_data(today, today)
        
        # Sarah Thomas stats
        sarah_stats = next(m for m in data["member_reports"] if m["name"] == "Sarah Thomas")
        self.assertEqual(sarah_stats["completed"], 1)
        self.assertEqual(sarah_stats["pending"], 0)

        # John Mathew stats (still pending!)
        john_stats = next(m for m in data["member_reports"] if m["name"] == "John Mathew")
        self.assertEqual(john_stats["completed"], 0)
        self.assertEqual(john_stats["pending"], 1)

    def test_reassigned_tasks_preserve_historical_ownership(self):
        # Monday: task assigned to Sarah
        monday = date(2026, 8, 10)
        mon_start, mon_end = ReportGenerator.get_day_boundaries(monday)
        
        task = Task.objects.create(
            name='Audit Log',
            due_date=monday,
            project=self.project,
            created_by=self.admin
        )
        Task.objects.filter(id=task.id).update(created_at=mon_start + timedelta(hours=1))
        task.refresh_from_db()
        
        a = TaskAssignee.objects.create(task=task, user=self.member1)
        TaskAssignmentHistory.objects.filter(task=task, user=self.member1).update(assigned_at=mon_start + timedelta(hours=1))

        # Monday report shows Sarah was assigned
        data_mon = ReportGenerator.compile_report_data(monday, monday)
        self.assertIn('Sarah Thomas', [t['member_name'] for t in data_mon['tasks']])
        self.assertNotIn('John Mathew', [t['member_name'] for t in data_mon['tasks']])

        # Tuesday: task reassigned to John with Tuesday due date
        tuesday = date(2026, 8, 11)
        tue_start, tue_end = ReportGenerator.get_day_boundaries(tuesday)
        
        # Delete Sarah's assignee record
        a.delete()
        TaskAssignmentHistory.objects.filter(task=task, user=self.member1, unassigned_at__isnull=True).update(unassigned_at=tue_start + timedelta(hours=1))

        # Update task due date to Tuesday for John's assignment
        Task.objects.filter(id=task.id).update(due_date=tuesday)
        TaskAssignee.objects.create(task=task, user=self.member2)
        TaskAssignmentHistory.objects.filter(task=task, user=self.member2).update(assigned_at=tue_start + timedelta(hours=2))

        # Tuesday report shows John is assigned
        data_tue = ReportGenerator.compile_report_data(tuesday, tuesday)
        self.assertIn('John Mathew', [t['member_name'] for t in data_tue['tasks']])

    def test_deactivated_member_historical_reporting(self):
        monday = date(2026, 8, 10)
        mon_start, _ = ReportGenerator.get_day_boundaries(monday)
        
        # Sarah is assigned a task on Monday
        task = Task.objects.create(name='Mock Task', due_date=monday, project=self.project, created_by=self.admin)
        Task.objects.filter(id=task.id).update(created_at=mon_start + timedelta(hours=1))
        TaskAssignee.objects.create(task=task, user=self.member1)
        TaskAssignmentHistory.objects.filter(task=task, user=self.member1).update(assigned_at=mon_start + timedelta(hours=1))

        # Tuesday: Sarah is deactivated
        tuesday = date(2026, 8, 11)
        tue_start, _ = ReportGenerator.get_day_boundaries(tuesday)
        
        self.member1.is_active = False
        self.member1.status = 'INACTIVE'
        self.member1.deactivated_at = tue_start + timedelta(hours=5)
        self.member1.save()

        # Monday report should still show Sarah because she was active on Monday!
        data_mon = ReportGenerator.compile_report_data(monday, monday, include_deactivated=False)
        self.assertIn('Sarah Thomas', [m['name'] for m in data_mon['member_reports']])

        # Wednesday report (Sarah is inactive) should exclude her if include_deactivated=False
        wednesday = date(2026, 8, 12)
        data_wed = ReportGenerator.compile_report_data(wednesday, wednesday, include_deactivated=False)
        self.assertNotIn('Sarah Thomas', [m['name'] for m in data_wed['member_reports']])

        # But include her if include_deactivated=True
        data_wed_incl = ReportGenerator.compile_report_data(wednesday, wednesday, include_deactivated=True)
        self.assertIn('Sarah Thomas', [m['name'] for m in data_wed_incl['member_reports']])

    def test_export_formats_generated(self):
        today = timezone.localdate()
        
        # Excel
        excel_file = ReportGenerator.export_excel(today, today)
        self.assertIsNotNone(excel_file.read())

        # CSV
        csv_data = ReportGenerator.export_csv(today, today)
        self.assertIn(b"Project", csv_data)

        # PDF
        pdf_file = ReportGenerator.export_pdf(today, today)
        self.assertIsNotNone(pdf_file.read())

    def test_unassigned_tasks_are_not_attributed(self):
        # Task created but unassigned
        today = timezone.localdate()
        Task.objects.create(
            name='Floating item',
            due_date=today,
            project=self.project,
            created_by=self.admin
        )

        data = ReportGenerator.compile_report_data(today, today)
        # The list of task details in reports should only contain assigned items
        self.assertEqual(len(data["tasks"]), 0)

    def test_permissions_are_enforced(self):
        self.client.force_authenticate(user=self.member1)
        
        # Member accessing daily endpoint gets 403 Forbidden
        url = '/api/reports/daily/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin gets success 200 OK
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_today_date_filtering_excludes_future_tasks(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        next_week = today + timedelta(days=7)

        # Task 1: Due Today
        task_today = Task.objects.create(
            name='Task Due Today',
            due_date=today,
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task_today, user=self.member1)

        # Task 2: Completed Yesterday
        task_yesterday = Task.objects.create(
            name='Task Completed Yesterday',
            due_date=yesterday,
            project=self.project,
            created_by=self.admin
        )
        yest_start, _ = ReportGenerator.get_day_boundaries(yesterday)
        Task.objects.filter(id=task_yesterday.id).update(created_at=yest_start + timedelta(hours=2))
        assignee_yest = TaskAssignee.objects.create(task=task_yesterday, user=self.member1)
        assignee_yest.completed = True
        assignee_yest.completed_at = yest_start + timedelta(hours=5)
        assignee_yest.save()
        TaskAssignmentHistory.objects.filter(task=task_yesterday, user=self.member1).update(
            assigned_at=yest_start + timedelta(hours=2),
            completed_at=yest_start + timedelta(hours=5),
            completed=True
        )

        # Task 3: Due Next Week (Future task, incomplete)
        task_next_week = Task.objects.create(
            name='Task Due Next Week',
            due_date=next_week,
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task_next_week, user=self.member1)

        # Compile Today's report
        data_today = ReportGenerator.compile_report_data(today, today)
        today_task_names = [t['task_name'] for t in data_today['tasks']]

        self.assertIn('Task Due Today', today_task_names)
        self.assertNotIn('Task Completed Yesterday', today_task_names)
        self.assertNotIn('Task Due Next Week', today_task_names)

    def test_client_id_filtering(self):
        today = timezone.localdate()
        client_a = Client.objects.create(name="Client Alpha", created_by=self.admin)
        client_b = Client.objects.create(name="Client Beta", created_by=self.admin)

        proj_a = Project.objects.create(name="Proj A", client=client_a, created_by=self.admin)
        proj_b = Project.objects.create(name="Proj B", client=client_b, created_by=self.admin)

        task_a = Task.objects.create(name="Client A Task", due_date=today, project=proj_a, created_by=self.admin)
        task_b = Task.objects.create(name="Client B Task", due_date=today, project=proj_b, created_by=self.admin)

        TaskAssignee.objects.create(task=task_a, user=self.member1)
        TaskAssignee.objects.create(task=task_b, user=self.member1)

        # Filter by Client A
        data_client_a = ReportGenerator.compile_report_data(today, today, client_id=str(client_a.id))
        task_names = [t['task_name'] for t in data_client_a['tasks']]
        self.assertIn('Client A Task', task_names)
        self.assertNotIn('Client B Task', task_names)

    def test_organization_multi_tenant_isolation(self):
        today = timezone.localdate()
        org1 = Organization.objects.create(name="Org One", slug="org-one")
        org2 = Organization.objects.create(name="Org Two", slug="org-two")

        from apps.accounts.models import Membership
        Membership.objects.create(organization=org1, user=self.member1)
        Membership.objects.create(organization=org2, user=self.member1)

        proj_org1 = Project.objects.create(name="Org1 Proj", organization=org1, created_by=self.admin)
        proj_org2 = Project.objects.create(name="Org2 Proj", organization=org2, created_by=self.admin)

        task_org1 = Task.objects.create(name="Org1 Task", due_date=today, project=proj_org1, organization=org1, created_by=self.admin)
        task_org2 = Task.objects.create(name="Org2 Task", due_date=today, project=proj_org2, organization=org2, created_by=self.admin)

        TaskAssignee.objects.create(task=task_org1, user=self.member1)
        TaskAssignee.objects.create(task=task_org2, user=self.member1)

        # Compile for Org 1
        data_org1 = ReportGenerator.compile_report_data(today, today, organization=org1)
        org1_tasks = [t['task_name'] for t in data_org1['tasks']]
        self.assertIn('Org1 Task', org1_tasks)
        self.assertNotIn('Org2 Task', org1_tasks)

    def test_date_filtering_exact_multi_date_matrix(self):
        # Section 15 requirements:
        # 30 Aug -> Task A
        # 31 Aug -> Task B
        # 01 Sep -> Task C
        # 05 Sep -> Task D
        # 06 Sep -> Task E
        # 07 Sep -> Task F
        # 15 Sep -> Task G
        # 16 Sep -> Task H

        client_x = Client.objects.create(name="Client X", created_by=self.admin)
        proj_x = Project.objects.create(name="Project X", client=client_x, created_by=self.admin)

        dates_tasks = [
            (date(2026, 8, 30), 'Task A'),
            (date(2026, 8, 31), 'Task B'),
            (date(2026, 9, 1), 'Task C'),
            (date(2026, 9, 5), 'Task D'),
            (date(2026, 9, 6), 'Task E'),
            (date(2026, 9, 7), 'Task F'),
            (date(2026, 9, 15), 'Task G'),
            (date(2026, 9, 16), 'Task H'),
        ]

        for dt, task_name in dates_tasks:
            t_start, _ = ReportGenerator.get_day_boundaries(dt)
            t = Task.objects.create(
                name=task_name,
                due_date=dt,
                project=proj_x,
                created_by=self.admin
            )
            Task.objects.filter(id=t.id).update(created_at=t_start + timedelta(hours=1))
            assignee = TaskAssignee.objects.create(task=t, user=self.member1)
            # Mark Task E as completed on 06 Sep to test completed status filter
            if task_name == 'Task E':
                assignee.completed = True
                assignee.completed_at = t_start + timedelta(hours=4)
                assignee.save()
                TaskAssignmentHistory.objects.filter(task=t, user=self.member1).update(
                    assigned_at=t_start + timedelta(hours=1),
                    completed_at=t_start + timedelta(hours=4),
                    completed=True
                )
            else:
                TaskAssignmentHistory.objects.filter(task=t, user=self.member1).update(
                    assigned_at=t_start + timedelta(hours=1)
                )

        # 1. 06 Sep -> E ONLY
        d_06sep = ReportGenerator.compile_report_data(date(2026, 9, 6), date(2026, 9, 6))
        names_06sep = [t['task_name'] for t in d_06sep['tasks']]
        self.assertEqual(names_06sep, ['Task E'])

        # 2. 05 Sep -> D ONLY
        d_05sep = ReportGenerator.compile_report_data(date(2026, 9, 5), date(2026, 9, 5))
        names_05sep = [t['task_name'] for t in d_05sep['tasks']]
        self.assertEqual(names_05sep, ['Task D'])

        # 3. 01 Sep -> 15 Sep -> C, D, E, F, G
        d_range = ReportGenerator.compile_report_data(date(2026, 9, 1), date(2026, 9, 15))
        names_range = set(t['task_name'] for t in d_range['tasks'])
        self.assertEqual(names_range, {'Task C', 'Task D', 'Task E', 'Task F', 'Task G'})

        # 4. September 2026 -> C, D, E, F, G, H
        d_sep = ReportGenerator.compile_report_data(date(2026, 9, 1), date(2026, 9, 30))
        names_sep = set(t['task_name'] for t in d_sep['tasks'])
        self.assertEqual(names_sep, {'Task C', 'Task D', 'Task E', 'Task F', 'Task G', 'Task H'})

        # 5. August 2026 -> A, B
        d_aug = ReportGenerator.compile_report_data(date(2026, 8, 1), date(2026, 8, 31))
        names_aug = set(t['task_name'] for t in d_aug['tasks'])
        self.assertEqual(names_aug, {'Task A', 'Task B'})

        # 6. Combination: Date (Sept 2026) + Client X + Project X + Status (completed) + Search ("Task E")
        d_combo = ReportGenerator.compile_report_data(
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            client_id=str(client_x.id),
            project_id=str(proj_x.id),
            status_filter='completed',
            search_query='Task E'
        )
        names_combo = [t['task_name'] for t in d_combo['tasks']]
        self.assertEqual(names_combo, ['Task E'])


