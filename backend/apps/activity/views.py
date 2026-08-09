from rest_framework import views, permissions
from rest_framework.response import Response
from .models import ActivityLog
from .serializers import ActivityLogSerializer
from apps.core.permissions import IsAdmin

class ActivityLogListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        activities = ActivityLog.objects.all().order_by('-created_at')
        serializer = ActivityLogSerializer(activities, many=True, context={'request': request})
        return Response(serializer.data)
