import uuid
from django.db import models
from django.conf import settings

class ActivityLog(models.Model):
    ACTION_CHOICES = (
        ('TASK_CREATED', 'Task Created'),
        ('TASK_UPDATED', 'Task Updated'),
        ('TASK_DELETED', 'Task Deleted'),
        ('TASK_ASSIGNED', 'Task Assigned'),
        ('TASK_COMPLETED', 'Task Completed'),
        ('TASK_REOPENED', 'Task Reopened'),
        ('SUBTASK_CREATED', 'Subtask Created'),
        ('SUBTASK_COMPLETED', 'Subtask Completed'),
        ('PROJECT_CREATED', 'Project Created'),
        ('PROJECT_UPDATED', 'Project Updated'),
        ('PROJECT_DELETED', 'Project Deleted'),
        ('SUBPROJECT_CREATED', 'Subproject Created'),
        ('PROFILE_UPDATED', 'Profile Updated'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=50)  # e.g., 'Task', 'Project', 'SubProject', 'Profile'
    entity_id = models.UUIDField(null=True, blank=True)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    objects = models.Manager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['user']),
            models.Index(fields=['organization', '-created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.organization_id and self.user and getattr(self.user, 'active_organization_id', None):
            self.organization = self.user.active_organization
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.name} - {self.action} - {self.created_at}"
