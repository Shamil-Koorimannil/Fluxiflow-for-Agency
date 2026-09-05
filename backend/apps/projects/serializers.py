from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Project
from apps.accounts.serializers import UserSerializer

User = get_user_model()

class ProjectSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    completed_task_count = serializers.SerializerMethodField()

    client_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'project_date', 'client', 'client_name',
            'client_display_name', 'created_by', 'created_at', 'updated_at',
            'members', 'progress', 'task_count', 'completed_task_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_client_display_name(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name or None

    def get_members(self, obj):
        return []

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_completed_task_count(self, obj):
        return obj.tasks.filter(status='COMPLETED').count()

    def get_progress(self, obj):
        total_tasks = obj.tasks.count()
        if total_tasks == 0:
            return None # Frontend will show "No tasks yet" as required by requirement 64
        completed_tasks = obj.tasks.filter(status='COMPLETED').count()
        return round((completed_tasks / total_tasks) * 100)

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            from apps.accounts.tenant_context import get_active_organization
            active_org = get_active_organization(request.user, request=request)
            if active_org:
                client = attrs.get('client')
                if client and client.organization_id != active_org.id:
                    raise serializers.ValidationError({"client": "Selected client belongs to another organization."})
        return attrs
