from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """
    Allows access only to Admin/Manager users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'

class IsAdminOrReadOnlyMember(permissions.BasePermission):
    """
    Allows read-only access to Members, full access to Admins.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == 'ADMIN':
            return True
        # Read-only methods allowed for Members
        return request.method in permissions.SAFE_METHODS
