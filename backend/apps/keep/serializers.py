from rest_framework import serializers
from apps.keep.models import KeepItem, KeepPermission, KeepShareLink, KeepVersionHistory, KeepAuditLog, KeepUserPin
from apps.accounts.serializers import UserSerializer

class KeepItemSerializer(serializers.ModelSerializer):
    is_pinned = serializers.SerializerMethodField()
    owner_name = serializers.ReadOnlyField(source='owner.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.name')
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = KeepItem
        fields = [
            'id', 'item_type', 'name', 'version', 'owner', 'owner_name',
            'organization', 'parent_folder', 'document_content', 'spreadsheet_data',
            'file', 'file_url', 'file_size', 'file_type', 'original_filename',
            'original_import_filename', 'original_import_format', 'imported_by',
            'imported_at', 'import_warnings', 'is_deleted', 'deleted_at',
            'created_by', 'created_by_name', 'updated_by', 'created_at', 'updated_at',
            'is_pinned'
        ]
        read_only_fields = ['id', 'version', 'owner', 'created_by', 'updated_by', 'created_at', 'updated_at', 'imported_at', 'file_size', 'file_type']
        extra_kwargs = {
            'item_type': {'required': False}
        }

    def get_is_pinned(self, obj) -> bool:
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return KeepUserPin.objects.filter(user=request.user, item=obj).exists()
        return False

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class KeepPermissionSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_name = serializers.ReadOnlyField(source='user.name')

    class Meta:
        model = KeepPermission
        fields = ['id', 'item', 'user', 'user_email', 'user_name', 'access_level', 'role', 'created_at']
        read_only_fields = ['id', 'created_at']


class KeepShareLinkSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.name')

    class Meta:
        model = KeepShareLink
        fields = ['id', 'item', 'token', 'permission', 'is_active', 'expires_at', 'created_by', 'created_by_name', 'created_at', 'revoked_at']
        read_only_fields = ['id', 'token', 'created_by', 'created_at']


class KeepVersionHistorySerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.name')

    class Meta:
        model = KeepVersionHistory
        fields = ['id', 'item', 'author', 'author_name', 'version_number', 'content_snapshot', 'spreadsheet_snapshot', 'created_at']
        read_only_fields = ['id', 'created_at']


class KeepAuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')
    item_name = serializers.ReadOnlyField(source='item.name')

    class Meta:
        model = KeepAuditLog
        fields = ['id', 'item', 'item_name', 'user', 'user_name', 'action', 'description', 'timestamp']
        read_only_fields = ['id', 'timestamp']
