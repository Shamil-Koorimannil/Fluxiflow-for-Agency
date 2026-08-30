import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class KeepItem(models.Model):
    ITEM_TYPE_CHOICES = (
        ('FOLDER', 'Folder'),
        ('DOCUMENT', 'Document'),
        ('NOTE', 'Note'),
        ('SPREADSHEET', 'Spreadsheet'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    name = models.CharField(max_length=255)
    version = models.PositiveIntegerField(default=1)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_keep_items'
    )
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='keep_items'
    )
    parent_folder = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )

    # Content storage
    document_content = models.TextField(blank=True, default='')
    spreadsheet_data = models.JSONField(default=dict, blank=True)

    # Import metadata (populated for imported spreadsheets)
    original_import_filename = models.CharField(max_length=255, null=True, blank=True)
    original_import_format = models.CharField(max_length=50, null=True, blank=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='imported_keep_items'
    )
    imported_at = models.DateTimeField(null=True, blank=True)
    import_warnings = models.JSONField(default=list, blank=True)

    # Soft delete
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Timestamps & Authors
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_keep_items'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_keep_items'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['organization']),
            models.Index(fields=['parent_folder']),
            models.Index(fields=['item_type']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['created_at']),
        ]

    def clean(self):
        super().clean()
        if self.item_type == 'SPREADSHEET' and self.document_content:
            raise ValidationError({'document_content': 'Spreadsheets must not have document content.'})
        if self.item_type in ['DOCUMENT', 'NOTE'] and self.spreadsheet_data:
            if not isinstance(self.spreadsheet_data, dict) or len(self.spreadsheet_data) > 0:
                raise ValidationError({'spreadsheet_data': 'Documents and Notes must not store spreadsheet data.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.item_type})"


class KeepUserPin(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='keep_pins')
    item = models.ForeignKey(KeepItem, on_delete=models.CASCADE, related_name='user_pins')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'item')
        ordering = ['-created_at']


class KeepRecentItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='keep_recents')
    item = models.ForeignKey(KeepItem, on_delete=models.CASCADE, related_name='user_recents')
    last_opened_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'item')
        ordering = ['-last_opened_at']


class KeepPermission(models.Model):
    ACCESS_LEVEL_CHOICES = (
        ('ONLY_ME', 'Only Me'),
        ('YOU_AND_ADMINS', 'You + Admins'),
        ('EVERYONE', 'Everyone'),
        ('SPECIFIC', 'Specific People'),
    )
    ROLE_CHOICES = (
        ('VIEW', 'Can View'),
        ('EDIT', 'Can Edit'),
    )

    item = models.ForeignKey(KeepItem, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='keep_permissions')
    access_level = models.CharField(max_length=20, choices=ACCESS_LEVEL_CHOICES, default='ONLY_ME')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='VIEW')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('item', 'user')


class KeepShareLink(models.Model):
    ROLE_CHOICES = (
        ('VIEW', 'Can View'),
        ('EDIT', 'Can Edit'),
    )

    item = models.ForeignKey(KeepItem, on_delete=models.CASCADE, related_name='share_links')
    token = models.CharField(max_length=64, unique=True, db_index=True)
    permission = models.CharField(max_length=10, choices=ROLE_CHOICES, default='VIEW')
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"ShareLink({self.item.name}, token={self.token[:8]}...)"


class KeepVersionHistory(models.Model):
    item = models.ForeignKey(KeepItem, on_delete=models.CASCADE, related_name='versions')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    version_number = models.PositiveIntegerField()
    content_snapshot = models.TextField(blank=True, default='')
    spreadsheet_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']


class KeepAuditLog(models.Model):
    item = models.ForeignKey(KeepItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
