from rest_framework import views, permissions, status
from rest_framework.response import Response
from .models import ActivityLog
from .serializers import ActivityLogSerializer

class ActivityLogListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        if not is_admin_or_org_admin(request.user):
            return Response({"detail": "Only Admins can view activity logs."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response([], status=status.HTTP_200_OK)

        member_ids = active_org.memberships.filter(is_active=True).values_list('user_id', flat=True)
        activities = ActivityLog.objects.filter(user_id__in=member_ids).order_by('-created_at')
        serializer = ActivityLogSerializer(activities, many=True, context={'request': request})
        return Response(serializer.data)
