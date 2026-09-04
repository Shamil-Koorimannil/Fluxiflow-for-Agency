import uuid
from django.db import models
from django.conf import settings

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='projects', null=True, blank=True)
    client = models.ForeignKey('clients.Client', on_delete=models.SET_NULL, related_name='projects', null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_projects')
    client_name = models.CharField(max_length=255, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    project_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.organization_id and self.created_by:
            from apps.accounts.tenant_context import get_active_organization
            self.organization = get_active_organization(self.created_by)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

