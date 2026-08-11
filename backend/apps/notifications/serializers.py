from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    related_task_name = serializers.ReadOnlyField(source='related_task.name')
    related_project_name = serializers.ReadOnlyField(source='related_project.name')
    related_project_id = serializers.ReadOnlyField(source='related_project.id')
    related_user_name = serializers.ReadOnlyField(source='related_user.name')

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'type', 'title', 'message', 
            'related_task', 'related_task_name',
            'related_project', 'related_project_id', 'related_project_name',
            'related_user', 'related_user_name',
            'is_read', 'created_at', 'read_at'
        ]
        read_only_fields = fields
