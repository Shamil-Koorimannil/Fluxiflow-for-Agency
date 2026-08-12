from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

class NotificationService:
    @staticmethod
    def create_notification(recipient, notification_type, title, message, related_task=None, related_project=None, related_user=None):
        # Only create if recipient is active
        if not recipient.is_active or recipient.status == 'INACTIVE':
            return None

        # Duplicate check criteria for time-based alerts:
        # Generate at most one of TASK_DUE_TODAY, TASK_DUE_SOON, or TASK_OVERDUE in any 24h window
        if notification_type in ['TASK_DUE_TODAY', 'TASK_DUE_SOON', 'TASK_OVERDUE']:
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            exists = Notification.objects.filter(
                recipient=recipient,
                type=notification_type,
                related_task=related_task,
                created_at__gte=today_start
            ).exists()
            if exists:
                return None

        # Create and save notification
        notification = Notification.objects.create(
            recipient=recipient,
            type=notification_type,
            title=title,
            message=message,
            related_task=related_task,
            related_project=related_project,
            related_user=related_user
        )
        return notification

    @staticmethod
    def notify_admins(notification_type, title, message, related_task=None, related_project=None, related_user=None):
        admins = User.objects.filter(role='ADMIN', is_active=True)
        notifications = []
        for admin in admins:
            notif = NotificationService.create_notification(
                recipient=admin,
                notification_type=notification_type,
                title=title,
                message=message,
                related_task=related_task,
                related_project=related_project,
                related_user=related_user
            )
            if notif:
                notifications.append(notif)
        return notifications

    @staticmethod
    def check_and_create_deadline_notifications(user):
        from apps.tasks.models import TaskAssignee, SubTaskAssignee
        from datetime import datetime, time, timedelta

        # Only check active users
        if not user.is_active or user.status == 'INACTIVE':
            return

        now = timezone.localtime(timezone.now())
        today = now.date()

        # Find incomplete task assignments for this user
        active_assignments = TaskAssignee.objects.filter(
            user=user,
            completed=False,
            task__status='PENDING'
        ).select_related('task', 'task__project')

        for assignment in active_assignments:
            task = assignment.task
            due_date = task.due_date
            due_time = task.due_time or time(23, 59, 59)
            
            # Combine due date and time
            due_dt = timezone.make_aware(
                datetime.combine(due_date, due_time),
                timezone.get_current_timezone()
            )
            due_dt = timezone.localtime(due_dt)

            # 1. TASK_OVERDUE: due_dt is in the past
            if due_dt < now:
                exists = Notification.objects.filter(
                    recipient=user,
                    type='TASK_OVERDUE',
                    related_task=task
                ).exists()
                if not exists:
                    NotificationService.create_notification(
                        recipient=user,
                        notification_type='TASK_OVERDUE',
                        title='Task Overdue',
                        message=f'"{task.name}" is overdue.',
                        related_task=task,
                        related_project=task.project
                    )

            # 2. TASK_DUE_TODAY: due_date is today, and not already completed/overdue (due_dt >= now)
            elif due_date == today:
                exists = Notification.objects.filter(
                    recipient=user,
                    type='TASK_DUE_TODAY',
                    related_task=task,
                    created_at__date=today
                ).exists()
                if not exists:
                    NotificationService.create_notification(
                        recipient=user,
                        notification_type='TASK_DUE_TODAY',
                        title='Task Due Today',
                        message=f'"{task.name}" is due today.',
                        related_task=task,
                        related_project=task.project
                    )

            # 3. TASK_DUE_SOON: approaching deadline (e.g. within 24 hours, but not today)
            elif now < due_dt <= now + timedelta(hours=24):
                # Check if we already notified about due soon in the last 24 hours for this task
                exists = Notification.objects.filter(
                    recipient=user,
                    type='TASK_DUE_SOON',
                    related_task=task,
                    created_at__gte=now - timedelta(hours=24)
                ).exists()
                if not exists:
                    due_time_str = due_dt.strftime('%I:%M %p').lstrip('0')
                    NotificationService.create_notification(
                        recipient=user,
                        notification_type='TASK_DUE_SOON',
                        title='Task Due Soon',
                        message=f'"{task.name}" is due tomorrow at {due_time_str}.' if due_date == today + timedelta(days=1) else f'"{task.name}" is due soon.',
                        related_task=task,
                        related_project=task.project
                    )

        # Find incomplete subtask assignments for this user
        active_subtask_assignments = SubTaskAssignee.objects.filter(
            user=user,
            completed=False,
            subtask__status='PENDING'
        ).select_related('subtask', 'subtask__task', 'subtask__task__project')

        for sa in active_subtask_assignments:
            subtask = sa.subtask
            if not subtask.due_date:
                continue
            due_date = subtask.due_date
            due_time = subtask.due_time or time(23, 59, 59)
            
            due_dt = timezone.make_aware(
                datetime.combine(due_date, due_time),
                timezone.get_current_timezone()
            )
            due_dt = timezone.localtime(due_dt)

            if due_dt < now:
                exists = Notification.objects.filter(
                    recipient=user,
                    type='TASK_OVERDUE',
                    related_task=subtask.task
                ).filter(message__icontains=subtask.name).exists()
                if not exists:
                    NotificationService.create_notification(
                        recipient=user,
                        notification_type='TASK_OVERDUE',
                        title='Subtask Overdue',
                        message=f'Subtask "{subtask.name}" is overdue.',
                        related_task=subtask.task,
                        related_project=subtask.task.project
                    )
            elif due_date == today:
                exists = Notification.objects.filter(
                    recipient=user,
                    type='TASK_DUE_TODAY',
                    related_task=subtask.task,
                    created_at__date=today
                ).filter(message__icontains=subtask.name).exists()
                if not exists:
                    NotificationService.create_notification(
                        recipient=user,
                        notification_type='TASK_DUE_TODAY',
                        title='Subtask Due Today',
                        message=f'Subtask "{subtask.name}" is due today.',
                        related_task=subtask.task,
                        related_project=subtask.task.project
                    )
            elif now < due_dt <= now + timedelta(hours=24):
                exists = Notification.objects.filter(
                    recipient=user,
                    type='TASK_DUE_SOON',
                    related_task=subtask.task,
                    created_at__gte=now - timedelta(hours=24)
                ).filter(message__icontains=subtask.name).exists()
                if not exists:
                    due_time_str = due_dt.strftime('%I:%M %p').lstrip('0')
                    NotificationService.create_notification(
                        recipient=user,
                        notification_type='TASK_DUE_SOON',
                        title='Subtask Due Soon',
                        message=f'Subtask "{subtask.name}" is due tomorrow at {due_time_str}.' if due_date == today + timedelta(days=1) else f'Subtask "{subtask.name}" is due soon.',
                        related_task=subtask.task,
                        related_project=subtask.task.project
                    )

    @staticmethod
    def handle_task_assignment_notifications(task, previous_assignees, current_assignees, actor):
        prev_ids = {u.id for u in previous_assignees}
        curr_ids = {u.id for u in current_assignees}

        added = [u for u in current_assignees if u.id not in prev_ids]
        removed = [u for u in previous_assignees if u.id not in curr_ids]

        is_reassignment = len(added) > 0 and len(removed) > 0

        # 1. Added assignees
        for user in added:
            notification_type = 'TASK_REASSIGNED' if is_reassignment else 'TASK_ASSIGNED'
            title = 'Task Reassigned' if is_reassignment else 'Task Assigned'
            message = f'"{task.name}" was assigned to you.'
            NotificationService.create_notification(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                related_task=task,
                related_project=task.project,
                related_user=actor
            )

        # 2. Removed assignees
        for user in removed:
            notification_type = 'TASK_REASSIGNED' if is_reassignment else 'TASK_UNASSIGNED'
            title = 'Task Reassigned' if is_reassignment else 'Task Unassigned'
            message = f'You are no longer assigned to {task.name}.'
            NotificationService.create_notification(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                related_task=task,
                related_project=task.project,
                related_user=actor
            )

    @staticmethod
    def handle_subtask_assignment_notifications(subtask, previous_assignees, current_assignees, actor):
        prev_ids = {u.id for u in previous_assignees}
        curr_ids = {u.id for u in current_assignees}

        added = [u for u in current_assignees if u.id not in prev_ids]
        removed = [u for u in previous_assignees if u.id not in curr_ids]

        is_reassignment = len(added) > 0 and len(removed) > 0

        for user in added:
            notification_type = 'TASK_REASSIGNED' if is_reassignment else 'TASK_ASSIGNED'
            title = 'Subtask Reassigned' if is_reassignment else 'Subtask Assigned'
            message = f'"{subtask.name}" was assigned to you under task "{subtask.task.name}".'
            NotificationService.create_notification(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                related_task=subtask.task,
                related_project=subtask.task.project,
                related_user=actor
            )

        for user in removed:
            notification_type = 'TASK_REASSIGNED' if is_reassignment else 'TASK_UNASSIGNED'
            title = 'Subtask Reassigned' if is_reassignment else 'Subtask Unassigned'
            message = f'You are no longer assigned to subtask "{subtask.name}" under task "{subtask.task.name}".'
            NotificationService.create_notification(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                related_task=subtask.task,
                related_project=subtask.task.project,
                related_user=actor
            )
