from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Project
from .serializers import ProjectSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog
from apps.tasks.bulk_import import generate_bulk_template, parse_excel_file, validate_bulk_import_data, import_tasks_confirm, BulkImportValidationError

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnlyMember]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Project.objects.none()

        from apps.accounts.tenant_context import get_active_organization
        from django.db.models import Q
        active_org = get_active_organization(user)
        if active_org:
            qs = Project.objects.filter(
                Q(organization=active_org) | Q(organization__isnull=True)
            ).order_by('-created_at')
        else:
            qs = Project.objects.none()

        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)

        return qs

    def perform_create(self, serializer):
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(self.request.user)
        project = serializer.save(created_by=self.request.user, organization=active_org)
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_CREATED',
            entity_type='Project',
            entity_id=project.id,
            description=f"{self.request.user.name} created project '{project.name}'."
        )

    def perform_update(self, serializer):
        project = serializer.save()
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_UPDATED',
            entity_type='Project',
            entity_id=project.id,
            description=f"{self.request.user.name} updated project '{project.name}'."
        )

    def perform_destroy(self, instance):
        project_id = instance.id
        project_name = instance.name
        instance.delete()
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='PROJECT_DELETED',
            entity_type='Project',
            entity_id=project_id,
            description=f"{self.request.user.name} deleted project '{project_name}'."
        )

    @action(detail=True, methods=['POST'], permission_classes=[permissions.IsAuthenticated])
    def duplicate(self, request, pk=None):
        from django.db import transaction
        from apps.accounts.tenant_context import get_active_organization, is_admin_or_org_admin
        from apps.tasks.models import Task, TaskAssignee, SubTask, SubTaskAssignee
        from apps.activity.models import ActivityLog

        try:
            project = self.get_object()
        except Exception:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not is_admin_or_org_admin(request.user):
            return Response({"detail": "Only Admins can duplicate projects."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user)
        if not active_org or (project.organization and project.organization != active_org):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            new_project = Project.objects.create(
                organization=active_org,
                name=f"{project.name} Copy",
                description=project.description or '',
                client=project.client,
                client_name=project.client_name,
                start_date=project.start_date,
                due_date=project.due_date,
                project_date=project.project_date,
                created_by=request.user
            )

            org_member_ids = set(active_org.memberships.filter(is_active=True).values_list('user_id', flat=True))

            original_tasks = Task.objects.filter(project=project)
            for orig_task in original_tasks:
                new_task = Task.objects.create(
                    organization=active_org,
                    project=new_project,
                    task_type=orig_task.task_type,
                    name=f"{orig_task.name} Copy",
                    description=orig_task.description or '',
                    due_date=orig_task.due_date,
                    due_time=orig_task.due_time,
                    priority=orig_task.priority,
                    status='PENDING',
                    allocated_seconds=orig_task.allocated_seconds,
                    elapsed_seconds=0,
                    timer_started_at=None,
                    timer_status='NOT_STARTED',
                    actual_duration_seconds=None,
                    created_by=request.user
                )

                for assignee in orig_task.assignee_relationships.all():
                    if assignee.user_id in org_member_ids:
                        TaskAssignee.objects.create(
                            task=new_task,
                            user=assignee.user,
                            completed=False,
                            completed_at=None
                        )

                for subtask in orig_task.subtasks.all():
                    new_subtask = SubTask.objects.create(
                        task=new_task,
                        name=f"{subtask.name} Copy",
                        due_date=subtask.due_date,
                        due_time=subtask.due_time,
                        status='PENDING',
                        completed_by=None,
                        completed_at=None
                    )
                    for sub_assignee in subtask.assignee_relationships.all():
                        if sub_assignee.user_id in org_member_ids:
                            SubTaskAssignee.objects.create(
                                subtask=new_subtask,
                                user=sub_assignee.user,
                                completed=False,
                                completed_at=None
                            )

            ActivityLog.objects.create(
                user=request.user,
                action='PROJECT_CREATED',
                entity_type='Project',
                entity_id=new_project.id,
                description=f"{request.user.name} duplicated project '{project.name}' as '{new_project.name}'."
            )

        serializer = self.get_serializer(new_project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['GET'], url_path='tasks/bulk-template')
    def bulk_template(self, request, pk=None):
        if request.user.role != 'ADMIN':
            return Response({"detail": "Only Admins can download the bulk import template."}, status=status.HTTP_403_FORBIDDEN)
        
        project = self.get_object()
        excel_data = generate_bulk_template(project)
        
        response = HttpResponse(
            excel_data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="fluxiflow_template_{project.id}.xlsx"'
        return response

    @action(detail=True, methods=['POST'], url_path='tasks/bulk-import/validate')
    def bulk_import_validate(self, request, pk=None):
        if request.user.role != 'ADMIN':
            return Response({"detail": "Only Admins can validate bulk import."}, status=status.HTTP_403_FORBIDDEN)
            
        project = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"detail": "No file uploaded. Please upload an Excel sheet."}, status=status.HTTP_400_BAD_REQUEST)
            
        # File type validation
        if not file_obj.name.endswith('.xlsx'):
            return Response({"detail": "Unsupported file format. Please upload a valid .xlsx file."}, status=status.HTTP_400_BAD_REQUEST)
            
        # File size check: 5MB max
        if file_obj.size > 5 * 1024 * 1024:
            return Response({"detail": "File size exceeds the 5MB limit."}, status=status.HTTP_400_BAD_REQUEST)
            
        success, result = parse_excel_file(file_obj)
        if not success:
            return Response({"detail": result}, status=status.HTTP_400_BAD_REQUEST)
            
        assert isinstance(result, list)
        validation_result = validate_bulk_import_data(result, project)
        errors = validation_result["errors"]
        warnings = validation_result.get("warnings", [])
        duplicate_count = validation_result["duplicate_count"]
        
        return Response({
            "success": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "total_rows": len(result),
            "tasks_count": len(result),
            "subtasks_count": 0,
            "duplicate_count": duplicate_count,
            "tasks": result
        })

    @action(detail=True, methods=['POST'], url_path='tasks/bulk-import/confirm')
    def bulk_import_confirm(self, request, pk=None):
        if request.user.role != 'ADMIN':
            return Response({"detail": "Only Admins can confirm bulk import."}, status=status.HTTP_403_FORBIDDEN)
            
        project = self.get_object()
        tasks_data = request.data.get('tasks')
        
        if not tasks_data or not isinstance(tasks_data, list):
            return Response({"detail": "Invalid payload format. Tasks list is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Security & Integrity re-validation on server side
        validation_result = validate_bulk_import_data(tasks_data, project)
        errors = validation_result["errors"]
        if errors:
            return Response({
                "success": False,
                "message": "Validation failed. Import payload contains errors.",
                "errors": errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            total_tasks, total_subtasks = import_tasks_confirm(
                tasks_data,
                project,
                request.user,
                request=request
            )
            return Response({
                "message": "Import completed successfully.",
                "tasks_created": total_tasks,
                "subtasks_created": total_subtasks
            }, status=status.HTTP_201_CREATED)
        except BulkImportValidationError as e:
            return Response({
                "success": False,
                "message": "Some tasks could not be imported.",
                "errors": e.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "message": "Unable to import tasks. Please try again. If the problem continues, contact your administrator.",
                "errors": [{
                    "row": 0,
                    "field": "server",
                    "message": "Unable to import tasks. Please try again. If the problem continues, contact your administrator."
                }]
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='export-report')
    def export_report(self, request, pk=None):
        project = self.get_object()
        from apps.reports.services import ReportGenerator
        
        try:
            pdf_file = ReportGenerator.export_project_report(project)
            
            # Log export activity
            ActivityLog.objects.create(
                user=request.user,
                action='REPORT_EXPORTED',
                entity_type='Project',
                entity_id=project.id,
                description=f"{request.user.name} exported client PDF report for project '{project.name}'."
            )
            
            filename = f"Fluxiflow_Project_Report_{project.name.replace(' ', '_')}.pdf"
            response = HttpResponse(pdf_file.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Failed to generate project report: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='download')
    def download_project_data(self, request, pk=None):
        project = self.get_object()
        tasks = Task.objects.filter(project=project).prefetch_related(
            'assignee_relationships__user',
            'subtasks__assignee_relationships__user'
        )
        
        data = {
            "id": str(project.id),
            "name": project.name,
            "description": project.description or "",
            "client_name": project.client.name if project.client else None,
            "client_display_name": project.client_display_name,
            "project_date": project.project_date,
            "due_date": str(project.due_date) if project.due_date else None,
            "status": project.status,
            "progress": project.progress,
            "created_at": str(project.created_at),
            "updated_at": str(project.updated_at),
            "tasks": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "description": t.description or "",
                    "priority": t.priority,
                    "status": t.status,
                    "due_date": str(t.due_date) if t.due_date else None,
                    "due_time": str(t.due_time) if t.due_time else None,
                    "assignees": [a.user.name for a in t.assignee_relationships.all()],
                    "subtasks": [
                        {
                            "id": str(s.id),
                            "name": s.name,
                            "status": s.status,
                            "due_date": str(s.due_date) if s.due_date else None,
                            "assignees": [sa.user.name for sa in s.assignee_relationships.all()]
                        } for s in t.subtasks.all()
                    ]
                } for t in tasks
            ]
        }
        import json
        json_content = json.dumps(data, indent=2)
        safe_name = "".join(c for c in project.name if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
        filename = f"Project_{safe_name}_Export.json"
        
        response = HttpResponse(json_content, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


