from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Task, TaskAssignee, SubTask, SubTaskAssignee
from .serializers import TaskSerializer, SubTaskSerializer
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
        
        project_id = self.request.query_params.get('project')
        
        if self.action == 'list':
            if project_id:
                queryset = Task.objects.filter(project_id=project_id)
            else:
                # General list: only assigned tasks
                queryset = Task.objects.filter(assignee_relationships__user=user)
        else:
            # Detail requests (retrieve, update, partial_update, destroy, actions)
            if user.role == 'ADMIN':
                queryset = Task.objects.all()
            else:
                from django.db.models import Q
                queryset = Task.objects.filter(
                    Q(assignee_relationships__user=user) | Q(project__isnull=False)
                )
                
        return queryset.distinct().order_by('due_date', 'due_time', 'created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        project_id = request.query_params.get('project')
        user = request.user
        
        # Serialize tasks
        serializer = self.get_serializer(queryset, many=True)
        data = list(serializer.data)
            
        # Append subtasks if it's the general list (no project filter) and user is a MEMBER
        if not project_id and user.is_authenticated and user.role != 'ADMIN':
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
        """Helper to ensure only Admins can create/edit/delete tasks."""
        if request.user.role != 'ADMIN':
            return False
        return True

    def create(self, request, *args, **kwargs):
        if not self.check_modify_permission(request):
            return Response({"detail": "Only Admins can create tasks."}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = self.get_serializer(data=request.data)
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
            return Response(serializer.data)
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

    @action(detail=True, methods=['POST'])
    def complete(self, request, pk=None):
        task = self.get_object()
        user = request.user
        
        # Prevent completion if task has incomplete subtasks
        if task.subtasks.exclude(status='COMPLETED').exists():
            return Response(
                {"detail": "All subtasks must be completed before the task can be completed."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check permission: Admin, or Member assigned to the task
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot complete a task that is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.notifications.services import NotificationService

        # Set user context for logging
        task._status_change_user = user

        # Update the database
        task.status = 'COMPLETED'
        task.completed_by = user
        task.completed_at = timezone.now()
        task.save()

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

    @action(detail=True, methods=['POST'])
    def reopen(self, request, pk=None):
        task = self.get_object()
        user = request.user
        
        # Check permission: Admin, or Member assigned to the task
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot reopen a task that is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.notifications.services import NotificationService

        # Set user context for logging
        task._status_change_user = user

        task.status = 'PENDING'
        task.completed_by = None
        task.completed_at = None
        task.save()

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

    @action(detail=True, methods=['POST'])
    def subtasks(self, request, pk=None):
        task = self.get_object()
        user = request.user
        
        # Only Admins can create subtasks
        if user.role != 'ADMIN':
            return Response({"detail": "Only Admins can create subtasks."}, status=status.HTTP_403_FORBIDDEN)
            
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
