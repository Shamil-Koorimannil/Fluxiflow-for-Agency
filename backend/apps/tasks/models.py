import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.projects.models import Project

class Task(models.Model):
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, blank=True, null=True, related_name='tasks')
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    due_time = models.TimeField(blank=True, null=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_tasks')
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True, related_name='completed_tasks')
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = models.Manager()

    class Meta:
        ordering = ['due_date', 'due_time', 'created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['project']),
            models.Index(fields=['created_by']),
        ]

    def __str__(self):
        return self.name

class TaskAssignee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignee_relationships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_assignments')
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(blank=True, null=True)

    objects = models.Manager()

    class Meta:
        unique_together = ('task', 'user')
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['task']),
        ]

    def __str__(self):
        return f"{self.user.name} assigned to {self.task.name}"

class SubTask(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='subtasks')
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    due_date = models.DateField(null=True, blank=True)
    due_time = models.TimeField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True, related_name='completed_subtasks')
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.name} (Subtask of {self.task.name})"

class SubTaskAssignee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subtask = models.ForeignKey(SubTask, on_delete=models.CASCADE, related_name='assignee_relationships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subtask_assignments')
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('subtask', 'user')
        indexes = [
            models.Index(fields=['subtask']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.name} assigned to subtask {self.subtask.name}"

class TaskAssignmentHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name='assignment_histories')
    subtask = models.ForeignKey(SubTask, on_delete=models.CASCADE, null=True, blank=True, related_name='assignment_histories')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_assignment_histories')
    assigned_at = models.DateTimeField(default=timezone.now)
    unassigned_at = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['assigned_at']
        indexes = [
            models.Index(fields=['task', 'user']),
            models.Index(fields=['subtask', 'user']),
            models.Index(fields=['assigned_at']),
            models.Index(fields=['unassigned_at']),
        ]
        constraints = [
            models.CheckConstraint(  # type: ignore
                check=(
                    models.Q(task__isnull=False, subtask__isnull=True) |
                    models.Q(task__isnull=True, subtask__isnull=False)
                ),
                name='history_exactly_one_work_item'
            )
        ]

    def __str__(self):
        item_name = self.task.name if self.task else (self.subtask.name if self.subtask else "None")
        return f"{self.user.name} was assigned to {item_name} ({self.assigned_at} to {self.unassigned_at})"


class TaskComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    subtask = models.ForeignKey(SubTask, on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['task']),
            models.Index(fields=['subtask']),
            models.Index(fields=['created_at']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        if self.subtask and self.subtask.task_id != self.task_id:
            raise ValidationError("Subtask does not belong to the specified task.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        target = f"Subtask {self.subtask_id}" if self.subtask_id else f"Task {self.task_id}"
        return f"Comment by {self.author} on {target}"


class TaskAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    subtask = models.ForeignKey(SubTask, on_delete=models.CASCADE, null=True, blank=True, related_name='attachments')
    file = models.FileField(upload_to='task_attachments/')
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    size = models.BigIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='uploaded_attachments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['task']),
            models.Index(fields=['subtask']),
            models.Index(fields=['created_at']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        if self.subtask and self.subtask.task_id != self.task_id:
            raise ValidationError("Subtask does not belong to the specified task.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        target = f"Subtask {self.subtask_id}" if self.subtask_id else f"Task {self.task_id}"
        return f"Attachment '{self.original_name}' on {target}"

