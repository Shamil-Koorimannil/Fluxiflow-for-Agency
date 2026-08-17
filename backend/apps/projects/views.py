from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Project
from .serializers import ProjectSerializer
from apps.core.permissions import IsAdminOrReadOnlyMember
from apps.activity.models import ActivityLog
from apps.tasks.bulk_import import generate_bulk_template, parse_excel_file, validate_bulk_import_data, import_tasks_confirm

class ProjectViewSet(viewsets.ModelSerializerViewSet if hasattr(viewsets, 'ModelSerializerViewSet') else viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnlyMember]

    def perform_create(self, serializer):
        from apps.accounts.models import Membership
        user_membership = Membership.objects.filter(user=self.request.user).first()
        org = user_membership.organization if user_membership else None
        project = serializer.save(created_by=self.request.user, organization=org)
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
        duplicate_count = validation_result["duplicate_count"]
        
        return Response({
            "success": len(errors) == 0,
            "errors": errors,
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
                "detail": "Validation failed. Import payload was manipulated or contains errors.",
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
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Import failed due to a server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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


