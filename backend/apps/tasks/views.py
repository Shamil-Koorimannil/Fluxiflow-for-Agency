from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Task, TaskAssignee, SubTask
from .serializers import TaskSerializer, SubTaskSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Task.objects.none()
        
        # Filter based on project parameter if provided
        project_id = self.request.query_params.get('project')
        
        if user.role == 'ADMIN':
            queryset = Task.objects.all()
        else:
            # Member: only see tasks they are assigned to
            queryset = Task.objects.filter(assignee_relationships__user=user)
            
        if project_id:
            queryset = queryset.filter(project_id=project_id)
            
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
            
        task.status = 'COMPLETED'
        task.completed_by = user
        task.completed_at = timezone.now()
        task.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=user,
            action='TASK_COMPLETED',
            entity_type='Task',
            entity_id=task.id,
            description=f"{user.name} completed task '{task.name}'."
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
            
        task.status = 'PENDING'
        task.completed_by = None
        task.completed_at = None
        task.save()
        
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
        
        # Check permission: Admin, or Member assigned to the parent task
        is_assigned = TaskAssignee.objects.filter(task=subtask.task, user=user).exists()
        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot complete subtasks for tasks not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        subtask.status = 'COMPLETED'
        subtask.completed_by = user
        subtask.completed_at = timezone.now()
        subtask.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=user,
            action='SUBTASK_COMPLETED',
            entity_type='SubTask',
            entity_id=subtask.id,
            description=f"{user.name} completed subtask '{subtask.name}'."
        )
        
        serializer = self.get_serializer(subtask)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'])
    def reopen(self, request, pk=None):
        subtask = self.get_object()
        user = request.user
        
        # Check permission: Admin, or Member assigned to the parent task
        is_assigned = TaskAssignee.objects.filter(task=subtask.task, user=user).exists()
        if user.role != 'ADMIN' and not is_assigned:
            return Response({"detail": "You cannot reopen subtasks for tasks not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            
        subtask.status = 'PENDING'
        subtask.completed_by = None
        subtask.completed_at = None
        subtask.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=user,
            action='SUBTASK_COMPLETED',
            entity_type='SubTask',
            entity_id=subtask.id,
            description=f"{user.name} reopened subtask '{subtask.name}'."
        )
        
        serializer = self.get_serializer(subtask)
        return Response(serializer.data)
