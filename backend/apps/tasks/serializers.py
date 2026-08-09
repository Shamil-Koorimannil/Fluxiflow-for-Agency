from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Task, TaskAssignee, SubTask
from apps.accounts.serializers import UserSerializer
from apps.projects.models import Project, SubProject
from apps.projects.serializers import ProjectSerializer, SubProjectSerializer

User = get_user_model()

class SubTaskSerializer(serializers.ModelSerializer):
    completed_by_detail = UserSerializer(source='completed_by', read_only=True)

    class Meta:
        model = SubTask
        fields = ['id', 'task', 'name', 'status', 'completed_by', 'completed_by_detail', 'completed_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'completed_by', 'completed_at', 'created_at', 'updated_at']

class TaskSerializer(serializers.ModelSerializer):
    subtasks = SubTaskSerializer(many=True, read_only=True)
    assignees = serializers.SerializerMethodField()
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=True
    )
    project_detail = ProjectSerializer(source='project', read_only=True)
    sub_project_detail = SubProjectSerializer(source='sub_project', read_only=True)
    created_by_detail = UserSerializer(source='created_by', read_only=True)
    completed_by_detail = UserSerializer(source='completed_by', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'sub_project', 'name', 'description', 'due_date', 'due_time',
            'priority', 'status', 'created_by', 'created_by_detail', 'completed_by', 'completed_by_detail',
            'completed_at', 'created_at', 'updated_at', 'subtasks', 'assignees', 'assignee_ids',
            'project_detail', 'sub_project_detail'
        ]
        read_only_fields = [
            'id', 'created_by', 'completed_by', 'completed_at', 'created_at', 'updated_at',
            'project_detail', 'sub_project_detail', 'created_by_detail', 'completed_by_detail'
        ]

    def get_assignees(self, obj):
        relationships = TaskAssignee.objects.filter(task=obj).select_related('user')
        users = [rel.user for rel in relationships]
        return UserSerializer(users, many=True, context=self.context).data

    def validate(self, data):
        # Validate Project-SubProject consistency
        project = data.get('project')
        sub_project = data.get('sub_project')
        if sub_project and project:
            if sub_project.project != project:
                raise serializers.ValidationError({
                    "sub_project": "The selected Sub-project does not belong to the selected Project."
                })
        
        # If updating sub_project and project is not in request but exists on instance
        if self.instance and sub_project and not project:
            p = project or self.instance.project
            if sub_project.project != p:
                raise serializers.ValidationError({
                    "sub_project": "The selected Sub-project does not belong to the task's Project."
                })

        return data

    def create(self, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', [])
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            
        task = Task.objects.create(**validated_data)
        
        # Create TaskAssignee relationships
        for uid in assignee_ids:
            try:
                user = User.objects.get(id=uid)
                TaskAssignee.objects.get_or_create(task=task, user=user)
            except User.DoesNotExist:
                pass
                
        return task

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', None)
        
        # Call super update
        instance = super().update(instance, validated_data)
        
        # If assignee_ids are updated
        if assignee_ids is not None:
            # Clear old assignees and insert new ones
            TaskAssignee.objects.filter(task=instance).delete()
            for uid in assignee_ids:
                try:
                    user = User.objects.get(id=uid)
                    TaskAssignee.objects.get_or_create(task=instance, user=user)
                except User.DoesNotExist:
                    pass
                    
        return instance
