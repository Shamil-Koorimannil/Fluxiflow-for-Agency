from django.contrib import admin
from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    """
    ActivityLog is an immutable audit trail.
    Change and delete permissions are disabled to protect log integrity.
    """
    list_display = ('user', 'action', 'entity_type', 'entity_id', 'description', 'created_at')
    list_filter = ('action', 'entity_type')
    search_fields = ('user__email', 'user__name', 'description', 'action')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'user', 'action', 'entity_type', 'entity_id', 'description', 'created_at')
    date_hierarchy = 'created_at'

    def has_change_permission(self, request, obj=None):
        """Audit logs must not be editable."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Audit logs must not be deletable from Admin."""
        return False
