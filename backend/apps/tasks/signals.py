from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.utils import timezone
from .models import TaskAssignee, TaskAssignmentHistory, SubTaskAssignee

@receiver(post_save, sender=TaskAssignee)
def handle_assignee_save(sender, instance, created, **kwargs):
    if created:
        # Prevent creating duplicates: check if active history entry already exists
        exists = TaskAssignmentHistory.objects.filter(
            task=instance.task,
            user=instance.user,
            unassigned_at__isnull=True
        ).exists()
        if not exists:
            # Match task's created_at if it's a new task
            assigned_at = instance.task.created_at or timezone.now()
            TaskAssignmentHistory.objects.create(
                task=instance.task,
                user=instance.user,
                assigned_at=assigned_at,
                completed=instance.completed,
                completed_at=instance.completed_at
            )
    else:
        # If updated (e.g. completion status changes)
        if instance.completed:
            # Close the active history entry upon completion
            TaskAssignmentHistory.objects.filter(
                task=instance.task,
                user=instance.user,
                unassigned_at__isnull=True
            ).update(
                completed=True,
                completed_at=instance.completed_at,
                unassigned_at=instance.completed_at
            )
        else:
            # Reopened or other update while incomplete
            exists = TaskAssignmentHistory.objects.filter(
                task=instance.task,
                user=instance.user,
                unassigned_at__isnull=True
            ).exists()
            if not exists:
                TaskAssignmentHistory.objects.create(
                    task=instance.task,
                    user=instance.user,
                    assigned_at=timezone.now(),
                    completed=False,
                    completed_at=None
                )
            else:
                TaskAssignmentHistory.objects.filter(
                    task=instance.task,
                    user=instance.user,
                    unassigned_at__isnull=True
                ).update(
                    completed=False,
                    completed_at=None
                )

@receiver(pre_delete, sender=TaskAssignee)
def handle_assignee_delete(sender, instance, **kwargs):
    # Mark active assignment history entries as unassigned
    TaskAssignmentHistory.objects.filter(
        task=instance.task,
        user=instance.user,
        unassigned_at__isnull=True
    ).update(unassigned_at=timezone.now())


@receiver(post_save, sender=SubTaskAssignee)
def handle_subtask_assignee_save(sender, instance, created, **kwargs):
    if created:
        exists = TaskAssignmentHistory.objects.filter(
            subtask=instance.subtask,
            user=instance.user,
            unassigned_at__isnull=True
        ).exists()
        if not exists:
            assigned_at = instance.subtask.created_at or timezone.now()
            TaskAssignmentHistory.objects.create(
                subtask=instance.subtask,
                user=instance.user,
                assigned_at=assigned_at,
                completed=instance.completed,
                completed_at=instance.completed_at
            )
    else:
        if instance.completed:
            TaskAssignmentHistory.objects.filter(
                subtask=instance.subtask,
                user=instance.user,
                unassigned_at__isnull=True
            ).update(
                completed=True,
                completed_at=instance.completed_at,
                unassigned_at=instance.completed_at
            )
        else:
            exists = TaskAssignmentHistory.objects.filter(
                subtask=instance.subtask,
                user=instance.user,
                unassigned_at__isnull=True
            ).exists()
            if not exists:
                TaskAssignmentHistory.objects.create(
                    subtask=instance.subtask,
                    user=instance.user,
                    assigned_at=timezone.now(),
                    completed=False,
                    completed_at=None
                )
            else:
                TaskAssignmentHistory.objects.filter(
                    subtask=instance.subtask,
                    user=instance.user,
                    unassigned_at__isnull=True
                ).update(
                    completed=False,
                    completed_at=None
                )


@receiver(pre_delete, sender=SubTaskAssignee)
def handle_subtask_assignee_delete(sender, instance, **kwargs):
    TaskAssignmentHistory.objects.filter(
        subtask=instance.subtask,
        user=instance.user,
        unassigned_at__isnull=True
    ).update(unassigned_at=timezone.now())


# --- WebSocket Channels Broadcast Signals ---

import logging
from django.db.models.signals import post_delete
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Task, SubTask

logger = logging.getLogger(__name__)

def get_organization_id(instance):
    # Try direct organization attribute
    try:
        if getattr(instance, 'organization_id', None):
            return instance.organization_id
    except Exception:
        pass

    # Try project
    try:
        project = getattr(instance, 'project', None)
        if project and project.organization_id:
            return project.organization_id
    except Exception:
        pass

    # Try task relation
    try:
        task = getattr(instance, 'task', None)
        if task:
            if task.organization_id:
                return task.organization_id
            if task.project and task.project.organization_id:
                return task.project.organization_id
    except Exception:
        pass

    # Try subtask relation
    try:
        subtask = getattr(instance, 'subtask', None)
        if subtask:
            task = subtask.task
            if task:
                if task.organization_id:
                    return task.organization_id
                if task.project and task.project.organization_id:
                    return task.project.organization_id
    except Exception:
        pass

    return None

