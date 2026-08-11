from django.contrib import admin
from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'created_by', 'created_at', 'updated_at')
    list_filter = ('organization',)
    search_fields = ('name', 'description', 'created_by__email', 'created_by__name')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    date_hierarchy = 'created_at'
