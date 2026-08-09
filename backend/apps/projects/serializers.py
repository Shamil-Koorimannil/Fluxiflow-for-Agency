from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Project, ProjectMember, SubProject
from apps.accounts.serializers import UserSerializer

User = get_user_model()

class SubProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubProject
        fields = ['id', 'project', 'name', 'description', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

class ProjectSerializer(serializers.ModelSerializer):
    sub_projects = SubProjectSerializer(many=True, read_only=True)
    members = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    completed_task_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'created_by', 'created_at', 'updated_at',
            'sub_projects', 'members', 'progress', 'task_count', 'completed_task_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_members(self, obj):
        memberships = ProjectMember.objects.filter(project=obj).select_related('user')
        users = [membership.user for membership in memberships]
        return UserSerializer(users, many=True, context=self.context).data

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
