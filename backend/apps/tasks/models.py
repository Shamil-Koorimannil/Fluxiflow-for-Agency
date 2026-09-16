import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.projects.models import Project

class TaskType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='task_types')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    allocated_seconds = models.IntegerField(default=3600)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = models.Manager()

    class Meta:
        ordering = ['name']
        unique_together = ('organization', 'name')

    def __str__(self):
        return f"{self.name} ({self.allocated_seconds}s)"


class RecurringTaskSeries(models.Model):
    FREQUENCY_CHOICES = (
        ('DAY', 'Day'),
        ('WEEK', 'Week'),
        ('MONTH', 'Month'),
        ('YEAR', 'Year'),
    )
    END_TYPE_CHOICES = (
        ('NEVER', 'Never'),
        ('ON', 'On Date'),
        ('AFTER', 'After Occurrences'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='recurring_task_series')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_recurring_series')
    
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='WEEK')
    interval = models.PositiveIntegerField(default=1)
    weekdays = models.JSONField(blank=True, default=list)
    month_day = models.PositiveIntegerField(blank=True, null=True)
    start_date = models.DateField()
    
    end_type = models.CharField(max_length=10, choices=END_TYPE_CHOICES, default='NEVER')
    end_date = models.DateField(blank=True, null=True)
    occurrence_count = models.PositiveIntegerField(blank=True, null=True)
    
    current_occurrence_number = models.PositiveIntegerField(default=1)
    timezone = models.CharField(max_length=100, default='UTC')
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = models.Manager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"RecurringSeries {self.id} ({self.frequency})"


class Task(models.Model):
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    )
    TIMER_STATUS_CHOICES = (
        ('NOT_STARTED', 'Not Started'),
        ('RUNNING', 'Running'),
        ('PAUSED', 'Paused'),
        ('COMPLETED', 'Completed'),
    )
    
    APPROVAL_STATUS_CHOICES = (
        ('NOT_STARTED', 'Not Started'),
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('NOT_REQUIRED', 'Not Required'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, blank=True, null=True, related_name='tasks')
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    task_type = models.ForeignKey(TaskType, on_delete=models.SET_NULL, blank=True, null=True, related_name='tasks')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    due_time = models.TimeField(blank=True, null=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_tasks')
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True, related_name='completed_tasks')
    completed_at = models.DateTimeField(blank=True, null=True)

    # Approval fields
    approval_required = models.BooleanField(default=False)
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='NOT_STARTED')
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True, related_name='tasks_to_approve')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True, related_name='approved_tasks')
    approved_at = models.DateTimeField(blank=True, null=True)

    # Recurrence fields
    recurring_series = models.ForeignKey(RecurringTaskSeries, on_delete=models.SET_NULL, blank=True, null=True, related_name='instances')
    recurrence_instance_date = models.DateField(blank=True, null=True)
    occurrence_index = models.PositiveIntegerField(blank=True, null=True)

    # Timer & Duration tracking fields
    allocated_seconds = models.IntegerField(blank=True, null=True)
    elapsed_seconds = models.IntegerField(default=0)
    timer_started_at = models.DateTimeField(blank=True, null=True)
    timer_status = models.CharField(max_length=20, choices=TIMER_STATUS_CHOICES, default='NOT_STARTED')
    actual_duration_seconds = models.IntegerField(blank=True, null=True)

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
            models.Index(fields=['recurring_series']),
            models.Index(fields=['approval_status']),
            models.Index(fields=['approver']),
        ]

    def save(self, *args, **kwargs):
        if not self.organization_id:
            if self.project and self.project.organization_id:
                self.organization = self.project.organization
            elif self.created_by:
                from apps.accounts.tenant_context import get_active_organization
                self.organization = get_active_organization(self.created_by)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class TaskTimeLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='time_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_time_logs')
    started_at = models.DateTimeField()
    paused_at = models.DateTimeField(blank=True, null=True)
    duration_seconds = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = models.Manager()

    class Meta:
        ordering = ['-started_at']

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
    ATTACHMENT_TYPE_CHOICES = (
        ('file', 'File'),
        ('link', 'Link'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    subtask = models.ForeignKey(SubTask, on_delete=models.CASCADE, null=True, blank=True, related_name='attachments')
    attachment_type = models.CharField(max_length=20, choices=ATTACHMENT_TYPE_CHOICES, default='file')
    file = models.FileField(upload_to='task_attachments/', blank=True, null=True)
    url = models.URLField(max_length=2048, blank=True, null=True)
    original_name = models.CharField(max_length=255, blank=True, null=True)
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    size = models.BigIntegerField(blank=True, null=True)
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
        if self.attachment_type == 'file' and not self.file:
            raise ValidationError("File attachment requires a file.")
        if self.attachment_type == 'link' and not self.url:
            raise ValidationError("Link attachment requires a URL.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        target = f"Subtask {self.subtask_id}" if self.subtask_id else f"Task {self.task_id}"
        return f"Attachment '{self.original_name or self.url}' on {target}"


