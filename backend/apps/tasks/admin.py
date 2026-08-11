from django.contrib import admin
from .models import Task, TaskAssignee, SubTask, TaskAssignmentHistory


# ── Task ─────────────────────────────────────────────────────────────────────
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'project', 'priority', 'status',
        'due_date', 'due_time', 'created_by', 'completed_by', 'completed_at', 'created_at',
    )
    list_filter = ('status', 'priority', 'project', 'organization')
    search_fields = ('name', 'description', 'created_by__email', 'created_by__name')
    ordering = ('due_date', 'due_time')
    readonly_fields = ('id', 'created_at', 'updated_at')
    date_hierarchy = 'due_date'
    autocomplete_fields = []

    fieldsets = (
        ('Task Details', {'fields': ('id', 'name', 'description', 'project', 'organization')}),
        ('Schedule', {'fields': ('due_date', 'due_time')}),
        ('Priority & Status', {'fields': ('priority', 'status')}),
        ('Ownership', {'fields': ('created_by', 'created_at', 'updated_at')}),
        ('Completion', {'fields': ('completed_by', 'completed_at')}),
    )


# ── TaskAssignee ──────────────────────────────────────────────────────────────
@admin.register(TaskAssignee)
class TaskAssigneeAdmin(admin.ModelAdmin):
    list_display = ('task', 'user', 'completed', 'completed_at')
    list_filter = ('completed',)
    search_fields = ('task__name', 'user__email', 'user__name')
    ordering = ('task',)
    readonly_fields = ('id',)


# ── SubTask ───────────────────────────────────────────────────────────────────
@admin.register(SubTask)
class SubTaskAdmin(admin.ModelAdmin):
    list_display = ('name', 'task', 'status', 'completed_by', 'completed_at', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'task__name', 'completed_by__email')
    ordering = ('task', 'created_at')
    readonly_fields = ('id', 'created_at', 'updated_at')


# ── TaskAssignmentHistory ──────────────────────────────────────────────────────
@admin.register(TaskAssignmentHistory)
class TaskAssignmentHistoryAdmin(admin.ModelAdmin):
    """
    Historical assignment records used for health scoring, late submission
    calculations and team metrics. Marked as read-only to protect data integrity.
    """
    list_display = ('task', 'user', 'assigned_at', 'unassigned_at', 'completed', 'completed_at')
    list_filter = ('completed',)
    search_fields = ('task__name', 'user__email', 'user__name')
    ordering = ('-assigned_at',)
    readonly_fields = ('id', 'task', 'user', 'assigned_at', 'unassigned_at', 'completed', 'completed_at')
    date_hierarchy = 'assigned_at'

    def has_change_permission(self, request, obj=None):
        """Read-only — modification would corrupt health scores and reports."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Prevent accidental deletion of historical records."""
        return False
