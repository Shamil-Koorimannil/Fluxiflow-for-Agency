from rest_framework import views, permissions, status
from rest_framework.response import Response
from .models import ActivityLog
from .serializers import ActivityLogSerializer

class ActivityLogListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        if not is_admin_or_org_admin(request.user, request=request):
            return Response({"detail": "Only Admins can view activity logs."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user, request=request)
        if not active_org:
            return Response([], status=status.HTTP_200_OK)

        activities = ActivityLog.objects.filter(organization=active_org).order_by('-created_at')
        serializer = ActivityLogSerializer(activities, many=True, context={'request': request})
        return Response(serializer.data)
