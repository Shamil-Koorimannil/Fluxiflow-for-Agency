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
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        active_org = get_active_organization(user, request=request)
        if not active_org:
            return Response({"tasks": [], "projects": []})

        is_admin = is_admin_or_org_admin(user, request=request)

        # 1. Search projects (scoped to active organization)
        projects = Project.objects.filter(
            organization=active_org
        ).filter(
            Q(name__icontains=q) | Q(description__icontains=q)
        ).distinct()

        # 2. Search tasks (scoped to active organization and user access)
        if is_admin:
            tasks = Task.objects.filter(
                organization=active_org
            ).filter(
                Q(name__icontains=q) | 
                Q(description__icontains=q) | 
                Q(assignee_relationships__user__name__icontains=q)
            ).distinct()
        else:
            # Member can search tasks in active org where they are assigned
            tasks = Task.objects.filter(
                organization=active_org,
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
