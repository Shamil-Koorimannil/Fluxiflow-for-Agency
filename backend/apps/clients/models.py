import uuid
from django.db import models
from django.conf import settings

class ClientStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'

class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='clients')
    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    website = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=ClientStatus.choices, default=ClientStatus.ACTIVE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_clients')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_clients')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.name


class AssetType(models.TextChoices):
    BRAND_GUIDELINES = 'BRAND_GUIDELINES', 'Brand Guidelines'
    LOGO = 'LOGO', 'Logo'
    LOGO_VARIATION = 'LOGO_VARIATION', 'Logo Variation'
    TYPOGRAPHY = 'TYPOGRAPHY', 'Typography'
    COLOR_GUIDELINES = 'COLOR_GUIDELINES', 'Color Guidelines'
    BRAND_BOOK = 'BRAND_BOOK', 'Brand Book'
    OTHER = 'OTHER', 'Other'

class ClientBrandAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='brand_assets')
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='client_brand_assets')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='client_brand_assets/')
    asset_type = models.CharField(max_length=30, choices=AssetType.choices, default=AssetType.OTHER)
    description = models.TextField(blank=True, null=True)
    file_size = models.BigIntegerField(default=0)
    file_type = models.CharField(max_length=100, blank=True, null=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_brand_assets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.client.name})"
