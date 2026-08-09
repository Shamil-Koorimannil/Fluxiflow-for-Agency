from rest_framework import views, permissions
from rest_framework.response import Response
from django.db.models import Q
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer

class GlobalSearchView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({"tasks": [], "projects": []})

        user = request.user
        
        # 1. Search projects (all users can view project information in V1)
        projects = Project.objects.filter(
            Q(name__icontains=q) | Q(description__icontains=q)
        ).distinct()

        # 2. Search tasks (respecting role-based assignments)
        if user.role == 'ADMIN':
            tasks = Task.objects.filter(
                Q(name__icontains=q) | 
                Q(description__icontains=q) | 
                Q(assignee_relationships__user__name__icontains=q)
            ).distinct()
        else:
            # Member can only search their assigned tasks
            tasks = Task.objects.filter(
                assignee_relationships__user=user
            ).filter(
                Q(name__icontains=q) | 
                Q(description__icontains=q)
            ).distinct()

        context = {'request': request}
        
        return Response({
            "tasks": TaskSerializer(tasks, many=True, context=context).data,
            "projects": ProjectSerializer(projects, many=True, context=context).data
        })
