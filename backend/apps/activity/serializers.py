from rest_framework import serializers
from .models import ActivityLog
from apps.accounts.serializers import UserSerializer

class ActivityLogSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'user_detail', 'action', 'entity_type', 'entity_id', 'description', 'created_at']
        read_only_fields = ['id', 'user', 'action', 'entity_type', 'entity_id', 'description', 'created_at']
