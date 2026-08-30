from rest_framework import permissions
from apps.keep.services import check_item_access

class IsKeepItemAuthorized(permissions.BasePermission):
    """DRF permission enforcing Keep server-side authorization."""
    
    def has_object_permission(self, request, view, obj):
        required_role = 'VIEW' if request.method in permissions.SAFE_METHODS else 'EDIT'
        return check_item_access(request.user, obj, required_role=required_role)
