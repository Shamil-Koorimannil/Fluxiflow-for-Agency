from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date, time
from rest_framework.test import APITestCase
from rest_framework import status
from apps.tasks.models import Task, TaskAssignee, TaskAssignmentHistory
from apps.projects.models import Project
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
        task = Task.objects.create(
            name='Task Overdue',
            due_date=yesterday,
            due_time=time(12, 0, 0),
            project=self.project,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member1)
        
        # Today report should count it as overdue since deadline was yesterday and it's incomplete
        today = timezone.localdate()
        data = ReportGenerator.compile_report_data(today, today)
        self.assertEqual(data["summary"]["overdue"], 1)
        self.assertEqual(data["summary"]["pending"], 0)

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

        # Tuesday: task reassigned to John
        tuesday = date(2026, 8, 11)
        tue_start, tue_end = ReportGenerator.get_day_boundaries(tuesday)
        
        # Delete Sarah's assignee record
        a.delete() # Signal receiver sets unassigned_at = Tuesday now (let's mock to Tuesday morning)
        TaskAssignmentHistory.objects.filter(task=task, user=self.member1, unassigned_at__isnull=True).update(unassigned_at=tue_start + timedelta(hours=1))

        # Assign to John
        TaskAssignee.objects.create(task=task, user=self.member2)
        TaskAssignmentHistory.objects.filter(task=task, user=self.member2).update(assigned_at=tue_start + timedelta(hours=2))

        # Monday report must show Sarah was assigned
        data_mon = ReportGenerator.compile_report_data(monday, monday)
        self.assertIn('Sarah Thomas', [t['member_name'] for t in data_mon['tasks']])
        self.assertNotIn('John Mathew', [t['member_name'] for t in data_mon['tasks']])

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
