from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """
    Allows access only to Admin/Manager users or Organization Admins.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        from apps.accounts.tenant_context import is_admin_or_org_admin
        return is_admin_or_org_admin(request.user, request=request)

class IsAdminOrReadOnlyMember(permissions.BasePermission):
    """
    Allows read-only access to Members, full access to Admins/OrgAdmins.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        from apps.accounts.tenant_context import is_admin_or_org_admin
        if is_admin_or_org_admin(request.user, request=request):
            return True
        return request.method in permissions.SAFE_METHODS
