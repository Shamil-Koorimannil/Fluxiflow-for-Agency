from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Project, ProjectMember, SubProject
from .serializers import ProjectSerializer, SubProjectSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog

class ProjectViewSet(viewsets.ModelSerializerViewSet if hasattr(viewsets, 'ModelSerializerViewSet') else viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnlyMember]

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        # Create ProjectMember for the creator automatically
        ProjectMember.objects.get_or_create(project=project, user=self.request.user)
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

    @action(detail=True, methods=['GET', 'POST'], permission_classes=[IsAdminOrReadOnlyMember])
    def subprojects(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            subprojects = SubProject.objects.filter(project=project)
            serializer = SubProjectSerializer(subprojects, many=True, context={'request': request})
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Create subproject - block non-admin
            if request.user.role != 'ADMIN':
                return Response({"detail": "Only Admins can create sub-projects."}, status=status.HTTP_403_FORBIDDEN)
                
            serializer = SubProjectSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                subproject = serializer.save(project=project, created_by=request.user)
                # Log activity
                ActivityLog.objects.create(
                    user=request.user,
                    action='SUBPROJECT_CREATED',
                    entity_type='SubProject',
                    entity_id=subproject.id,
                    description=f"{request.user.name} created sub-project '{subproject.name}' in project '{project.name}'."
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SubProjectViewSet(viewsets.ModelViewSet):
    queryset = SubProject.objects.all()
    serializer_class = SubProjectSerializer
    permission_classes = [IsAdminOrReadOnlyMember]

    def perform_update(self, serializer):
        subproject = serializer.save()
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_UPDATED',  # Or define SUBPROJECT_UPDATED if needed, we'll map to PROJECT_UPDATED
            entity_type='SubProject',
            entity_id=subproject.id,
            description=f"{self.request.user.name} updated sub-project '{subproject.name}'."
        )

    def perform_destroy(self, instance):
        subproject_id = instance.id
        subproject_name = instance.name
        instance.delete()
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_DELETED',
            entity_type='SubProject',
            entity_id=subproject_id,
            description=f"{self.request.user.name} deleted sub-project '{subproject_name}'."
        )
