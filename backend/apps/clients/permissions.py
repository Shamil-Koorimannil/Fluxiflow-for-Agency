from rest_framework import permissions
from apps.accounts.tenant_context import is_admin_or_org_admin, get_active_organization

class IsAdminUserRole(permissions.BasePermission):
    """
    Permission policy: Admin and OrgAdmin users have full access to Clients and Brand Assets in active organization.
    Members are restricted.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return is_admin_or_org_admin(request.user, request=request)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if not is_admin_or_org_admin(request.user, request=request):
            return False
        
        active_org = get_active_organization(request.user, request=request)
        if not active_org:
            return False
        return getattr(obj, 'organization_id', None) == active_org.id

