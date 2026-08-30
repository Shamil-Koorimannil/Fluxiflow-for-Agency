from rest_framework import serializers
from .models import Client, ClientBrandAsset

class ClientBrandAssetSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ClientBrandAsset
        fields = [
            'id', 'client', 'organization', 'name', 'file', 'file_url',
            'asset_type', 'description', 'file_size', 'file_type',
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
