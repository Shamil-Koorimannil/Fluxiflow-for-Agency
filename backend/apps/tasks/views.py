from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Task, TaskAssignee, SubTask, SubTaskAssignee
from .serializers import TaskSerializer, SubTaskSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog
from apps.accounts.models import CustomUser as User

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
        
        # Check permission: Admin, or Member assigned to the task
        is_assigned = TaskAssignee.objects.filter(task=task, user=user).exists()
        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot complete a task that is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.notifications.services import NotificationService

        if is_assigned:
            # Mark this specific assignee as completed
            assignee = TaskAssignee.objects.get(task=task, user=user)
            assignee.completed = True
            assignee.completed_at = timezone.now()
            assignee.save()
            
            # Check if submission is late using the centralized helper
            from apps.tasks.helpers import calculate_submission_status, format_notification_duration
            sub_status, late_mins = calculate_submission_status(assignee)
            
            if sub_status == "LATE":
                duration_str = format_notification_duration(late_mins)
                # Notify member: Task Completed Late
                NotificationService.create_notification(
                    recipient=user,
                    notification_type='TASK_COMPLETED_LATE',
                    title='Task Completed Late',
                    message=f"You completed {task.name} {duration_str} after its deadline.",
                    related_task=task,
                    related_project=task.project,
                    related_user=user
                )
                # Notify admins: Late Task Submission
                NotificationService.notify_admins(
                    notification_type='LATE_TASK_SUBMISSION',
                    title='Late Task Submission',
                    message=f"{user.name} completed {task.name} late.",
                    related_task=task,
                    related_project=task.project,
                    related_user=user
                )
            else:
                # Notify admins that user completed task
                NotificationService.notify_admins(
                    notification_type='TASK_COMPLETED',
                    title='Task Completed',
                    message=f"{user.name} completed {task.name}.",
                    related_task=task,
                    related_project=task.project,
                    related_user=user
                )

            # Check if all assignees have completed
            incomplete_exists = TaskAssignee.objects.filter(task=task, completed=False).exists()
            if not incomplete_exists:
                task.status = 'COMPLETED'
                task.completed_by = user
                task.completed_at = timezone.now()
                task.save()
                
                # Notify admins that entire task is completed
                NotificationService.notify_admins(
                    notification_type='TASK_COMPLETED',
                    title='Task Completed',
                    message=f"{task.name} has been completed.",
                    related_task=task,
                    related_project=task.project,
                    related_user=user
                )
        else:
            # Admin completing the task globally
            task.status = 'COMPLETED'
            task.completed_by = user
            task.completed_at = timezone.now()
            task.save()
            
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
        desc = f"{user.name} completed task '{task.name}'."
        if is_assigned:
            from apps.tasks.helpers import calculate_submission_status
            try:
                assignee = TaskAssignee.objects.get(task=task, user=user)
                sub_status, _ = calculate_submission_status(assignee)
                if sub_status == "LATE":
                    desc = f"{user.name} completed task '{task.name}' late."
            except TaskAssignee.DoesNotExist:
                pass
                
        ActivityLog.objects.create(
            user=user,
            action='TASK_COMPLETED',
            entity_type='Task',
            entity_id=task.id,
            description=desc
        )
        
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

        if is_assigned:
            # Mark this specific assignee as not completed
            assignee = TaskAssignee.objects.get(task=task, user=user)
            assignee.completed = False
            assignee.completed_at = None
            assignee.save()
            
        task.status = 'PENDING'
        task.completed_by = None
        task.completed_at = None
        task.save()

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
        subtask.status = 'PENDING'
        subtask.completed_by = None
        subtask.completed_at = None
        subtask.save()
        
        serializer = self.get_serializer(subtask)
        return Response(serializer.data)
