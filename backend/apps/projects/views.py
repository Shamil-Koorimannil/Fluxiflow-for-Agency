from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Project
from .serializers import ProjectSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog

class ProjectViewSet(viewsets.ModelSerializerViewSet if hasattr(viewsets, 'ModelSerializerViewSet') else viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnlyMember]

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_CREATED',
            entity_type='Project',
            entity_id=project.id,
            description=f"{self.request.user.name} created project '{project.name}'."
        )

    def perform_update(self, serializer):
        project = serializer.save()
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_UPDATED',
            entity_type='Project',
            entity_id=project.id,
            description=f"{self.request.user.name} updated project '{project.name}'."
        )

    def perform_destroy(self, instance):
        project_id = instance.id
        project_name = instance.name
        instance.delete()
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_DELETED',
            entity_type='Project',
            entity_id=project_id,
            description=f"{self.request.user.name} deleted project '{project_name}'."
        )


