import uuid
from django.db import models
from django.conf import settings

class Notification(models.Model):
    TYPE_CHOICES = (
        ('TASK_ASSIGNED', 'Task Assigned'),
        ('TASK_UNASSIGNED', 'Task Unassigned'),
        ('TASK_REASSIGNED', 'Task Reassigned'),
        ('TASK_DUE_TODAY', 'Task Due Today'),
        ('TASK_DUE_SOON', 'Task Due Soon'),
        ('TASK_OVERDUE', 'Task Overdue'),
        ('TASK_COMPLETED', 'Task Completed'),
        ('TASK_COMPLETED_LATE', 'Task Completed Late'),
        ('LATE_TASK_SUBMISSION', 'Late Task Submission'),
        ('TASK_REOPENED', 'Task Reopened'),
        ('PROJECT_CREATED', 'Project Created'),
        ('PROJECT_UPDATED', 'Project Updated'),
        ('MEMBER_ADDED', 'Member Added'),
        ('MEMBER_DEACTIVATED', 'Member Deactivated'),
        ('MEMBER_REACTIVATED', 'Member Reactivated'),
        ('SYSTEM', 'System'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=150)
    message = models.TextField()
    related_task = models.ForeignKey('tasks.Task', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    related_project = models.ForeignKey('projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    related_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='related_notifications')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.recipient.name} - {self.title} - Read: {self.is_read}"
