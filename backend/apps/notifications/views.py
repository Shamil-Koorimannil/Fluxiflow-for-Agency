from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination
from .models import Notification
from .serializers import NotificationSerializer
from .services import NotificationService

class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user, request=self.request)
        if not active_org:
            return Notification.objects.none()

        # Trigger dynamic deadline-based notification checks before listing
        NotificationService.check_and_create_deadline_notifications(user)
        return Notification.objects.filter(recipient=user, organization=active_org).order_by('-created_at')

    def perform_destroy(self, instance):
        if instance.recipient != self.request.user:
            raise PermissionDenied("You cannot delete another user's notifications.")
        instance.delete()

    @action(detail=True, methods=['POST'])
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.recipient != request.user:
            raise PermissionDenied("You cannot access another user's notifications.")
        
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=['POST'], url_path='mark-all-read')
    def mark_all_read(self, request):
        user = request.user
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user, request=request)
        if not active_org:
            return Response({"detail": "No active organization."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark all of this user's unread notifications as read within active_org
        Notification.objects.filter(recipient=user, organization=active_org, is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({"detail": "All notifications marked as read."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['GET'], url_path='unread-count')
    def unread_count(self, request):
        user = request.user
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user, request=request)
        if not active_org:
            return Response({"count": 0})

        # Trigger deadline checks to ensure count is updated in real-time
        NotificationService.check_and_create_deadline_notifications(user)
        count = Notification.objects.filter(recipient=user, organization=active_org, is_read=False).count()
        return Response({"count": count})
