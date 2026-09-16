import uuid
from django.db import models


class Industry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Industries'

    def __str__(self):
        return self.name


class ProjectTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    industry = models.ForeignKey(Industry, on_delete=models.CASCADE, related_name='templates')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.industry.name})"


class TemplateTask(models.Model):
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(ProjectTemplate, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    position = models.PositiveIntegerField(default=0)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'created_at']

    def __str__(self):
        return f"{self.name} (Template: {self.template.name})"


class TemplateSubTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_task = models.ForeignKey(TemplateTask, on_delete=models.CASCADE, related_name='subtasks')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'created_at']

    def __str__(self):
        return f"{self.name} (Subtask of {self.template_task.name})"
