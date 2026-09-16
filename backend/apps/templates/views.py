from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Industry, ProjectTemplate
from .serializers import (
    IndustrySerializer,
    ProjectTemplateListSerializer,
    ProjectTemplateDetailSerializer,
)
from .services import TemplateProjectService
from apps.projects.serializers import ProjectSerializer


class IndustryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Industry.objects.filter(is_active=True)
    serializer_class = IndustrySerializer
    permission_classes = [permissions.IsAuthenticated]


class ProjectTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProjectTemplate.objects.filter(is_active=True).select_related('industry').prefetch_related('tasks__subtasks')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProjectTemplateDetailSerializer
        return ProjectTemplateListSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        # Industry filter
        industry_param = self.request.query_params.get('industry')
        if industry_param:
            qs = qs.filter(
                Q(industry_id=industry_param) | Q(industry__name__iexact=industry_param)
            )

        # Case-insensitive search across template name, description, industry name, task names, subtask names
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            qs = qs.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(industry__name__icontains=search_query) |
                Q(tasks__name__icontains=search_query) |
                Q(tasks__subtasks__name__icontains=search_query)
            ).distinct()

        return qs

    @action(detail=True, methods=['post'], url_path='create-project')
    def create_project(self, request, pk=None):
        template = self.get_object()
        project = TemplateProjectService.create_project_from_template(
            template=template,
            payload=request.data,
            user=request.user,
        )
        serializer = ProjectSerializer(project, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
