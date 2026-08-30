from rest_framework import permissions

class IsAdminUserRole(permissions.BasePermission):
    """
    V1 Permission policy: Admin users have full access to Clients and Brand Assets.
    Members are restricted in V1.
    Centralized capability check for easy future enablement.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # V1 Admin-only access restriction
        return getattr(request.user, 'role', None) == 'ADMIN'

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) != 'ADMIN':
            return False
        
        # Enforce organization boundary
        user_org = request.user.memberships.first().organization if request.user.memberships.exists() else None
        if not user_org:
            return False
        return getattr(obj, 'organization_id', None) == user_org.id