def get_task_id(instance):
    if isinstance(instance, Task):
        return instance.id
    if isinstance(instance, SubTask):
        return instance.task_id
    try:
        if getattr(instance, 'task_id', None):
            return instance.task_id
    except Exception:
        pass
    try:
        subtask = instance.subtask
        if subtask:
            return subtask.task_id
    except Exception:
        pass
    return None

def send_realtime_broadcast(instance, event_type, task_id):
    try:
        # Check if the task still exists (except for deletion events)
        if event_type not in ["task.deleted", "subtask.deleted"] and task_id:
            if not Task.objects.filter(id=task_id).exists():
                return  # Task is deleted, skip broadcast
                
        org_id = get_organization_id(instance)
        if not org_id:
            return
            
        channel_layer = get_channel_layer()
        if channel_layer:
            group_name = f"organization_{org_id}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "task_event",
                    "event_type": event_type,
                    "task_id": str(task_id),
                }
            )
    except Exception as e:
        logger.error(f"Unexpected error in send_realtime_broadcast: {e}", exc_info=True)

@receiver(post_save, sender=Task)
def handle_task_realtime_save(sender, instance, created, **kwargs):
    try:
        event = "task.created" if created else "task.updated"
        send_realtime_broadcast(instance, event, instance.id)
    except Exception as e:
        logger.error(f"Error in handle_task_realtime_save: {e}", exc_info=True)

@receiver(post_delete, sender=Task)
def handle_task_realtime_delete(sender, instance, **kwargs):
    try:
        send_realtime_broadcast(instance, "task.deleted", instance.id)
    except Exception as e:
        logger.error(f"Error in handle_task_realtime_delete: {e}", exc_info=True)

@receiver(post_save, sender=TaskAssignee)
def handle_assignee_realtime_save(sender, instance, created, **kwargs):
    try:
        task_id = get_task_id(instance)
        if task_id:
            event = "task.assignee.completed" if instance.completed else "task.assignment.updated"
            send_realtime_broadcast(instance, event, task_id)
    except Exception as e:
        logger.error(f"Error in handle_assignee_realtime_save: {e}", exc_info=True)

@receiver(post_delete, sender=TaskAssignee)
def handle_assignee_realtime_delete(sender, instance, **kwargs):
    try:
        task_id = get_task_id(instance)
        if task_id:
            send_realtime_broadcast(instance, "task.assignment.updated", task_id)
    except Exception as e:
        logger.error(f"Error in handle_assignee_realtime_delete: {e}", exc_info=True)

@receiver(post_save, sender=SubTask)
def handle_subtask_realtime_save(sender, instance, created, **kwargs):
    try:
        task_id = get_task_id(instance)
        if task_id:
            event = "subtask.created" if created else "subtask.updated"
            send_realtime_broadcast(instance, event, task_id)
    except Exception as e:
        logger.error(f"Error in handle_subtask_realtime_save: {e}", exc_info=True)

@receiver(post_delete, sender=SubTask)
def handle_subtask_realtime_delete(sender, instance, **kwargs):
    try:
        task_id = get_task_id(instance)
        if task_id:
            send_realtime_broadcast(instance, "subtask.deleted", task_id)
    except Exception as e:
        logger.error(f"Error in handle_subtask_realtime_delete: {e}", exc_info=True)

@receiver(post_save, sender=SubTaskAssignee)
def handle_subtask_assignee_realtime_save(sender, instance, created, **kwargs):
    try:
        task_id = get_task_id(instance)
        if task_id:
            event = "task.assignee.completed" if instance.completed else "task.assignment.updated"
            send_realtime_broadcast(instance, event, task_id)
    except Exception as e:
        logger.error(f"Error in handle_subtask_assignee_realtime_save: {e}", exc_info=True)

@receiver(post_delete, sender=SubTaskAssignee)
def handle_subtask_assignee_realtime_delete(sender, instance, **kwargs):
    try:
        task_id = get_task_id(instance)
        if task_id:
            send_realtime_broadcast(instance, "task.assignment.updated", task_id)
    except Exception as e:
        logger.error(f"Error in handle_subtask_assignee_realtime_delete: {e}", exc_info=True)


