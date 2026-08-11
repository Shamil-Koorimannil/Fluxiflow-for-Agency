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

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'created_by', 'created_at', 'updated_at',
            'members', 'progress', 'task_count', 'completed_task_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

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
