import os
import secrets
import mimetypes
from django.utils import timezone
from django.db import transaction
from django.http import HttpResponse, FileResponse, Http404
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from apps.keep.models import KeepItem, KeepUserPin, KeepRecentItem, KeepPermission, KeepShareLink, KeepVersionHistory, KeepAuditLog
from apps.keep.serializers import (
    KeepItemSerializer, KeepPermissionSerializer, KeepShareLinkSerializer,
    KeepVersionHistorySerializer, KeepAuditLogSerializer
)
from apps.keep.permissions import IsKeepItemAuthorized
from apps.keep.services import (
    check_item_access, get_user_organization, validate_folder_movement,
    duplicate_keep_item, log_audit_event, record_item_opened
)
from apps.keep.sanitizer import sanitize_html
from apps.keep.excel_importer import import_spreadsheet_file, SpreadsheetImportError
from apps.keep.excel_exporter import export_to_xlsx, export_to_csv
from django.contrib.auth import get_user_model

User = get_user_model()

class KeepItemViewSet(viewsets.ModelViewSet):
    serializer_class = KeepItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsKeepItemAuthorized]
    format_kwarg = None

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return KeepItem.objects.none()

        active_org = get_user_organization(user)
        if not active_org:
            return KeepItem.objects.none()

        base_qs = KeepItem.objects.filter(organization=active_org)

        section = self.request.query_params.get('section', 'all')
        parent_folder_id = self.request.query_params.get('parent_folder')

        if section == 'trash':
            qs = base_qs.filter(is_deleted=True)
            accessible_ids = [item.id for item in qs if check_item_access(user, item, 'VIEW')]
            return base_qs.filter(id__in=accessible_ids)

        if section == 'pinned':
            pinned_item_ids = KeepUserPin.objects.filter(user=user).values_list('item_id', flat=True)
            qs = base_qs.filter(id__in=pinned_item_ids, is_deleted=False)
            accessible_ids = [item.id for item in qs if check_item_access(user, item, 'VIEW')]
            return base_qs.filter(id__in=accessible_ids)

        if section == 'recent':
            recent_item_ids = KeepRecentItem.objects.filter(user=user).values_list('item_id', flat=True)
            qs = base_qs.filter(id__in=recent_item_ids, is_deleted=False)
            accessible_ids = [item.id for item in qs if check_item_access(user, item, 'VIEW')]
            return base_qs.filter(id__in=accessible_ids)

        if section == 'shared':
            qs = base_qs.filter(is_deleted=False).exclude(owner=user)
            accessible_ids = [item.id for item in qs if check_item_access(user, item, 'VIEW')]
            return base_qs.filter(id__in=accessible_ids)

        qs = base_qs.filter(is_deleted=False)
        if parent_folder_id:
            if parent_folder_id == 'root':
                qs = qs.filter(parent_folder__isnull=True)
            else:
                qs = qs.filter(parent_folder_id=parent_folder_id)

        accessible_ids = [item.id for item in qs if check_item_access(user, item, 'VIEW')]
        return KeepItem.objects.filter(id__in=accessible_ids)

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        pk = self.kwargs[lookup_url_kwarg]
        org = get_user_organization(self.request.user)
        try:
            obj = KeepItem.objects.get(pk=pk, organization=org)
        except KeepItem.DoesNotExist:
            raise Http404("No KeepItem matches the given query.")
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        user = self.request.user
        org = get_user_organization(user)
        doc_content = serializer.validated_data.get('document_content', '')
        if doc_content:
            doc_content = sanitize_html(doc_content)

        item = serializer.save(
            owner=user,
            created_by=user,
            organization=org,
            document_content=doc_content,
            version=1
        )
        log_audit_event(user, item, 'CREATE', f"Created {item.item_type.lower()} '{item.name}'")

    def retrieve(self, request, *args, **kwargs):
        item = self.get_object()
        record_item_opened(request.user, item)
        serializer = self.get_serializer(item)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        item = self.get_object()

        # Optimistic concurrency check
        client_version = request.data.get('version')
        if client_version is not None:
            try:
                client_version = int(client_version)
                if client_version != item.version:
                    return Response(
                        {"detail": "This item was updated by someone else. Refresh before continuing."},
                        status=status.HTTP_409_CONFLICT
                    )
            except ValueError:
                pass

        serializer = self.get_serializer(item, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        doc_content = serializer.validated_data.get('document_content')
        if doc_content is not None:
            doc_content = sanitize_html(doc_content)
            serializer.validated_data['document_content'] = doc_content
            # Sync text file content on disk if attached
            if item.file and os.path.exists(item.file.path):
                ext = (item.original_filename or '').rsplit('.', 1)[-1].lower() if '.' in (item.original_filename or '') else ''
                text_exts = {'txt', 'md', 'rtf', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sh', 'yml', 'yaml'}
                if ext in text_exts or (item.file_type and item.file_type.startswith('text/')):
                    try:
                        with open(item.file.path, 'w', encoding='utf-8') as f:
                            f.write(doc_content)
                        item.file_size = os.path.getsize(item.file.path)
                        item.save(update_fields=['file_size'])
                    except Exception:
                        pass

        serializer.validated_data['version'] = item.version + 1
        serializer.validated_data['updated_by'] = request.user

        updated_item = serializer.save()

        # Snapshot version for documents/notes on explicit milestone or larger saves
        if updated_item.item_type in ['DOCUMENT', 'NOTE', 'SPREADSHEET', 'FILE'] and request.data.get('create_snapshot'):
            KeepVersionHistory.objects.create(
                item=updated_item,
                author=request.user,
                version_number=updated_item.version,
                content_snapshot=updated_item.document_content,
                spreadsheet_snapshot=updated_item.spreadsheet_data
            )

        log_audit_event(request.user, updated_item, 'EDIT', f"Edited {updated_item.item_type.lower()} '{updated_item.name}'")
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()

        @transaction.atomic
        def soft_delete_recursive(target_item):
            target_item.is_deleted = True
            target_item.deleted_at = timezone.now()
            target_item.save()
            for child in KeepItem.objects.filter(parent_folder=target_item, is_deleted=False):
                soft_delete_recursive(child)

        soft_delete_recursive(item)
        log_audit_event(request.user, item, 'DELETE', f"Moved '{item.name}' to Trash")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        item = self.get_object()

        # Parent folder check: if parent is deleted or missing, restore to root
        if item.parent_folder and item.parent_folder.is_deleted:
            item.parent_folder = None

        @transaction.atomic
        def restore_recursive(target_item):
            target_item.is_deleted = False
            target_item.deleted_at = None
            target_item.save()
            for child in KeepItem.objects.filter(parent_folder=target_item, is_deleted=True):
                restore_recursive(child)

        restore_recursive(item)
        log_audit_event(request.user, item, 'RESTORE', f"Restored '{item.name}' from Trash")
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['delete'], url_path='permanent_delete')
    def permanent_delete(self, request, pk=None):
        item = self.get_object()
        
        # Cleanup associated records
        KeepUserPin.objects.filter(item=item).delete()
        KeepRecentItem.objects.filter(item=item).delete()
        KeepPermission.objects.filter(item=item).delete()
        KeepShareLink.objects.filter(item=item).delete()
        KeepVersionHistory.objects.filter(item=item).delete()
        KeepAuditLog.objects.filter(item=item).delete()

        log_audit_event(request.user, None, 'PERMANENT_DELETE', f"Permanently deleted '{item.name}'")
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='pin')
    def pin(self, request, pk=None):
        item = self.get_object()
        KeepUserPin.objects.get_or_create(user=request.user, item=item)
        log_audit_event(request.user, item, 'PIN', f"Pinned '{item.name}'")
        return Response({'status': 'pinned'})

    @action(detail=True, methods=['post'], url_path='unpin')
    def unpin(self, request, pk=None):
        item = self.get_object()
        KeepUserPin.objects.filter(user=request.user, item=item).delete()
        log_audit_event(request.user, item, 'UNPIN', f"Unpinned '{item.name}'")
        return Response({'status': 'unpinned'})

    @action(detail=True, methods=['post'], url_path='move')
    def move(self, request, pk=None):
        item = self.get_object()
        new_parent_id = request.data.get('parent_folder')
        
        if new_parent_id:
            try:
                new_parent = KeepItem.objects.get(id=new_parent_id)
                validate_folder_movement(item, new_parent)
                item.parent_folder = new_parent
            except Exception as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            item.parent_folder = None

        item.save()
        log_audit_event(request.user, item, 'MOVE', f"Moved '{item.name}'")
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        item = self.get_object()
        new_item = duplicate_keep_item(request.user, item)
        return Response(self.get_serializer(new_item).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='upload_file')
    def upload_file(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        parent_folder_id = request.data.get('parent_folder')
        parent_folder = None
        if parent_folder_id and parent_folder_id != 'root':
            try:
                parent_folder = KeepItem.objects.get(id=parent_folder_id)
            except KeepItem.DoesNotExist:
                pass

        user = request.user
        org = get_user_organization(user)
        original_filename = file_obj.name
        file_size = file_obj.size
        file_type = file_obj.content_type or mimetypes.guess_type(original_filename)[0] or 'application/octet-stream'

        ext = ''
        if '.' in original_filename:
            ext = original_filename.rsplit('.', 1)[1].lower()

        doc_content = ''
        text_extensions = {'txt', 'md', 'rtf', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sh', 'yml', 'yaml'}
        if ext in text_extensions or file_type.startswith('text/'):
            try:
                raw_bytes = file_obj.read()
                doc_content = raw_bytes.decode('utf-8', errors='ignore')
                file_obj.seek(0)
            except Exception:
                doc_content = ''

        item_name = request.data.get('name') or original_filename

        item = KeepItem.objects.create(
            item_type='FILE',
            name=item_name,
            version=1,
            owner=user,
            organization=org,
            parent_folder=parent_folder,
            file=file_obj,
            file_size=file_size,
            file_type=file_type,
            original_filename=original_filename,
            document_content=doc_content,
            created_by=user
        )

        log_audit_event(user, item, 'CREATE', f"Uploaded file '{original_filename}'")
        return Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        item = self.get_object()

        if not check_item_access(request.user, item, 'VIEW'):
            return Response({'detail': 'You do not have permission to access this item.'}, status=status.HTTP_403_FORBIDDEN)

        log_audit_event(request.user, item, 'DOWNLOAD', f"Downloaded '{item.name}'")

        # 1. Stored Binary File
        if item.file and os.path.exists(item.file.path):
            filename = item.original_filename or os.path.basename(item.file.name)
            mime_type = item.file_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            response = FileResponse(item.file.open('rb'), content_type=mime_type)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

        # 2. Spreadsheet item
        if item.item_type == 'SPREADSHEET':
            export_format = request.query_params.get('export_format') or request.query_params.get('format', 'xlsx')
            export_format = str(export_format).lower()
            sheet_id = request.query_params.get('sheet_id')
            if export_format == 'csv':
                content = export_to_csv(item.spreadsheet_data, sheet_id=sheet_id)
                filename = f"{item.name}.csv" if not item.name.endswith('.csv') else item.name
                response = HttpResponse(content, content_type='text/csv')
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                response['Access-Control-Expose-Headers'] = 'Content-Disposition'
                return response
            else:
                content = export_to_xlsx(item.spreadsheet_data)
                filename = f"{item.name}.xlsx" if not item.name.endswith('.xlsx') else item.name
                response = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                response['Access-Control-Expose-Headers'] = 'Content-Disposition'
                return response

        # 3. Document / Note / Text content
        filename = item.original_filename or item.name
        if '.' not in filename:
            filename = f"{filename}.txt"

        mime_type = item.file_type or mimetypes.guess_type(filename)[0] or 'text/plain; charset=utf-8'
        response = HttpResponse(item.document_content or '', content_type=mime_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['post'], url_path='upload_spreadsheet')
    def upload_spreadsheet(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No spreadsheet file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        parent_folder_id = request.data.get('parent_folder')
        parent_folder = None
        if parent_folder_id:
            parent_folder = KeepItem.objects.get(id=parent_folder_id)

        try:
            spreadsheet_data, warnings = import_spreadsheet_file(file_obj, file_obj.name)
        except SpreadsheetImportError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'detail': 'Unable to import this spreadsheet. The file may be damaged or unsupported.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        org = get_user_organization(user)
        filename_parts = file_obj.name.rsplit('.', 1)
        item_name = filename_parts[0] if filename_parts else file_obj.name
        ext = filename_parts[1].lower() if len(filename_parts) > 1 else ''

        item = KeepItem.objects.create(
            item_type='SPREADSHEET',
            name=item_name,
            version=1,
            owner=user,
            organization=org,
            parent_folder=parent_folder,
            spreadsheet_data=spreadsheet_data,
            original_import_filename=file_obj.name,
            original_import_format=ext,
            imported_by=user,
            imported_at=timezone.now(),
            import_warnings=warnings,
            created_by=user
        )

        log_audit_event(user, item, 'CREATE', f"Uploaded and imported spreadsheet '{file_obj.name}'")
        return Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='export')
    def export(self, request, pk=None):
        item = self.get_object()
        if item.item_type != 'SPREADSHEET':
            return Response({'detail': 'Only spreadsheets can be exported as XLSX/CSV.'}, status=status.HTTP_400_BAD_REQUEST)

        export_format = request.query_params.get('export_format') or request.query_params.get('format', 'xlsx')
        export_format = str(export_format).lower()
        sheet_id = request.query_params.get('sheet_id')

        log_audit_event(request.user, item, 'EXPORT', f"Exported '{item.name}' as {export_format.upper()}")

        if export_format == 'csv':
            content = export_to_csv(item.spreadsheet_data, sheet_id=sheet_id)
            response = HttpResponse(content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{item.name}.csv"'
            return response
        else:
            content = export_to_xlsx(item.spreadsheet_data)
            response = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{item.name}.xlsx"'
            return response

    @action(detail=True, methods=['get', 'post'])
    def permissions(self, request, pk=None):
        item = self.get_object()
        if request.method == 'GET':
            perms = KeepPermission.objects.filter(item=item)
            return Response(KeepPermissionSerializer(perms, many=True).data)

        # Set permission
        access_level = request.data.get('access_level', 'ONLY_ME')
        role = request.data.get('role', 'VIEW')
        target_email = request.data.get('email')

        target_user = None
        if target_email:
            user_org = get_user_organization(request.user)
            try:
                target_user = User.objects.get(email__iexact=target_email.strip())
                target_org = get_user_organization(target_user)
                if user_org and target_org and user_org.id != target_org.id:
                    return Response({'detail': 'User does not belong to your organization.'}, status=status.HTTP_400_BAD_REQUEST)
                access_level = 'SPECIFIC'
            except User.DoesNotExist:
                return Response({'detail': 'User with this email not found in organization.'}, status=status.HTTP_400_BAD_REQUEST)

        perm, created = KeepPermission.objects.update_or_create(
            item=item,
            user=target_user,
            defaults={'access_level': access_level, 'role': role}
        )

        log_audit_event(request.user, item, 'SHARE', f"Updated sharing settings for '{item.name}'")
        return Response(KeepPermissionSerializer(perm).data)

    @action(detail=True, methods=['delete'])
    def revoke_permission(self, request, pk=None):
        item = self.get_object()
        perm_id = request.query_params.get('permission_id')
        if perm_id:
            KeepPermission.objects.filter(id=perm_id, item=item).delete()
            log_audit_event(request.user, item, 'PERMISSION_REVOKE', f"Revoked permission on '{item.name}'")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post', 'delete'])
    def share_link(self, request, pk=None):
        item = self.get_object()
        if request.method == 'GET':
            links = KeepShareLink.objects.filter(item=item, is_active=True)
            return Response(KeepShareLinkSerializer(links, many=True).data)

        if request.method == 'POST':
            permission = request.data.get('permission', 'VIEW')
            token = secrets.token_urlsafe(32)
            link = KeepShareLink.objects.create(
                item=item,
                token=token,
                permission=permission,
                created_by=request.user
            )
            log_audit_event(request.user, item, 'SHARE_LINK_CREATE', f"Created share link for '{item.name}'")
            return Response(KeepShareLinkSerializer(link).data, status=status.HTTP_201_CREATED)

        if request.method == 'DELETE':
            KeepShareLink.objects.filter(item=item).update(is_active=False, revoked_at=timezone.now())
            log_audit_event(request.user, item, 'SHARE_LINK_REVOKE', f"Revoked share links for '{item.name}'")
            return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post'])
    def versions(self, request, pk=None):
        item = self.get_object()
        if request.method == 'GET':
            versions_qs = KeepVersionHistory.objects.filter(item=item)
            return Response(KeepVersionHistorySerializer(versions_qs, many=True).data)

        # Restore version
        version_id = request.data.get('version_id')
        if not version_id:
            return Response({'detail': 'version_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        version_obj = KeepVersionHistory.objects.get(id=version_id, item=item)
        
        KeepVersionHistory.objects.create(
            item=item,
            author=request.user,
            version_number=item.version,
            content_snapshot=item.document_content,
            spreadsheet_snapshot=item.spreadsheet_data
        )

        item.document_content = version_obj.content_snapshot
        item.spreadsheet_data = version_obj.spreadsheet_snapshot
        item.version += 1
        item.updated_by = request.user
        item.save()

        log_audit_event(request.user, item, 'VERSION_RESTORE', f"Restored version {version_obj.version_number} of '{item.name}'")
        return Response(self.get_serializer(item).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def keep_search(request):
    """Permission-aware search endpoint across authorized Keep items."""
    query = request.query_params.get('q', '').strip()
    if not query:
        return Response([])

    user = request.user
    org = get_user_organization(user)
    if not org:
        return Response([])

    qs = KeepItem.objects.filter(organization=org, is_deleted=False)

    results = []
    for item in qs:
        if check_item_access(user, item, 'VIEW'):
            if query.lower() in item.name.lower() or query.lower() in (item.document_content or '').lower():
                results.append(KeepItemSerializer(item, context={'request': request}).data)

    return Response(results)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def access_share_link(request, token):
    """Retrieves KeepItem via unguessable share token."""
    try:
        link = KeepShareLink.objects.get(token=token, is_active=True)
        if link.expires_at and timezone.now() > link.expires_at:
            return Response({'detail': 'This share link has expired.'}, status=status.HTTP_403_FORBIDDEN)
        
        item = link.item
        if item.is_deleted:
            return Response({'detail': 'This item has been deleted.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(KeepItemSerializer(item).data)
    except KeepShareLink.DoesNotExist:
        return Response({'detail': 'Invalid or expired share link.'}, status=status.HTTP_404_NOT_FOUND)
