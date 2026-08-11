from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'type', 'title', 'is_read', 'created_at', 'read_at')
    list_filter = ('type', 'is_read')
    search_fields = ('recipient__email', 'recipient__name', 'title', 'message')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'read_at')
    date_hierarchy = 'created_at'
