from rest_framework import viewsets, permissions, status, exceptions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.http import FileResponse
from django.utils.text import get_valid_filename
from .models import Task, TaskAssignee, SubTask, SubTaskAssignee, TaskComment, TaskAttachment, TaskType, TaskTimeLog
from .serializers import TaskSerializer, SubTaskSerializer, TaskCommentSerializer, TaskAttachmentSerializer, TaskTypeSerializer, TaskTimeLogSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog
from apps.accounts.models import CustomUser as User

import logging
logger = logging.getLogger(__name__)

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Task.objects.none()
        
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        from django.db.models import Q
        active_org = get_active_organization(user, request=self.request)
        if not active_org:
            return Task.objects.none()

        project_id = self.request.query_params.get('project')
        status_param = self.request.query_params.get('status')
        status_not_param = self.request.query_params.get('status_not')
        tab_param = self.request.query_params.get('tab')
        
        base_qs = Task.objects.filter(organization=active_org)
        
        if self.action == 'list':
            if project_id:
                queryset = base_qs.filter(project_id=project_id)
            else:
                if is_admin_or_org_admin(user, request=self.request):
                    queryset = base_qs
                else:
                    queryset = base_qs.filter(assignee_relationships__user=user)
        else:
            if is_admin_or_org_admin(user, request=self.request):
                queryset = base_qs
            else:
                queryset = base_qs.filter(
                    Q(assignee_relationships__user=user) | Q(created_by=user)
                )

        if status_param:
            queryset = queryset.filter(status=status_param)
        if status_not_param:
            queryset = queryset.exclude(status=status_not_param)
        if tab_param == 'incompleted':
            queryset = queryset.exclude(status='COMPLETED')
        elif tab_param == 'no_due_date':
            queryset = queryset.filter(due_date__isnull=True)
        elif tab_param == 'completed':
            queryset = queryset.filter(status='COMPLETED')

        return queryset.distinct().order_by('due_date', 'due_time', 'created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        project_id = request.query_params.get('project')
        user = request.user
        
        # Serialize tasks
        serializer = self.get_serializer(queryset, many=True)
        data = list(serializer.data)
            
        # Append subtasks if it's the general list (no project filter) and user is a MEMBER
        from apps.accounts.tenant_context import is_admin_or_org_admin
        if not project_id and user.is_authenticated and not is_admin_or_org_admin(user, request=request):
            from apps.accounts.serializers import UserSerializer
            from apps.tasks.helpers import calculate_assignee_submission_status, calculate_submission_status
            
            subtasks = SubTask.objects.filter(assignee_relationships__user=user).select_related('task', 'task__project', 'task__created_by', 'completed_by')
            for subtask in subtasks:
                assignee_rel = subtask.assignee_relationships.filter(user=user).first()
                is_completed = assignee_rel.completed if assignee_rel else (subtask.status == 'COMPLETED')
                completed_at_val = assignee_rel.completed_at if assignee_rel else subtask.completed_at
                
                # Format date_display and date_color
                from apps.tasks.helpers import calculate_date_display_color
                due_date_str = subtask.due_date.isoformat() if subtask.due_date else subtask.task.due_date.isoformat()
                date_disp, date_col = calculate_date_display_color(
                    due_date_str, 
                    subtask.due_time,
                    is_completed,
                    completed_at_val
                )
                
                sub_status = 'PENDING'
                late_mins = 0
                if assignee_rel:
                    sub_status, late_mins = calculate_assignee_submission_status(
                        assignee_rel,
                        subtask.due_date or subtask.task.due_date,
                        subtask.due_time or subtask.task.due_time
                    )
                    
                pseudo_task = {
                    "id": f"subtask_{subtask.id}",
                    "is_subtask": True,
                    "parent_task_id": str(subtask.task.id),
                    "parent_task_name": subtask.task.name,
                    "parent_task_title": subtask.task.name,
                    "name": subtask.name,
                    "title": subtask.name,
                    "description": f"Subtask of: {subtask.task.name}",
                    "due_date": str(subtask.due_date) if subtask.due_date else str(subtask.task.due_date),
                    "due_time": str(subtask.due_time) if subtask.due_time else str(subtask.task.due_time),
                    "priority": subtask.task.priority,
                    "status": "COMPLETED" if is_completed else "PENDING",
                    "overall_status": "COMPLETED" if is_completed else "PENDING",
                    "created_at": subtask.created_at.isoformat(),
                    "updated_at": subtask.updated_at.isoformat(),
                    "created_by": str(subtask.task.created_by.id),
                    "created_by_detail": UserSerializer(subtask.task.created_by, context=self.get_serializer_context()).data,
                    "completed_by": str(subtask.completed_by.id) if subtask.completed_by else None,
                    "completed_by_detail": UserSerializer(subtask.completed_by, context=self.get_serializer_context()).data if subtask.completed_by else None,
                    "subtasks": [],
                    "project": str(subtask.task.project.id) if subtask.task.project else None,
                    "project_detail": {
                        "id": str(subtask.task.project.id),
                        "name": subtask.task.project.name
                    } if subtask.task.project else None,
                    "organization": str(subtask.task.organization.id) if subtask.task.organization else None,
                    "assignees": [
                        {
                            **UserSerializer(u.user, context=self.get_serializer_context()).data,
                            "completed": u.completed,
                            "completed_at": u.completed_at.isoformat() if u.completed_at else None,
                            "submission_status": calculate_assignee_submission_status(
                                u,
                                subtask.due_date or subtask.task.due_date,
                                subtask.due_time or subtask.task.due_time
                            )[0],
                            "late_by_minutes": calculate_assignee_submission_status(
                                u,
                                subtask.due_date or subtask.task.due_date,
                                u.subtask.due_time or u.subtask.task.due_time
                            )[1]
                        }
                        for u in subtask.assignee_relationships.all()
                    ],
                    "date_display": date_disp,
                    "date_color": date_col,
                    "submission_status": sub_status,
                    "late_by_minutes": late_mins,
                    "completed_at": completed_at_val.isoformat() if completed_at_val else None,
                }
                data.append(pseudo_task)

        # Paginate the combined memory list
        page = self.paginate_queryset(data)
        if page is not None:
            return self.get_paginated_response(page)
                
        return Response(data, status=status.HTTP_200_OK)

    def check_modify_permission(self, request, task=None):
        """Helper to ensure only Admins and Org Admins can create/edit/delete tasks."""
        from apps.accounts.tenant_context import is_admin_or_org_admin
        return is_admin_or_org_admin(request.user, request=request)

    def create(self, request, *args, **kwargs):
        if not self.check_modify_permission(request):
            return Response({"detail": "Only Admins can create tasks."}, status=status.HTTP_403_FORBIDDEN)
        
        dates = request.data.get('dates')
        unique_dates = []
        if isinstance(dates, list):
            for d in dates:
                if d and d not in unique_dates:
                    unique_dates.append(d)

        if len(unique_dates) > 1:
            from django.db import transaction
            created_tasks = []
            with transaction.atomic():
                for d in unique_dates:
                    payload = request.data.copy()
                    payload['due_date'] = d
                    if 'dates' in payload:
                        del payload['dates']
                    serializer = self.get_serializer(data=payload)
                    serializer.is_valid(raise_exception=True)
                    task = serializer.save()
                    created_tasks.append(task)
                    
                    ActivityLog.objects.create(
                        user=request.user,
                        action='TASK_CREATED',
                        entity_type='Task',
                        entity_id=task.id,
                        description=f"{request.user.name} created task '{task.name}'."
                    )
                    assignees_names = ", ".join([rel.user.name for rel in task.assignee_relationships.all()])
                    if assignees_names:
                        ActivityLog.objects.create(
                            user=request.user,
                            action='TASK_ASSIGNED',
                            entity_type='Task',
                            entity_id=task.id,
                            description=f"{request.user.name} assigned task '{task.name}' to {assignees_names}."
                        )
            serialized_tasks = self.get_serializer(created_tasks, many=True)
            return Response(serialized_tasks.data, status=status.HTTP_201_CREATED)

        payload = request.data.copy()
        if len(unique_dates) == 1:
            payload['due_date'] = unique_dates[0]
        if 'dates' in payload:
            del payload['dates']

        serializer = self.get_serializer(data=payload)
        if serializer.is_valid():
            task = serializer.save()
            # Log activity for creation
            ActivityLog.objects.create(
                user=request.user,
                action='TASK_CREATED',
                entity_type='Task',
                entity_id=task.id,
                description=f"{request.user.name} created task '{task.name}'."
            )
            # Log activity for assignment if there are assignees
            assignees_names = ", ".join([rel.user.name for rel in task.assignee_relationships.all()])
            if assignees_names:
                ActivityLog.objects.create(
                    user=request.user,
                    action='TASK_ASSIGNED',
                    entity_type='Task',
                    entity_id=task.id,
                    description=f"{request.user.name} assigned task '{task.name}' to {assignees_names}."
                )
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        if not self.check_modify_permission(request):
            return Response({"detail": "Only Admins can modify tasks."}, status=status.HTTP_403_FORBIDDEN)
        
        task = self.get_object()
        serializer = self.get_serializer(task, data=request.data, partial=kwargs.get('partial', False))
        if serializer.is_valid():
            updated_task = serializer.save()
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                action='TASK_UPDATED',
                entity_type='Task',
                entity_id=updated_task.id,
                description=f"{request.user.name} updated details of task '{updated_task.name}'."
            )
            return Response(self.get_serializer(updated_task).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        if not self.check_modify_permission(request):
            return Response({"detail": "Only Admins can delete tasks."}, status=status.HTTP_403_FORBIDDEN)
        
        task = self.get_object()
        task_id = task.id
        task_name = task.name
        task.delete()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='TASK_DELETED',
            entity_type='Task',
            entity_id=task_id,
            description=f"{request.user.name} deleted task '{task_name}'."
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['delete', 'post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not self.check_modify_permission(request):
            return Response({"detail": "Only Admins can delete tasks."}, status=status.HTTP_403_FORBIDDEN)
        
        task_ids = request.data.get('task_ids', [])
        if not isinstance(task_ids, list) or not task_ids:
            return Response({"detail": "No task IDs provided for bulk deletion."}, status=status.HTTP_400_BAD_REQUEST)
        
        from apps.accounts.tenant_context import get_active_organization
        from django.db.models import Q
        from django.db import transaction

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response({"detail": "Active organization not found."}, status=status.HTTP_400_BAD_REQUEST)

        org_filter = Q(organization=active_org) | Q(organization__isnull=True)
        tasks_qs = Task.objects.filter(org_filter, id__in=task_ids)
        found_ids = set(str(tid) for tid in tasks_qs.values_list('id', flat=True))
        
        if len(found_ids) != len(set(str(tid) for tid in task_ids)):
            return Response(
                {"detail": "One or more selected tasks do not exist or belong to another organization."},
                status=status.HTTP_403_FORBIDDEN
            )

        task_list = list(tasks_qs)
        count = len(task_list)

        with transaction.atomic():
            tasks_qs.delete()
            for t in task_list:
                ActivityLog.objects.create(
                    user=request.user,
                    action='TASK_DELETED',
                    entity_type='Task',
                    entity_id=t.id,
                    description=f"{request.user.name} bulk deleted task '{t.name}'."
                )

        return Response({
            "detail": f"Successfully deleted {count} task(s).",
            "deleted_count": count,
            "deleted_ids": list(found_ids)
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['POST'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.refresh_from_db()
        user = request.user
        
        # Prevent completion if task has incomplete subtasks
        if task.subtasks.exclude(status='COMPLETED').exists():
            return Response(
                {"detail": "All subtasks must be completed before the task can be completed."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check permission: Admin/OrgAdmin, or Member assigned to the task
        from apps.accounts.tenant_context import is_admin_or_org_admin
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if not is_admin_or_org_admin(user, request=request) and not is_assigned:
            return Response({"detail": "You cannot complete a task that is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.notifications.services import NotificationService

        # Set user context for logging
        task._status_change_user = user

        # Freeze timer if currently running
        if task.timer_status == 'RUNNING' and task.timer_started_at:
            delta = (timezone.now() - task.timer_started_at).total_seconds()
            duration_secs = int(delta)
            task.elapsed_seconds += duration_secs
            task.timer_started_at = None
            TaskTimeLog.objects.create(
                task=task,
                user=user,
                started_at=task.timer_started_at or timezone.now(),
                paused_at=timezone.now(),
                duration_seconds=duration_secs
            )

        task.actual_duration_seconds = task.elapsed_seconds
        task.timer_status = 'COMPLETED'
        task.status = 'COMPLETED'
        task.completed_by = user
        task.completed_at = timezone.now()
        task.save(update_fields=['status', 'completed_by', 'completed_at', 'elapsed_seconds', 'timer_started_at', 'timer_status', 'actual_duration_seconds'])
        task.refresh_from_db()

        # Update all assignees to completed (synchronized metadata only)
        for assignee in task.assignee_relationships.all():
            assignee.completed = True
            assignee.completed_at = timezone.now()
            assignee.save()

        logger.info(f"Task {task.id}: PENDING -> COMPLETED via complete action by {user.email} at {timezone.now()}")

        # Notify admins that user completed task if they are assigned
        if is_assigned:
            NotificationService.notify_admins(
                notification_type='TASK_COMPLETED',
                title='Task Completed',
                message=f"{user.name} completed {task.name}.",
                related_task=task,
                related_project=task.project,
                related_user=user
            )

        # Notify admins that entire task is completed
        NotificationService.notify_admins(
            notification_type='TASK_COMPLETED',
            title='Task Completed',
            message=f"{task.name} has been completed.",
            related_task=task,
            related_project=task.project,
            related_user=user
        )
        
        # Log activity
        ActivityLog.objects.create(
            user=user,
            action='TASK_COMPLETED',
            entity_type='Task',
            entity_id=task.id,
            description=f"{user.name} completed task '{task.name}'."
        )
        
        task.refresh_from_db()
        serializer = self.get_serializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'], permission_classes=[permissions.IsAuthenticated])
    def duplicate(self, request, pk=None):
        from django.db import transaction
        from apps.accounts.tenant_context import get_active_organization

        try:
            task = self.get_object()
        except Exception:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        active_org = get_active_organization(request.user)
        if not active_org or (task.organization and task.organization != active_org):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            new_task = Task.objects.create(
                organization=active_org,
                project=task.project,
                task_type=task.task_type,
                name=f"{task.name} Copy",
                description=task.description or '',
                due_date=task.due_date,
                due_time=task.due_time,
                priority=task.priority,
                status='PENDING',
                allocated_seconds=task.allocated_seconds,
                elapsed_seconds=0,
                timer_started_at=None,
                timer_status='NOT_STARTED',
                actual_duration_seconds=None,
                created_by=request.user
            )

            org_member_ids = set(active_org.memberships.filter(is_active=True).values_list('user_id', flat=True))
            for assignee in task.assignee_relationships.all():
                if assignee.user_id in org_member_ids:
                    TaskAssignee.objects.create(
                        task=new_task,
                        user=assignee.user,
                        completed=False,
                        completed_at=None
                    )

            for subtask in task.subtasks.all():
                new_subtask = SubTask.objects.create(
                    task=new_task,
                    name=f"{subtask.name} Copy",
                    due_date=subtask.due_date,
                    due_time=subtask.due_time,
                    status='PENDING',
                    completed_by=None,
                    completed_at=None
                )
                for sub_assignee in subtask.assignee_relationships.all():
                    if sub_assignee.user_id in org_member_ids:
                        SubTaskAssignee.objects.create(
                            subtask=new_subtask,
                            user=sub_assignee.user,
                            completed=False,
                            completed_at=None
                        )

            ActivityLog.objects.create(
                user=request.user,
                action='TASK_CREATED',
                entity_type='Task',
                entity_id=new_task.id,
                description=f"{request.user.name} duplicated task '{task.name}' as '{new_task.name}'."
            )

        serializer = self.get_serializer(new_task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['POST'])
    def reopen(self, request, pk=None):
        task = self.get_object()
        task.refresh_from_db()
        user = request.user
        
        # Check permission: Admin/OrgAdmin, or Member assigned to the task
        from apps.accounts.tenant_context import is_admin_or_org_admin
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if not is_admin_or_org_admin(user, request=request) and not is_assigned:
            return Response({"detail": "You cannot reopen a task that is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.notifications.services import NotificationService

        # Set user context for logging
        task._status_change_user = user

        task.status = 'PENDING'
        task.completed_by = None
        task.completed_at = None
        task.timer_status = 'PAUSED'
        task.save(update_fields=['status', 'completed_by', 'completed_at', 'timer_status'])
        task.refresh_from_db()

        # Mark all assignee relationships as not completed (synchronized metadata only)
        for assignee in task.assignee_relationships.all():
            assignee.completed = False
            assignee.completed_at = None
            assignee.save()

        logger.info(f"Task {task.id}: COMPLETED -> PENDING via reopen action by {user.email} at {timezone.now()}")

        # Notify relevant assignees
        for assignee_rel in task.assignee_relationships.all():
            NotificationService.create_notification(
                recipient=assignee_rel.user,
                notification_type='TASK_REOPENED',
                title='Task Reopened',
                message=f'"{task.name}" was reopened.',
                related_task=task,
                related_project=task.project,
                related_user=user
            )
        
        # Log activity
        ActivityLog.objects.create(
            user=user,
            action='TASK_REOPENED',
            entity_type='Task',
            entity_id=task.id,
            description=f"{user.name} reopened task '{task.name}'."
        )
        
        task.refresh_from_db()
        serializer = self.get_serializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'], url_path='timer/start')
    def timer_start(self, request, pk=None):
        task = self.get_object()
        user = request.user

        from apps.accounts.tenant_context import is_admin_or_org_admin
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if not is_admin_or_org_admin(user, request=request) and not is_assigned:
            return Response({"detail": "You do not have permission to start this task timer."}, status=status.HTTP_403_FORBIDDEN)

        if not task.task_type:
            return Response({"detail": "Tasks without a Task Type cannot have timer sessions."}, status=status.HTTP_400_BAD_REQUEST)

        if task.status == 'COMPLETED':
            return Response({"detail": "Cannot start timer on a completed task. Reopen task first."}, status=status.HTTP_400_BAD_REQUEST)

        if task.timer_status != 'RUNNING':
            task.timer_status = 'RUNNING'
            task.timer_started_at = timezone.now()
            task.save(update_fields=['timer_status', 'timer_started_at'])

        task.refresh_from_db()
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=['POST'], url_path='timer/pause')
    def timer_pause(self, request, pk=None):
        task = self.get_object()
        user = request.user

        from apps.accounts.tenant_context import is_admin_or_org_admin
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if not is_admin_or_org_admin(user, request=request) and not is_assigned:
            return Response({"detail": "You do not have permission to pause this task timer."}, status=status.HTTP_403_FORBIDDEN)

        if task.timer_status == 'RUNNING' and task.timer_started_at:
            delta = (timezone.now() - task.timer_started_at).total_seconds()
            duration_secs = int(delta)
            task.elapsed_seconds += duration_secs
            started_at_val = task.timer_started_at
            task.timer_started_at = None
            task.timer_status = 'PAUSED'
            task.save(update_fields=['elapsed_seconds', 'timer_started_at', 'timer_status'])

            TaskTimeLog.objects.create(
                task=task,
                user=user,
                started_at=started_at_val,
                paused_at=timezone.now(),
                duration_seconds=duration_secs
            )

        task.refresh_from_db()
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=['POST'], url_path='timer/reset')
    def timer_reset(self, request, pk=None):
        task = self.get_object()
        user = request.user

        from apps.accounts.tenant_context import is_admin_or_org_admin
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if not is_admin_or_org_admin(user, request=request) and not is_assigned:
            return Response({"detail": "You do not have permission to reset this task timer."}, status=status.HTTP_403_FORBIDDEN)

        task.elapsed_seconds = 0
        task.timer_started_at = None
        task.timer_status = 'NOT_STARTED'
        task.save(update_fields=['elapsed_seconds', 'timer_started_at', 'timer_status'])

        task.refresh_from_db()
        return Response(self.get_serializer(task).data)

    @action(detail=False, methods=['GET'], url_path='workload')
    def team_workload(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response([])

        membership = user.memberships.first()
        if not membership:
            return Response([])

        org = membership.organization
        capacity_hours = org.weekly_capacity_hours or 40
        capacity_seconds = capacity_hours * 3600

        from apps.accounts.serializers import UserSerializer
        memberships = org.memberships.select_related('user').all()
        workload_data = []

        for m in memberships:
            member = m.user
            assigned_tasks = Task.objects.filter(assignee_relationships__user=member, organization=org).distinct()
            
            total_tasks_count = assigned_tasks.count()
            completed_tasks_count = assigned_tasks.filter(status='COMPLETED').count()
            active_tasks_count = total_tasks_count - completed_tasks_count

            total_allocated_seconds = 0
            completed_allocated_seconds = 0
            remaining_allocated_seconds = 0
            unestimated_task_count = 0
            total_tracked_seconds = 0

            for t in assigned_tasks:
                alloc = t.allocated_seconds or 0
                if not t.allocated_seconds:
                    unestimated_task_count += 1
                total_allocated_seconds += alloc
                
                # Calculate live elapsed seconds if running
                if t.timer_status == 'RUNNING' and t.timer_started_at:
                    t_elapsed = t.elapsed_seconds + int((timezone.now() - t.timer_started_at).total_seconds())
                elif t.status == 'COMPLETED' and t.actual_duration_seconds is not None:
                    t_elapsed = t.actual_duration_seconds
                else:
                    t_elapsed = t.elapsed_seconds or 0

                total_tracked_seconds += t_elapsed

                if t.status == 'COMPLETED':
                    completed_allocated_seconds += alloc
                else:
                    remaining_allocated_seconds += alloc

            percentage = round((total_allocated_seconds / capacity_seconds) * 100, 1) if capacity_seconds > 0 else 0

            if percentage < 70:
                workload_status = 'Underloaded'
            elif percentage <= 100:
                workload_status = 'Balanced'
            elif percentage <= 120:
                workload_status = 'High'
            else:
                workload_status = 'Overloaded'

            workload_data.append({
                'member_id': str(member.id),
                'user': UserSerializer(member).data,
                'total_tasks_count': total_tasks_count,
                'active_tasks_count': active_tasks_count,
                'completed_tasks_count': completed_tasks_count,
                'total_allocated_seconds': total_allocated_seconds,
                'completed_allocated_seconds': completed_allocated_seconds,
                'remaining_allocated_seconds': remaining_allocated_seconds,
                'total_tracked_seconds': total_tracked_seconds,
                'total_allocated_hours': round(total_allocated_seconds / 3600, 2),
                'completed_allocated_hours': round(completed_allocated_seconds / 3600, 2),
                'remaining_allocated_hours': round(remaining_allocated_seconds / 3600, 2),
                'total_tracked_hours': round(total_tracked_seconds / 3600, 2),
                'unestimated_task_count': unestimated_task_count,
                'capacity_hours': capacity_hours,
                'workload_percentage': percentage,
                'workload_status': workload_status,
            })

        return Response(workload_data)

    @action(detail=True, methods=['POST'])
    def subtasks(self, request, pk=None):
        task = self.get_object()
        user = request.user
        
        # Only Admins and Org Admins can create subtasks
        from apps.accounts.tenant_context import is_admin_or_org_admin
        if not is_admin_or_org_admin(user, request=request):
            return Response({"detail": "Only Admins and Organisation admins can create subtasks."}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = SubTaskSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            subtask = serializer.save(task=task)
            
            # Log activity
            ActivityLog.objects.create(
                user=user,
                action='SUBTASK_CREATED',
                entity_type='SubTask',
                entity_id=subtask.id,
                description=f"{user.name} created subtask '{subtask.name}' for task '{task.name}'."
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['POST'])
    def bulk_paste(self, request):
        user = request.user
        tasks_data = request.data.get('tasks', [])
        destination_project_id = request.data.get('destination_project_id')
        assignee_ids = request.data.get('assignee_ids', [])
        
        if not tasks_data:
            return Response({"detail": "No tasks provided to paste."}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.db import transaction
        from apps.projects.models import Project
        from rest_framework.exceptions import ValidationError
        
        project = None
        if destination_project_id:
            try:
                project = Project.objects.get(id=destination_project_id)
            except (Project.DoesNotExist, ValueError):
                return Response({"detail": "Destination project not found."}, status=status.HTTP_404_NOT_FOUND)
                
            from apps.accounts.models import Membership
            user_membership = Membership.objects.filter(user=user).first()
            if not user_membership or project.organization != user_membership.organization:
                return Response({"detail": "You do not have permission to paste into this project."}, status=status.HTTP_403_FORBIDDEN)
        else:
            from apps.accounts.models import Membership
            user_membership = Membership.objects.filter(user=user).first()
            if not user_membership:
                return Response({"detail": "User has no organization membership."}, status=status.HTTP_403_FORBIDDEN)
                
        target_users = User.objects.filter(id__in=assignee_ids)
        created_tasks = []
        
        with transaction.atomic():
            for task_item in tasks_data:
                name = task_item.get('name')
                description = task_item.get('description', '')
                priority = task_item.get('priority', 'MEDIUM')
                due_date = task_item.get('due_date')
                due_time = task_item.get('due_time')
                
                if not name:
                    raise ValidationError("Task name is required.")
                    
                from apps.accounts.models import Membership
                user_membership = Membership.objects.filter(user=user).first()
                org = project.organization if project else (user_membership.organization if user_membership else None)
                
                new_task = Task.objects.create(
                    project=project,
                    organization=org,
                    name=name,
                    description=description,
                    priority=priority,
                    due_date=due_date or None,
                    due_time=due_time or None,
                    status='PENDING',
                    created_by=user,
                    completed_by=None,
                    completed_at=None
                )
                
                # Assignees
                for u in target_users:
                    TaskAssignee.objects.create(task=new_task, user=u, completed=False, completed_at=None)
                    
                # Subtasks
                subtasks_data = task_item.get('subtasks', [])
                for sub_item in subtasks_data:
                    sub_name = sub_item.get('name')
                    sub_due_date = sub_item.get('due_date')
                    sub_due_time = sub_item.get('due_time')
                    if sub_name:
                        new_sub = SubTask.objects.create(
                            task=new_task,
                            name=sub_name,
                            due_date=sub_due_date or None,
                            due_time=sub_due_time or None,
                            status='PENDING',
                            completed_by=None,
                            completed_at=None
                        )
                        for u in target_users:
                            SubTaskAssignee.objects.create(subtask=new_sub, user=u, completed=False, completed_at=None)
                
                ActivityLog.objects.create(
                    user=user,
                    action='TASK_CREATED',
                    entity_type='Task',
                    entity_id=new_task.id,
                    description=f"{user.name} created task '{new_task.name}' via paste."
                )
                created_tasks.append(new_task)
                
        serializer = self.get_serializer(created_tasks, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class SubTaskViewSet(viewsets.ModelViewSet):
    queryset = SubTask.objects.all()
    serializer_class = SubTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        # Only Admins can modify subtask info
        if request.user.role != 'ADMIN':
            return Response({"detail": "Only Admins can edit subtask details."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Only Admins can delete subtasks
        if request.user.role != 'ADMIN':
            return Response({"detail": "Only Admins can delete subtasks."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['POST'])
    def complete(self, request, pk=None):
        subtask = self.get_object()
        user = request.user
        
        # Check if user is assigned to this subtask
        is_assigned = SubTaskAssignee.objects.filter(subtask=subtask, user=user).exists()
        
        # Determine if Admin is completing a specific member's assignment
        target_user_id = request.data.get('user_id')
        if target_user_id and user.role != 'ADMIN':
            return Response({"detail": "You cannot complete subtasks for other users."}, status=status.HTTP_403_FORBIDDEN)
            
        if user.role == 'ADMIN' and target_user_id:
            try:
                target_user = User.objects.get(id=target_user_id)
                is_assigned = SubTaskAssignee.objects.filter(subtask=subtask, user=target_user).exists()
                if is_assigned:
                    user = target_user  # Complete for the target user
            except User.DoesNotExist:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot complete subtasks not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.notifications.services import NotificationService
        from apps.tasks.helpers import calculate_assignee_submission_status, format_notification_duration

        if is_assigned:
            assignee = SubTaskAssignee.objects.get(subtask=subtask, user=user)
            assignee.completed = True
            assignee.completed_at = timezone.now()
            assignee.save()
            
            sub_status, late_mins = calculate_assignee_submission_status(assignee, subtask.due_date, subtask.due_time)
            
            if sub_status == "LATE":
                duration_str = format_notification_duration(late_mins)
                NotificationService.create_notification(
                    recipient=user,
                    notification_type='TASK_COMPLETED_LATE',
                    title='Subtask Completed Late',
                    message=f'You completed subtask "{subtask.name}" under task "{subtask.task.name}" {duration_str} after its deadline.',
                    related_task=subtask.task,
                    related_project=subtask.task.project,
                    related_user=request.user
                )
                
                # Notify Admins about late submission
                NotificationService.notify_admins(
                    notification_type='TASK_COMPLETED_LATE',
                    title='Subtask Completed Late',
                    message=f'{user.name} completed subtask "{subtask.name}" under task "{subtask.task.name}" {duration_str} late.',
                    related_task=subtask.task,
                    related_project=subtask.task.project,
                    related_user=user
                )
            
            # Log assignee completion
            ActivityLog.objects.create(
                user=request.user,
                action='SUBTASK_COMPLETED',
                entity_type='SubTask',
                entity_id=subtask.id,
                description=f"{request.user.name} marked subtask '{subtask.name}' as completed for {user.name}." if request.user != user else f"{user.name} completed subtask '{subtask.name}'."
            )
            
            # Check if all assignees have completed
            incomplete_exists = SubTaskAssignee.objects.filter(subtask=subtask, completed=False).exists()
            if not incomplete_exists:
                subtask._status_change_user = request.user
                subtask.status = 'COMPLETED'
                subtask.completed_by = request.user
                subtask.completed_at = timezone.now()
                subtask.save()
        else:
            # Admin completing the subtask globally
            # When completing globally, mark all assignees completed
            assignees = SubTaskAssignee.objects.filter(subtask=subtask)
            for assignee in assignees:
                if not assignee.completed:
                    assignee.completed = True
                    assignee.completed_at = timezone.now()
                    assignee.save()
                    
            subtask._status_change_user = request.user
            subtask.status = 'COMPLETED'
            subtask.completed_by = request.user
            subtask.completed_at = timezone.now()
            subtask.save()
            
            ActivityLog.objects.create(
                user=request.user,
                action='SUBTASK_COMPLETED',
                entity_type='SubTask',
                entity_id=subtask.id,
                description=f"{request.user.name} completed subtask '{subtask.name}' globally."
            )
            
        serializer = self.get_serializer(subtask)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'])
    def reopen(self, request, pk=None):
        subtask = self.get_object()
        user = request.user
        
        # Check if user is assigned to this subtask
        is_assigned = SubTaskAssignee.objects.filter(subtask=subtask, user=user).exists()
        
        # Determine if Admin is reopening a specific member's assignment
        target_user_id = request.data.get('user_id')
        if target_user_id and user.role != 'ADMIN':
            return Response({"detail": "You cannot reopen subtasks for other users."}, status=status.HTTP_403_FORBIDDEN)
            
        if user.role == 'ADMIN' and target_user_id:
            try:
                target_user = User.objects.get(id=target_user_id)
                is_assigned = SubTaskAssignee.objects.filter(subtask=subtask, user=target_user).exists()
                if is_assigned:
                    user = target_user
            except User.DoesNotExist:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot reopen subtasks not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        if is_assigned:
            assignee = SubTaskAssignee.objects.get(subtask=subtask, user=user)
            assignee.completed = False
            assignee.completed_at = None
            assignee.save()
            
            ActivityLog.objects.create(
                user=request.user,
                action='SUBTASK_REOPENED',
                entity_type='SubTask',
                entity_id=subtask.id,
                description=f"{request.user.name} reopened subtask '{subtask.name}' for {user.name}." if request.user != user else f"{user.name} reopened subtask '{subtask.name}'."
            )
        else:
            # Admin reopening globally: mark all assignees as incomplete
            assignees = SubTaskAssignee.objects.filter(subtask=subtask)
            for assignee in assignees:
                assignee.completed = False
                assignee.completed_at = None
                assignee.save()
                
            ActivityLog.objects.create(
                user=request.user,
                action='SUBTASK_REOPENED',
                entity_type='SubTask',
                entity_id=subtask.id,
                description=f"{request.user.name} reopened subtask '{subtask.name}' globally."
            )

        # In both cases, overall subtask becomes PENDING
        subtask._status_change_user = request.user
        subtask.status = 'PENDING'
        subtask.completed_by = None
        subtask.completed_at = None
        subtask.save()
        
        serializer = self.get_serializer(subtask)
        return Response(serializer.data)


def user_has_task_access(user, task):
    if not user or not user.is_authenticated:
        return False
    from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
    active_org = get_active_organization(user)
    if not active_org:
        return False
    if task.organization_id and task.organization_id != active_org.id:
        return False
    if is_admin_or_org_admin(user):
        return True
    if task.created_by_id == user.id:
        return True
    if task.assignee_relationships.filter(user_id=user.id).exists():
        return True
    if task.project and task.project.organization_id == active_org.id:
        return True
    return False


class TaskCommentViewSet(viewsets.ModelViewSet):
    serializer_class = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return TaskComment.objects.none()

        task_id = self.request.query_params.get('task')
        subtask_id = self.request.query_params.get('subtask')

        if subtask_id:
            try:
                subtask = SubTask.objects.select_related('task').get(id=subtask_id)
                if not user_has_task_access(user, subtask.task):
                    return TaskComment.objects.none()
                return TaskComment.objects.filter(subtask_id=subtask_id).select_related('author')
            except (SubTask.DoesNotExist, ValueError):
                return TaskComment.objects.none()
        elif task_id:
            try:
                task = Task.objects.get(id=task_id)
                if not user_has_task_access(user, task):
                    return TaskComment.objects.none()
                return TaskComment.objects.filter(task_id=task_id, subtask__isnull=True).select_related('author')
            except (Task.DoesNotExist, ValueError):
                return TaskComment.objects.none()

        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user, request=self.request)
        if not active_org:
            return TaskComment.objects.none()

        if user.role == 'ADMIN':
            return TaskComment.objects.filter(task__organization=active_org).select_related('author', 'task')
        from django.db.models import Q
        return TaskComment.objects.filter(
            task__organization=active_org
        ).filter(
            Q(author=user) | Q(task__created_by=user) | Q(task__assignee_relationships__user=user) | Q(task__project__isnull=False)
        ).distinct().select_related('author', 'task')



    def create(self, request, *args, **kwargs):
        task_id = request.data.get('task')
        subtask_id = request.data.get('subtask')

        if subtask_id:
            try:
                subtask = SubTask.objects.select_related('task').get(id=subtask_id)
                task = subtask.task
                if task_id and str(task.id) != str(task_id):
                    return Response({"detail": "Subtask does not belong to the specified task."}, status=status.HTTP_400_BAD_REQUEST)
            except (SubTask.DoesNotExist, ValueError):
                return Response({"detail": "Subtask not found."}, status=status.HTTP_400_BAD_REQUEST)
        elif task_id:
            try:
                task = Task.objects.get(id=task_id)
            except (Task.DoesNotExist, ValueError):
                return Response({"detail": "Task not found."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "Task or subtask is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not user_has_task_access(request.user, task):
            return Response({"detail": "You do not have permission to comment on this task."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user, task=task)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.author != request.user and request.user.role != 'ADMIN':
            return Response({"detail": "You do not have permission to edit this comment."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.author != request.user and request.user.role != 'ADMIN':
            return Response({"detail": "You do not have permission to delete this comment."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class TaskAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp', 'svg', 'txt', 'zip'}
    EXECUTABLE_EXTENSIONS = {'exe', 'php', 'sh', 'py', 'js', 'html', 'htm', 'cgi', 'pl', 'bat', 'cmd', 'vbs', 'jsp', 'asp', 'aspx', 'jar'}
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return TaskAttachment.objects.none()

        task_id = self.request.query_params.get('task')
        subtask_id = self.request.query_params.get('subtask')

        if subtask_id:
            try:
                subtask = SubTask.objects.select_related('task').get(id=subtask_id)
                if not user_has_task_access(user, subtask.task):
                    return TaskAttachment.objects.none()
                return TaskAttachment.objects.filter(subtask_id=subtask_id).select_related('uploaded_by')
            except (SubTask.DoesNotExist, ValueError):
                return TaskAttachment.objects.none()
        elif task_id:
            try:
                task = Task.objects.get(id=task_id)
                if not user_has_task_access(user, task):
                    return TaskAttachment.objects.none()
                return TaskAttachment.objects.filter(task_id=task_id, subtask__isnull=True).select_related('uploaded_by')
            except (Task.DoesNotExist, ValueError):
                return TaskAttachment.objects.none()

        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user, request=self.request)
        if not active_org:
            return TaskAttachment.objects.none()

        if user.role == 'ADMIN':
            return TaskAttachment.objects.filter(task__organization=active_org).select_related('uploaded_by', 'task')
        from django.db.models import Q
        return TaskAttachment.objects.filter(
            task__organization=active_org
        ).filter(
            Q(uploaded_by=user) | Q(task__created_by=user) | Q(task__assignee_relationships__user=user) | Q(task__project__isnull=False)
        ).distinct().select_related('uploaded_by', 'task')

    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"detail": "Unable to upload the file."}, status=status.HTTP_400_BAD_REQUEST)

        # File size check
        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response({"detail": "File is too large."}, status=status.HTTP_400_BAD_REQUEST)

        # File extension check
        raw_name = uploaded_file.name or ""
        ext = raw_name.rsplit('.', 1)[-1].lower() if '.' in raw_name else ""
        if ext in self.EXECUTABLE_EXTENSIONS or ext not in self.ALLOWED_EXTENSIONS:
            return Response({"detail": "This file type is not supported."}, status=status.HTTP_400_BAD_REQUEST)

        # Sanitize filename
        clean_filename = get_valid_filename(raw_name) or f"file_{timezone.now().timestamp()}"

        task_id = request.data.get('task')
        subtask_id = request.data.get('subtask')

        subtask_obj = None
        if subtask_id:
            try:
                subtask_obj = SubTask.objects.select_related('task').get(id=subtask_id)
                task_obj = subtask_obj.task
                if task_id and str(task_obj.id) != str(task_id):
                    return Response({"detail": "Subtask does not belong to the specified task."}, status=status.HTTP_400_BAD_REQUEST)
            except (SubTask.DoesNotExist, ValueError):
                return Response({"detail": "Subtask not found."}, status=status.HTTP_400_BAD_REQUEST)
        elif task_id:
            try:
                task_obj = Task.objects.get(id=task_id)
            except (Task.DoesNotExist, ValueError):
                return Response({"detail": "Task not found."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "Task or subtask is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not user_has_task_access(request.user, task_obj):
            return Response({"detail": "You do not have permission to access this file."}, status=status.HTTP_403_FORBIDDEN)

        attachment = TaskAttachment.objects.create(
            task=task_obj,
            subtask=subtask_obj,
            file=uploaded_file,
            original_name=clean_filename,
            mime_type=uploaded_file.content_type or 'application/octet-stream',
            size=uploaded_file.size,
            uploaded_by=request.user
        )

        serializer = self.get_serializer(attachment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['GET'])
    def download(self, request, pk=None):
        try:
            attachment = TaskAttachment.objects.select_related('task').get(pk=pk)
        except (TaskAttachment.DoesNotExist, ValueError):
            return Response({"detail": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        if not user_has_task_access(request.user, attachment.task):
            return Response({"detail": "You do not have permission to access this file."}, status=status.HTTP_403_FORBIDDEN)

        try:
            response = FileResponse(attachment.file.open('rb'), content_type=attachment.mime_type)
            response['Content-Disposition'] = f'inline; filename="{attachment.original_name}"'
            return response
        except Exception:
            return Response({"detail": "Unable to upload the file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        try:
            attachment = self.get_object()
        except Exception:
            return Response({"detail": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        if attachment.uploaded_by != request.user and request.user.role != 'ADMIN':
            return Response({"detail": "You do not have permission to access this file."}, status=status.HTTP_403_FORBIDDEN)

        if attachment.file:
            attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskTypeViewSet(viewsets.ModelViewSet):
    serializer_class = TaskTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return TaskType.objects.none()

        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        active_org = get_active_organization(user, request=self.request)
        if not active_org:
            return TaskType.objects.none()

        qs = TaskType.objects.filter(organization=active_org)
        if not is_admin_or_org_admin(user, request=self.request):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        user = self.request.user
        if not is_admin_or_org_admin(user, request=self.request):
            raise exceptions.PermissionDenied("Only Organisation admins and managers can create task types.")
        active_org = get_active_organization(user, request=self.request)
        if not active_org:
            raise exceptions.PermissionDenied("User has no active organization membership.")
        serializer.save(organization=active_org)

    def perform_update(self, serializer):
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        user = self.request.user
        if not is_admin_or_org_admin(user, request=self.request):
            raise exceptions.PermissionDenied("Only Organisation admins and managers can edit task types.")
        active_org = get_active_organization(user, request=self.request)
        if serializer.instance.organization != active_org:
            raise exceptions.PermissionDenied("Cannot modify task type belonging to another organization.")
        serializer.save()

    def perform_destroy(self, instance):
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        user = self.request.user
        if not is_admin_or_org_admin(user, request=self.request):
            raise exceptions.PermissionDenied("Only Organisation admins and managers can delete task types.")
        active_org = get_active_organization(user, request=self.request)
        if instance.organization != active_org:
            raise exceptions.PermissionDenied("Cannot delete task type belonging to another organization.")
        instance.delete()


class OrganizationSettingsView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from apps.accounts.tenant_context import get_active_organization
        org = get_active_organization(request.user, request=request)
        if not org:
            return Response({"detail": "User has no active organization membership."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "id": str(org.id),
            "name": org.name,
            "display_name": org.display_name,
            "effective_name": org.effective_name,
            "logo_url": request.build_absolute_uri(org.logo.url) if org.logo else None,
            "enable_task_types": org.enable_task_types,
            "weekly_capacity_hours": org.weekly_capacity_hours,
        })

    def create(self, request):
        from apps.accounts.tenant_context import get_active_organization, get_active_role, is_admin_or_org_admin
        org = get_active_organization(request.user, request=request)
        role = get_active_role(request.user, request=request)
        if not org:
            return Response({"detail": "User has no active organization membership."}, status=status.HTTP_400_BAD_REQUEST)
        if not is_admin_or_org_admin(request.user, request=request):
            return Response({"detail": "Only Organisation admins and managers can modify organization settings."}, status=status.HTTP_403_FORBIDDEN)

        display_name = request.data.get('display_name')
        name = request.data.get('name')
        enable_task_types = request.data.get('enable_task_types')
        weekly_capacity_hours = request.data.get('weekly_capacity_hours')
        logo_file = request.FILES.get('logo')

        if role != 'ORG_ADMIN' and (display_name is not None or (name is not None and isinstance(name, str) and name.strip()) or logo_file):
            return Response({"detail": "Only Organisation admins can modify organization name and branding."}, status=status.HTTP_403_FORBIDDEN)

        if display_name is not None and role == 'ORG_ADMIN':
            org.display_name = display_name.strip() if isinstance(display_name, str) else display_name
        if name is not None and isinstance(name, str) and name.strip() and role == 'ORG_ADMIN':
            org.name = name.strip()
        if enable_task_types is not None:
            org.enable_task_types = str(enable_task_types).lower() in ('true', '1')
        if weekly_capacity_hours is not None:
            try:
                org.weekly_capacity_hours = int(weekly_capacity_hours)
            except (ValueError, TypeError):
                pass
        if logo_file and role == 'ORG_ADMIN':
            org.logo = logo_file

        org.save()
        return Response({
            "id": str(org.id),
            "name": org.name,
            "display_name": org.display_name,
            "effective_name": org.effective_name,
            "logo_url": request.build_absolute_uri(org.logo.url) if org.logo else None,
            "enable_task_types": org.enable_task_types,
            "weekly_capacity_hours": org.weekly_capacity_hours,
        })


