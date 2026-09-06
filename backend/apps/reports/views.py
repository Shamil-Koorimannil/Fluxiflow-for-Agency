from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.utils import timezone
from apps.core.permissions import IsAdmin
from apps.activity.models import ActivityLog
from .services import ReportGenerator

class ReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def _get_common_params(self, request):
        member_id = request.query_params.get('member')
        project_id = request.query_params.get('project')
        client_id = request.query_params.get('client')
        status_filter = request.query_params.get('status', 'all')
        search_query = request.query_params.get('search')
        include_deactivated = request.query_params.get('include_deactivated') == 'true'
        return member_id, project_id, client_id, status_filter, search_query, include_deactivated

    @action(detail=False, methods=['GET'], url_path='daily')
    def daily_report(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            date_str = str(timezone.localdate())
            
        member_id, project_id, client_id, status_filter, search_query, include_deactivated = self._get_common_params(request)
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)
        
        try:
            data = ReportGenerator.compile_report_data(
                start_date=date_str,
                end_date=date_str,
                member_id=member_id,
                project_id=project_id,
                client_id=client_id,
                status_filter=status_filter,
                search_query=search_query,
                include_deactivated=include_deactivated,
                organization=active_org
            )
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='range')
    def range_report(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            return Response(
                {"detail": "Both start_date and end_date query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        member_id, project_id, client_id, status_filter, search_query, include_deactivated = self._get_common_params(request)
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)
        
        try:
            data = ReportGenerator.compile_report_data(
                start_date=start_date_str,
                end_date=end_date_str,
                member_id=member_id,
                project_id=project_id,
                client_id=client_id,
                status_filter=status_filter,
                search_query=search_query,
                include_deactivated=include_deactivated,
                organization=active_org
            )
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='export/excel')
    def export_excel(self, request):
        date_str = request.query_params.get('date')
        start_date = request.query_params.get('start_date') or date_str
        end_date = request.query_params.get('end_date') or date_str

        if not start_date or not end_date:
            return Response(
                {"detail": "Please specify either 'date' or both 'start_date' and 'end_date'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        member_id, project_id, client_id, status_filter, search_query, include_deactivated = self._get_common_params(request)
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)

        try:
            excel_file = ReportGenerator.export_excel(
                start_date=start_date,
                end_date=end_date,
                member_id=member_id,
                project_id=project_id,
                client_id=client_id,
                status_filter=status_filter,
                search_query=search_query,
                include_deactivated=include_deactivated,
                organization=active_org
            )
            
            # Log export activity
            ActivityLog.objects.create(
                user=request.user,
                organization=active_org,
                action='REPORT_EXPORTED',
                entity_type='Report',
                description=f"{request.user.name} exported Excel report for period {start_date} to {end_date}."
            )

            filename = f"Fluxiflow_Report_{start_date}_to_{end_date}.xlsx" if start_date != end_date else f"Fluxiflow_Report_{start_date}.xlsx"
            response = HttpResponse(
                excel_file.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='export/csv')
    def export_csv(self, request):
        date_str = request.query_params.get('date')
        start_date = request.query_params.get('start_date') or date_str
        end_date = request.query_params.get('end_date') or date_str

        if not start_date or not end_date:
            return Response(
                {"detail": "Please specify either 'date' or both 'start_date' and 'end_date'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        member_id, project_id, client_id, status_filter, search_query, include_deactivated = self._get_common_params(request)
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)

        try:
            csv_data = ReportGenerator.export_csv(
                start_date=start_date,
                end_date=end_date,
                member_id=member_id,
                project_id=project_id,
                client_id=client_id,
                status_filter=status_filter,
                search_query=search_query,
                include_deactivated=include_deactivated,
                organization=active_org
            )
            
            # Log export activity
            ActivityLog.objects.create(
                user=request.user,
                organization=active_org,
                action='REPORT_EXPORTED',
                entity_type='Report',
                description=f"{request.user.name} exported CSV report for period {start_date} to {end_date}."
            )

            filename = f"Fluxiflow_Report_{start_date}_to_{end_date}.csv" if start_date != end_date else f"Fluxiflow_Report_{start_date}.csv"
            response = HttpResponse(csv_data, content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='export/pdf')
    def export_pdf(self, request):
        date_str = request.query_params.get('date')
        start_date = request.query_params.get('start_date') or date_str
        end_date = request.query_params.get('end_date') or date_str

        if not start_date or not end_date:
            return Response(
                {"detail": "Please specify either 'date' or both 'start_date' and 'end_date'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        member_id, project_id, client_id, status_filter, search_query, include_deactivated = self._get_common_params(request)
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)

        try:
            pdf_file = ReportGenerator.export_pdf(
                start_date=start_date,
                end_date=end_date,
                member_id=member_id,
                project_id=project_id,
                client_id=client_id,
                status_filter=status_filter,
                search_query=search_query,
                include_deactivated=include_deactivated,
                organization=active_org
            )
            
            # Log export activity
            ActivityLog.objects.create(
                user=request.user,
                organization=active_org,
                action='REPORT_EXPORTED',
                entity_type='Report',
                description=f"{request.user.name} exported PDF report for period {start_date} to {end_date}."
            )

            filename = f"Fluxiflow_Report_{start_date}_to_{end_date}.pdf" if start_date != end_date else f"Fluxiflow_Report_{start_date}.pdf"
            response = HttpResponse(pdf_file.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
