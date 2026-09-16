from rest_framework import serializers
from .models import Industry, ProjectTemplate, TemplateTask, TemplateSubTask


class IndustrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Industry
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']


class TemplateSubTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateSubTask
        fields = ['id', 'name', 'description', 'position']


class TemplateTaskSerializer(serializers.ModelSerializer):
    subtasks = TemplateSubTaskSerializer(many=True, read_only=True)

    class Meta:
        model = TemplateTask
        fields = ['id', 'name', 'description', 'position', 'priority', 'subtasks']


class ProjectTemplateListSerializer(serializers.ModelSerializer):
    industry_name = serializers.CharField(source='industry.name', read_only=True)
    task_count = serializers.SerializerMethodField()
    subtask_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectTemplate
        fields = [
            'id',
            'industry',
            'industry_name',
            'name',
            'description',
            'icon',
            'is_active',
            'task_count',
            'subtask_count',
            'created_at',
            'updated_at',
        ]

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_subtask_count(self, obj):
        return TemplateSubTask.objects.filter(template_task__template=obj).count()


class ProjectTemplateDetailSerializer(serializers.ModelSerializer):
    industry_name = serializers.CharField(source='industry.name', read_only=True)
    task_count = serializers.SerializerMethodField()
    subtask_count = serializers.SerializerMethodField()
    tasks = TemplateTaskSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectTemplate
        fields = [
            'id',
            'industry',
            'industry_name',
            'name',
            'description',
            'icon',
            'is_active',
            'task_count',
            'subtask_count',
            'tasks',
            'created_at',
            'updated_at',
        ]

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_subtask_count(self, obj):
        return TemplateSubTask.objects.filter(template_task__template=obj).count()
