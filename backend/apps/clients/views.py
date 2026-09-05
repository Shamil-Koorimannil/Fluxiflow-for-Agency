import os
import mimetypes
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.db.models import Q

from .models import Client, ClientBrandAsset, ClientBrandAssetFolder, ClientStatus, AssetType
from .serializers import ClientSerializer, ClientBrandAssetSerializer, ClientBrandAssetFolderSerializer
from .permissions import IsAdminUserRole
from apps.projects.serializers import ProjectSerializer
from apps.activity.models import ActivityLog

# Disallowed executable/script extensions for upload safety
FORBIDDEN_EXTENSIONS = {
    '.exe', '.sh', '.bat', '.cmd', '.py', '.php', '.js', '.html', '.htm',
    '.dll', '.so', '.dylib', '.jar', '.vbs', '.ps1', '.cgi', '.pl'
}

def validate_uploaded_file(file_obj):
    filename = file_obj.name.lower()
    ext = os.path.splitext(filename)[1]

    if ext in FORBIDDEN_EXTENSIONS:
        raise ValueError(f"File extension '{ext}' is not allowed for security reasons.")

    # Max size 50 MB
    if file_obj.size > 50 * 1024 * 1024:
        raise ValueError("File size exceeds the 50 MB limit.")

    return True


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Client.objects.none()

        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        if not is_admin_or_org_admin(user):
            return Client.objects.none()

        active_org = get_active_organization(user)
        if not active_org:
            return Client.objects.none()

        qs = Client.objects.filter(organization=active_org)

        # Search filter
        search_query = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search_query:
            qs = qs.filter(
                Q(name__icontains=search_query) |
                Q(company_name__icontains=search_query) |
                Q(email__icontains=search_query)
            )

        # Status filter
        status_param = self.request.query_params.get('status')
        if status_param in [ClientStatus.ACTIVE, ClientStatus.INACTIVE]:
            qs = qs.filter(status=status_param)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user)
        client = serializer.save(
            organization=active_org,
            created_by=user,
            updated_by=user
        )

        ActivityLog.objects.create(
            user=user,
            organization=active_org,
            action='PROFILE_UPDATED',
            entity_type='Client',
            entity_id=client.id,
            description=f"Created client '{client.name}'"
        )

    def perform_update(self, serializer):
        user = self.request.user
        client = serializer.save(updated_by=user)

        ActivityLog.objects.create(
            user=user,
            organization=client.organization,
            action='PROFILE_UPDATED',
            entity_type='Client',
            entity_id=client.id,
            description=f"Updated client '{client.name}'"
        )

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        project_count = client.projects.count()

        if project_count > 0:
            return Response(
                {"detail": f"This client has {project_count} projects. You cannot delete the client until the projects are reassigned or the client is archived."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ActivityLog.objects.create(
            user=request.user,
            organization=client.organization,
            action='PROFILE_UPDATED',
            entity_type='Client',
            entity_id=client.id,
            description=f"Deleted client '{client.name}'"
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def projects(self, request, pk=None):
        client = self.get_object()
        projects_qs = client.projects.filter(organization=client.organization)

        # Status filter: ongoing vs completed
        status_param = request.query_params.get('status')
        if status_param:
            status_lower = status_param.lower()
            filtered = []
            for p in projects_qs:
                total_tasks = p.tasks.count()
                progress = round((p.tasks.filter(status='COMPLETED').count() / total_tasks) * 100) if total_tasks > 0 else None
                is_completed = progress is not None and progress >= 100
                if status_lower == 'completed' and is_completed:
                    filtered.append(p.id)
                elif status_lower == 'ongoing' and not is_completed:
                    filtered.append(p.id)
            projects_qs = projects_qs.filter(id__in=filtered)

        # Date filtering (month / year)
        month_param = request.query_params.get('month')
        year_param = request.query_params.get('year')
        if month_param is not None and month_param != '':
            try:
                m_val = int(month_param)
                if 0 <= m_val <= 11:
                    projects_qs = projects_qs.filter(Q(project_date__month=m_val) | Q(project_date__month=m_val + 1))
                else:
                    projects_qs = projects_qs.filter(project_date__month=m_val)
            except ValueError:
                pass
        if year_param is not None and year_param != '':
            try:
                y_val = int(year_param)
                projects_qs = projects_qs.filter(project_date__year=y_val)
            except ValueError:
                pass

        # Sort
        sort_param = request.query_params.get('sort') or request.query_params.get('sort_by')
        if sort_param == 'project_date_desc':
            projects_qs = projects_qs.order_by('-project_date', '-created_at')
        elif sort_param == 'project_date_asc':
            projects_qs = projects_qs.order_by('project_date', 'created_at')
        elif sort_param == 'oldest':
            projects_qs = projects_qs.order_by('created_at')
        elif sort_param == 'newest':
            projects_qs = projects_qs.order_by('-created_at')
        else:
            projects_qs = projects_qs.order_by('-created_at')

        serializer = ProjectSerializer(projects_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-existing-projects')
    def add_existing_projects(self, request, pk=None):
        client = self.get_object()
        project_ids = request.data.get('project_ids')
        if not project_ids and request.data.get('project_id'):
            project_ids = [request.data.get('project_id')]

        if not project_ids or not isinstance(project_ids, list):
            return Response(
                {"detail": "Please provide a list of project IDs as 'project_ids'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce strict organization check: All projects MUST belong to the user's organization
        from apps.projects.models import Project
        projects = Project.objects.filter(id__in=project_ids, organization=client.organization)

        if projects.count() != len(set(project_ids)):
            return Response(
                {"detail": "One or more projects do not exist or do not belong to your organization."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Associate projects with client
        projects.update(client=client)

        for proj in projects:
            ActivityLog.objects.create(
                user=request.user,
                organization=client.organization,
                action='PROFILE_UPDATED',
                entity_type='Project',
                entity_id=proj.id,
                description=f"Associated project '{proj.name}' with client '{client.name}'"
            )

        return Response(ProjectSerializer(projects, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='remove-project/(?P<project_id>[^/.]+)')
    def remove_project(self, request, pk=None, project_id=None):
        client = self.get_object()
        from apps.projects.models import Project
        project = get_object_or_404(Project, id=project_id, organization=client.organization, client=client)

        project.client = None
        project.save(update_fields=['client'])

        ActivityLog.objects.create(
            user=request.user,
            action='PROFILE_UPDATED',
            entity_type='Project',
            entity_id=project.id,
            description=f"Removed project '{project.name}' from client '{client.name}'"
        )
        return Response({"detail": "Project association removed successfully."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='unassigned-projects')
    def unassigned_projects(self, request):
        user = request.user
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        if not user.is_authenticated or not is_admin_or_org_admin(user):
            return Response([], status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(user)
        if not active_org:
            return Response([])

        from apps.projects.models import Project
        client_id = request.query_params.get('client_id')
        search_query = request.query_params.get('search') or request.query_params.get('q')

        # Strictly filter by active organization
        qs = Project.objects.filter(organization=active_org)

        # Exclude projects already associated with this client
        if client_id:
            qs = qs.exclude(client_id=client_id)

        if search_query and search_query.strip():
            query_str = search_query.strip()
            qs = qs.filter(Q(name__icontains=query_str) | Q(description__icontains=query_str))

        serializer = ProjectSerializer(qs.order_by('-created_at'), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def brand_assets(self, request, pk=None):
        client = self.get_object()

        if request.method == 'GET':
            assets = client.brand_assets.filter(organization=client.organization)
            folder_param = request.query_params.get('folder_id') or request.query_params.get('folder')
            if folder_param in ['null', 'root', 'None', '']:
                assets = assets.filter(folder__isnull=True)
            elif folder_param and folder_param != 'all':
                assets = assets.filter(folder_id=folder_param)

            serializer = ClientBrandAssetSerializer(assets, many=True, context={'request': request})
            return Response(serializer.data)

        if request.method == 'POST':
            file_obj = request.FILES.get('file')
            if not file_obj:
                return Response({"detail": "No file was uploaded."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                validate_uploaded_file(file_obj)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            name = request.data.get('name') or file_obj.name
            asset_type = request.data.get('asset_type') or AssetType.OTHER
            description = request.data.get('description', '')

            folder_id = request.data.get('folder_id') or request.data.get('folder')
            folder_obj = None
            if folder_id and str(folder_id).lower() not in ['null', 'root', 'none', '']:
                folder_obj = get_object_or_404(
                    ClientBrandAssetFolder,
                    id=folder_id,
                    client=client,
                    organization=client.organization
                )

            asset = ClientBrandAsset.objects.create(
                client=client,
                organization=client.organization,
                folder=folder_obj,
                name=name,
                file=file_obj,
                asset_type=asset_type,
                description=description,
                file_size=file_obj.size,
                file_type=file_obj.content_type or mimetypes.guess_type(file_obj.name)[0] or 'application/octet-stream',
                uploaded_by=request.user
            )

            ActivityLog.objects.create(
                user=request.user,
                organization=client.organization,
                action='PROFILE_UPDATED',
                entity_type='ClientBrandAsset',
                entity_id=asset.id,
                description=f"Uploaded brand asset '{asset.name}' for client '{client.name}'"
            )

            serializer = ClientBrandAssetSerializer(asset, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def brand_asset_folders(self, request, pk=None):
        client = self.get_object()
        folders = client.brand_asset_folders.filter(organization=client.organization)
        parent_param = request.query_params.get('parent') or request.query_params.get('parent_id')
        if parent_param in ['null', 'root', 'None', '']:
            folders = folders.filter(parent__isnull=True)
        elif parent_param and parent_param != 'all':
            folders = folders.filter(parent_id=parent_param)

        serializer = ClientBrandAssetFolderSerializer(folders, many=True, context={'request': request})
        return Response(serializer.data)


class ClientBrandAssetFolderViewSet(viewsets.ModelViewSet):
    serializer_class = ClientBrandAssetFolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        if not user.is_authenticated or not is_admin_or_org_admin(user):
            return ClientBrandAssetFolder.objects.none()

        active_org = get_active_organization(user)
        if not active_org:
            return ClientBrandAssetFolder.objects.none()

        qs = ClientBrandAssetFolder.objects.filter(organization=active_org)

        client_id = self.request.query_params.get('client') or self.request.query_params.get('client_id')
        if client_id:
            qs = qs.filter(client_id=client_id)

        parent_param = self.request.query_params.get('parent') or self.request.query_params.get('parent_id')
        if parent_param in ['null', 'root', 'None', '']:
            qs = qs.filter(parent__isnull=True)
        elif parent_param and parent_param != 'all':
            qs = qs.filter(parent_id=parent_param)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(user)
        client = serializer.validated_data.get('client')
        if client and client.organization != active_org:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Client does not belong to your active organization.")

        folder = serializer.save(organization=active_org, created_by=user)
        ActivityLog.objects.create(
            user=user,
            organization=active_org,
            action='PROFILE_UPDATED',
            entity_type='ClientBrandAssetFolder',
            entity_id=folder.id,
            description=f"Created folder '{folder.name}' for client '{folder.client.name}'"
        )

    def destroy(self, request, *args, **kwargs):
        folder = self.get_object()
        has_assets = folder.assets.exists()
        has_children = folder.children.exists()

        if has_assets or has_children:
            return Response(
                {"detail": "Cannot delete folder: Folder is not empty. Please remove or move its contents first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ActivityLog.objects.create(
            user=request.user,
            organization=folder.organization,
            action='PROFILE_UPDATED',
            entity_type='ClientBrandAssetFolder',
            entity_id=folder.id,
            description=f"Deleted folder '{folder.name}'"
        )
        return super().destroy(request, *args, **kwargs)


class ClientBrandAssetViewSet(viewsets.ModelViewSet):
    serializer_class = ClientBrandAssetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        if not user.is_authenticated or not is_admin_or_org_admin(user):
            return ClientBrandAsset.objects.none()

        active_org = get_active_organization(user)
        if not active_org:
            return ClientBrandAsset.objects.none()

        qs = ClientBrandAsset.objects.filter(organization=active_org)
        client_id = self.request.query_params.get('client') or self.request.query_params.get('client_id')
        if client_id:
            qs = qs.filter(client_id=client_id)

        folder_param = self.request.query_params.get('folder') or self.request.query_params.get('folder_id')
        if folder_param in ['null', 'root', 'None', '']:
            qs = qs.filter(folder__isnull=True)
        elif folder_param and folder_param != 'all':
            qs = qs.filter(folder_id=folder_param)

        return qs

    def perform_destroy(self, instance):
        ActivityLog.objects.create(
            user=self.request.user,
            organization=instance.organization,
            action='PROFILE_UPDATED',
            entity_type='ClientBrandAsset',
            entity_id=instance.id,
            description=f"Deleted brand asset '{instance.name}'"
        )
        instance.delete()

    @action(detail=True, methods=['patch', 'post'])
    def move(self, request, pk=None):
        asset = self.get_object()
        target_folder_id = request.data.get('target_folder_id')
        if target_folder_id is None:
            target_folder_id = request.data.get('folder_id')

        if target_folder_id in [None, '', 'null', 'root', 'None']:
            asset.folder = None
        else:
            target_folder = get_object_or_404(
                ClientBrandAssetFolder,
                id=target_folder_id,
                organization=asset.organization,
                client=asset.client
            )
            asset.folder = target_folder

        asset.save(update_fields=['folder', 'updated_at'])
        ActivityLog.objects.create(
            user=request.user,
            organization=asset.organization,
            action='PROFILE_UPDATED',
            entity_type='ClientBrandAsset',
            entity_id=asset.id,
            description=f"Moved brand asset '{asset.name}'"
        )
        return Response(ClientBrandAssetSerializer(asset, context={'request': request}).data)

    @action(detail=True, methods=['patch', 'post'])
    def rename(self, request, pk=None):
        asset = self.get_object()
        new_name = request.data.get('name')
        if not new_name or not new_name.strip():
            return Response({"detail": "Please provide a valid non-empty asset name."}, status=status.HTTP_400_BAD_REQUEST)

        new_name = new_name.strip()
        # Preserve original file extension
        original_file_name = os.path.basename(asset.file.name) if asset.file else asset.name
        original_ext = os.path.splitext(original_file_name)[1]

        if original_ext and not new_name.lower().endswith(original_ext.lower()):
            new_name = f"{new_name}{original_ext}"

        asset.name = new_name
        asset.save(update_fields=['name', 'updated_at'])

        ActivityLog.objects.create(
            user=request.user,
            organization=asset.organization,
            action='PROFILE_UPDATED',
            entity_type='ClientBrandAsset',
            entity_id=asset.id,
            description=f"Renamed brand asset to '{asset.name}'"
        )
        return Response(ClientBrandAssetSerializer(asset, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        asset = self.get_object()
        if not asset.file or not os.path.exists(asset.file.path):
            raise Http404("File does not exist.")

        original_filename = os.path.basename(asset.file.name)
        mime_type = asset.file_type or mimetypes.guess_type(original_filename)[0] or 'application/octet-stream'

        # Use asset's name if set, ensuring original extension
        download_name = asset.name
        ext = os.path.splitext(original_filename)[1]
        if ext and not download_name.lower().endswith(ext.lower()):
            download_name = f"{download_name}{ext}"

        response = FileResponse(asset.file.open('rb'), content_type=mime_type)
        response['Content-Disposition'] = f'attachment; filename="{download_name}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

