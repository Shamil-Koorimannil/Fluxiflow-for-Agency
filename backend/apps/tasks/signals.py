from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.utils import timezone
from .models import TaskAssignee, TaskAssignmentHistory

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
