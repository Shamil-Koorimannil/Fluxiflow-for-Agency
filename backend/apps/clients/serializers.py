from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Client, ClientBrandAsset, ClientBrandAssetFolder

class ClientBrandAssetFolderSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = ClientBrandAssetFolder
        fields = [
            'id', 'client', 'organization', 'name', 'parent', 'parent_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'organization', 'created_by', 'created_at', 'updated_at']

    def validate_name(self, value):
        trimmed = value.strip() if value else ''
        if not trimmed:
            raise serializers.ValidationError('Folder name cannot be empty or whitespace only.')
        return trimmed

    def validate(self, attrs):
        client = attrs.get('client') or (self.instance.client if self.instance else None)
        parent = attrs.get('parent') if 'parent' in attrs else (self.instance.parent if self.instance else None)
        name = attrs.get('name') if 'name' in attrs else (self.instance.name if self.instance else None)

        if parent:
            if client and parent.client_id != client.id:
                raise serializers.ValidationError({'parent': 'Parent folder must belong to the same client.'})
            if self.instance and parent.id == self.instance.id:
                raise serializers.ValidationError({'parent': 'A folder cannot be its own parent.'})
            
            curr = parent
            while curr:
                if self.instance and curr.id == self.instance.id:
                    raise serializers.ValidationError({'parent': 'Cannot set parent to a descendant folder (cycle detected).'})
                curr = curr.parent

        if client and name:
            qs = ClientBrandAssetFolder.objects.filter(client=client, parent=parent, name__iexact=name)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'name': 'A folder with this name already exists in this directory.'})

        return attrs


class ClientBrandAssetSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ClientBrandAsset
        fields = [
            'id', 'client', 'organization', 'folder', 'folder_name', 'name',
            'file', 'file_url', 'asset_type', 'description', 'file_size', 'file_type',
            'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'organization', 'file_size', 'file_type', 'uploaded_by', 'created_at', 'updated_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class ClientSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.name', read_only=True)
    projects_count = serializers.SerializerMethodField()
    brand_assets_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'organization', 'name', 'company_name', 'email', 'phone',
            'website', 'address', 'city', 'state', 'country', 'description',
            'notes', 'status', 'created_by', 'created_by_name', 'updated_by',
            'updated_by_name', 'created_at', 'updated_at', 'projects_count',
            'brand_assets_count'
        ]
        read_only_fields = ['id', 'organization', 'created_by', 'updated_by', 'created_at', 'updated_at']

    def get_projects_count(self, obj):
        return obj.projects.count()

    def get_brand_assets_count(self, obj):
        return obj.brand_assets.count()

