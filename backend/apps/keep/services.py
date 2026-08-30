from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from apps.keep.models import KeepItem, KeepPermission, KeepAuditLog, KeepRecentItem

def get_user_organization(user):
    """Retrieve user's primary organization membership."""
    if hasattr(user, 'memberships') and user.memberships.exists():
        return user.memberships.first().organization
    return None


def get_ancestors(item: KeepItem) -> list[KeepItem]:
    """Retrieve list of parent folders from immediate parent up to root."""
    ancestors = []
    curr = item.parent_folder
    visited = set()
    while curr is not None and curr.id not in visited:
        visited.add(curr.id)
        ancestors.append(curr)
        curr = curr.parent_folder
    return ancestors


def check_item_access(user, item: KeepItem, required_role: str = 'VIEW') -> bool:
    """
    Evaluates effective server-side access for a Keep item.
    Precedence: Owner -> Org Boundary -> Admin Policy -> Direct Permission -> Inherited Folder Permission.
    """
    if not user or not user.is_authenticated:
        return False

    # 1. Owner always has full access (unless soft-deleted in normal views, handled separately)
    if item.owner_id == user.id or item.created_by_id == user.id:
        return True

    # 2. Strict Organization Boundary Check
    user_org = get_user_organization(user)
    if item.organization_id and user_org and item.organization_id != user_org.id:
        return False

    is_admin = getattr(user, 'role', 'MEMBER') == 'ADMIN'

    # Check direct permissions on the item
    direct_perms = KeepPermission.objects.filter(item=item)

    for perm in direct_perms:
        if perm.user_id == user.id:
            if required_role == 'VIEW' or perm.role == 'EDIT':
                return True
        if perm.access_level == 'EVERYONE':
            if required_role == 'VIEW' or perm.role == 'EDIT':
                return True
        elif perm.access_level == 'YOU_AND_ADMINS':
            if is_admin:
                if required_role == 'VIEW' or perm.role == 'EDIT':
                    return True

    # Check inherited ancestor folder permissions
    ancestors = get_ancestors(item)
    for ancestor in ancestors:
        if ancestor.owner_id == user.id:
            return True
        anc_perms = KeepPermission.objects.filter(item=ancestor)
        for perm in anc_perms:
            if perm.user_id == user.id:
                if required_role == 'VIEW' or perm.role == 'EDIT':
                    return True
            if perm.access_level == 'EVERYONE':
                if required_role == 'VIEW' or perm.role == 'EDIT':
                    return True
            elif perm.access_level == 'YOU_AND_ADMINS' and is_admin:
                if required_role == 'VIEW' or perm.role == 'EDIT':
                    return True

    # Admin global access policy for organization scope
    if is_admin and item.organization_id and user_org and item.organization_id == user_org.id:
        return True

    return False


def validate_folder_movement(item: KeepItem, new_parent: KeepItem | None):
    """Prevents circular folder references, moving folder into itself or its descendants."""
    if not new_parent:
        return

    if item.id == new_parent.id:
        raise ValidationError("A folder cannot be moved into itself.")

    ancestors = get_ancestors(new_parent)
    if any(anc.id == item.id for anc in ancestors):
        raise ValidationError("A folder cannot be moved into one of its descendants.")


@transaction.atomic
def duplicate_keep_item(user, item: KeepItem, new_parent: KeepItem | None = None) -> KeepItem:
    """Recursively duplicates KeepItem and its descendants."""
    target_parent = new_parent if new_parent is not None else item.parent_folder
    
    new_item = KeepItem.objects.create(
        item_type=item.item_type,
        name=f"Copy of {item.name}" if new_parent is None else item.name,
        version=1,
        owner=user,
        organization=item.organization,
        parent_folder=target_parent,
        document_content=item.document_content,
        spreadsheet_data=item.spreadsheet_data,
        original_import_filename=item.original_import_filename,
        original_import_format=item.original_import_format,
        imported_by=item.imported_by,
        imported_at=item.imported_at,
        import_warnings=item.import_warnings,
        is_deleted=False,
        deleted_at=None,
        created_by=user,
        updated_by=user,
    )

    if item.item_type == 'FOLDER':
        children = KeepItem.objects.filter(parent_folder=item, is_deleted=False)
        for child in children:
            duplicate_keep_item(user, child, new_parent=new_item)

    log_audit_event(user, new_item, 'DUPLICATE', f"Duplicated from '{item.name}'")
    return new_item


def log_audit_event(user, item: KeepItem | None, action: str, description: str):
    """Records audit activity log entry."""
    org = item.organization if item else (get_user_organization(user) if user else None)
    KeepAuditLog.objects.create(
        item=item,
        organization=org,
        user=user if user and user.is_authenticated else None,
        action=action,
        description=description
    )


def record_item_opened(user, item: KeepItem):
    """Updates KeepRecentItem for user when item is opened."""
    if user and user.is_authenticated and not item.is_deleted:
        KeepRecentItem.objects.update_or_create(
            user=user,
            item=item,
            defaults={'last_opened_at': None} # auto_now will touch timestamp
        )
