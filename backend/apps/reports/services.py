import csv
import datetime
from io import BytesIO
from django.utils import timezone
from django.db import models
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from apps.tasks.models import Task, TaskAssignee, TaskAssignmentHistory
from apps.projects.models import Project

# openpyxl for Excel
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

# reportlab for PDF
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

User = get_user_model()

class ReportGenerator:
    @staticmethod
    def get_day_boundaries(date_obj, tz=None):
        if tz is None:
            tz = timezone.get_current_timezone()
        
        # Combine date with min/max time
        naive_start = datetime.datetime.combine(date_obj, datetime.time.min)
        naive_end = datetime.datetime.combine(date_obj, datetime.time.max)
        
        # Make timezone-aware
        start_dt = timezone.make_aware(naive_start, tz)
        end_dt = timezone.make_aware(naive_end, tz)
        
        return start_dt, end_dt

    @staticmethod
    def compile_report_data(start_date, end_date, member_id=None, project_id=None, status_filter=None, search_query=None, include_deactivated=False, organization=None):
        tz = timezone.get_current_timezone()
        
        # Format date inputs
        if isinstance(start_date, str):
            start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        if isinstance(end_date, str):
            end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            
        is_range = start_date != end_date
        
        # Total date range boundaries
        total_start_dt, _ = ReportGenerator.get_day_boundaries(start_date, tz)
        _, total_end_dt = ReportGenerator.get_day_boundaries(end_date, tz)

        # 1. Fetch relevant members
        if organization:
            member_user_ids = organization.memberships.filter(is_active=True).values_list('user_id', flat=True)
            members_query = User.objects.filter(id__in=member_user_ids)
        else:
            members_query = User.objects.all()

        if not include_deactivated:
            # Active members, or deactivated after start of the report range
            members_query = members_query.filter(
                models.Q(is_active=True, status='ACTIVE') |
                models.Q(is_active=False, status='INACTIVE', deactivated_at__gt=total_start_dt)
            )
        if member_id and member_id != 'all':
            members_query = members_query.filter(id=member_id)
            
        members_list = list(members_query.order_by('name'))
        member_ids = [m.id for m in members_list]

        # 2. Iterate day by day in range
        delta = datetime.timedelta(days=1)
        current_date = start_date
        
        def get_avatar(u):
            try:
                if u.profile and u.profile.avatar:
                    return u.profile.avatar.url
            except Exception:
                pass
            return None

        daily_breakdown = []
        all_member_stats = {
            m.id: {
                "member_id": str(m.id),
                "name": getattr(m, 'name', f"{getattr(m, 'first_name', '')} {getattr(m, 'last_name', '')}".strip() or m.email),
                "role": getattr(m, 'role', 'MEMBER'),
                "avatar_url": get_avatar(m),
                "completed": 0,
                "on_time": 0,
                "late": 0,
                "pending": 0,
                "overdue": 0,
            } for m in members_list
        }
        
        all_tasks_details = []

        while current_date <= end_date:
            day_start_dt, day_end_dt = ReportGenerator.get_day_boundaries(current_date, tz)
            
            # Fetch assignment histories active on this day
            histories = TaskAssignmentHistory.objects.filter(
                user_id__in=member_ids,
                assigned_at__lte=day_end_dt
            ).filter(
                models.Q(unassigned_at__isnull=True) | models.Q(unassigned_at__gt=day_start_dt)
            ).select_related('task', 'task__project', 'subtask', 'subtask__task', 'subtask__task__project', 'user')

            if organization:
                histories = histories.filter(
                    models.Q(task__organization=organization) |
                    models.Q(subtask__task__organization=organization)
                )

            # Filter by project
            if project_id and project_id != 'all':
                histories = histories.filter(
                    models.Q(task__project_id=project_id) |
                    models.Q(subtask__task__project_id=project_id)
                )
                
            # Filter by search query (task name, subtask name, member name, project name)
            if search_query:
                histories = histories.filter(
                    models.Q(task__name__icontains=search_query) |
                    models.Q(subtask__name__icontains=search_query) |
                    models.Q(user__name__icontains=search_query) |
                    models.Q(task__project__name__icontains=search_query) |
                    models.Q(subtask__task__project__name__icontains=search_query)
                )

            # Metrics for this day
            day_completed = 0
            day_on_time = 0
            day_late = 0
            day_pending = 0
            day_overdue = 0
            
            for h in histories:
                subtask = h.subtask
                is_subtask = subtask is not None
                task = subtask.task if (is_subtask and subtask) else h.task
                
                if not task:
                    continue

                # Check task/subtask due datetime
                due_dt = None
                if is_subtask and subtask:
                    if subtask.due_date and subtask.due_time:
                        naive_due = datetime.datetime.combine(subtask.due_date, subtask.due_time)
                        due_dt = timezone.make_aware(naive_due, tz)
                    elif subtask.due_date:
                        due_dt = day_end_dt.replace(year=subtask.due_date.year, month=subtask.due_date.month, day=subtask.due_date.day)
                else:
                    if task.due_date and task.due_time:
                        naive_due = datetime.datetime.combine(task.due_date, task.due_time)
                        due_dt = timezone.make_aware(naive_due, tz)
                    elif task.due_date:
                        due_dt = day_end_dt.replace(year=task.due_date.year, month=task.due_date.month, day=task.due_date.day)

                # Determine completion state relative to the end of this day
                is_completed_on_day = (
                    h.completed and 
                    h.completed_at is not None and 
                    day_start_dt <= h.completed_at <= day_end_dt
                )
                
                is_completed_before_day_end = (
                    h.completed and
                    h.completed_at is not None and
                    h.completed_at <= day_end_dt
                )

                completed_at_str = None
                if is_completed_on_day and h.completed_at:
                    day_completed += 1
                    all_member_stats[h.user.id]["completed"] += 1
                    
                    # On-time check using task due datetime helper
                    from apps.tasks.helpers import format_late_duration
                    if not due_dt:
                        all_member_stats[h.user.id]["on_time"] += 1
                        day_on_time += 1
                        on_time_status = "On Time"
                        late_duration = "-"
                    else:
                        if h.completed_at <= due_dt:
                            all_member_stats[h.user.id]["on_time"] += 1
                            day_on_time += 1
                            on_time_status = "On Time"
                            late_duration = "-"
                        else:
                            all_member_stats[h.user.id]["late"] += 1
                            day_late += 1
                            on_time_status = "Late"
                            diff = h.completed_at - due_dt
                            late_mins = int(diff.total_seconds() // 60)
                            late_duration = format_late_duration(late_mins)
                            
                    task_status = "COMPLETED"
                    completed_at_str = timezone.localtime(h.completed_at).strftime("%d %b %Y, %I:%M %p")
                else:
                    # Incomplete by end of day
                    if not is_completed_before_day_end:
                        created_at_dt = (subtask.created_at if subtask else None) if is_subtask else task.created_at
                        if created_at_dt and created_at_dt <= day_end_dt:
                            if due_dt and due_dt < day_end_dt:
                                day_overdue += 1
                                all_member_stats[h.user.id]["overdue"] += 1
                                task_status = "OVERDUE"
                                on_time_status = "Overdue"
                            else:
                                day_pending += 1
                                all_member_stats[h.user.id]["pending"] += 1
                                task_status = "PENDING"
                                on_time_status = "Pending"
                            late_duration = "-"
                        else:
                            # Created in future relative to this reporting day, skip
                            continue
                    else:
                        # Completed on a previous day in range, skip detail addition for this day
                        # to avoid duplicate list entries, but it was already counted on its completed day.
                        continue

                # Add to task details
                subtask_due_date = subtask.due_date if (is_subtask and subtask) else None
                task_due_date = task.due_date if task else None
                subtask_due_time = subtask.due_time if (is_subtask and subtask) else None
                task_due_time = task.due_time if task else None

                due_date_val = subtask_due_date or task_due_date
                due_time_val = subtask_due_time or task_due_time

                due_date_str = due_date_val.strftime("%d %b %Y") if due_date_val else "-"
                due_time_str = due_time_val.strftime("%I:%M %p") if due_time_val else None
                priority_str = getattr(task, 'get_priority_display', lambda: getattr(task, 'priority', '-'))() if task else "-"
                
                member_name = getattr(h.user, 'name', f"{getattr(h.user, 'first_name', '')} {getattr(h.user, 'last_name', '')}".strip() or h.user.email)
                project_obj = getattr(task, 'project', None)

                all_tasks_details.append({
                    "date": str(current_date),
                    "task_id": str(task.id),
                    "task_name": task.name,
                    "subtask_name": subtask.name if (is_subtask and subtask) else "-",
                    "project_id": str(project_obj.id) if project_obj else None,
                    "project_name": project_obj.name if project_obj else "No Project",
                    "member_id": str(h.user.id),
                    "member_name": member_name,
                    "status": task_status,
                    "due_date": due_date_str,
                    "due_time": due_time_str,
                    "completed_at": completed_at_str if is_completed_on_day else None,
                    "priority": priority_str,
                    "on_time": on_time_status,
                    "late_by": late_duration
                })

            daily_breakdown.append({
                "date": str(current_date),
                "completed": day_completed,
                "on_time": day_on_time,
                "late": day_late,
                "pending": day_pending,
                "overdue": day_overdue
            })
            
            current_date += delta

        # Post-process member summaries to calculate On-Time rate
        member_reports = []
        for m_id, stats in all_member_stats.items():
            total_completed = stats["completed"]
            on_time_count = stats["on_time"]
            
            if total_completed > 0:
                rate = round((on_time_count / total_completed) * 100)
            else:
                rate = 100  # Default perfect rate
                
            stats["on_time_rate"] = rate
            member_reports.append(stats)

        # Unified range summaries
        total_completed = sum(m["completed"] for m in member_reports)
        total_on_time = sum(m["on_time"] for m in member_reports)
        total_late = sum(m["late"] for m in member_reports)
        total_pending = sum(m["pending"] for m in member_reports)
        total_overdue = sum(m["overdue"] for m in member_reports)
        
        overall_on_time_rate = (
            round((total_on_time / total_completed) * 100) if total_completed > 0 else 100
        )

        # Apply status filter to the returned task details list
        if status_filter and status_filter != 'all':
            if status_filter.lower() == 'late':
                all_tasks_details = [t for t in all_tasks_details if t["status"] == "COMPLETED" and t["on_time"] == "Late"]
            else:
                all_tasks_details = [t for t in all_tasks_details if t["status"].lower() == status_filter.lower()]

        return {
            "start_date": str(start_date),
            "end_date": str(end_date),
            "is_range": is_range,
            "summary": {
                "total_members": len(member_ids),
                "completed": total_completed,
                "on_time": total_on_time,
                "late": total_late,
                "pending": total_pending,
                "overdue": total_overdue,
                "on_time_rate": overall_on_time_rate
            },
            "member_reports": member_reports,
            "daily_breakdown": daily_breakdown if is_range else [],
            "tasks": all_tasks_details
        }

    @staticmethod
    def export_excel(start_date, end_date, member_id=None, project_id=None, status_filter=None, search_query=None, include_deactivated=False, organization=None):
        data = ReportGenerator.compile_report_data(
            start_date, end_date, member_id, project_id, status_filter, search_query, include_deactivated, organization=organization
        )

        wb = Workbook()
        # Sheet 1: Summary
        ws1 = wb.active
        assert ws1 is not None
        ws1.title = "Summary"
        
        # Styles
        title_font = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        bold_font = Font(name="Calibri", size=11, bold=True)
        regular_font = Font(name="Calibri", size=11)
        
        fill_title = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
        fill_header = PatternFill(start_color="333333", end_color="333333", fill_type="solid")
        fill_accent = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
        
        align_center = Alignment(horizontal="center", vertical="center")
        align_left = Alignment(horizontal="left", vertical="center")
        
        border_thin = Side(border_style="thin", color="CCCCCC")
        border_double = Side(border_style="double", color="333333")
        grid_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

        # Title block
        ws1.merge_cells("A1:C1")
        ws1["A1"] = f"Fluxiflow Client Deliverables Report ({data['start_date']} to {data['end_date']})"
        ws1["A1"].font = title_font
        ws1["A1"].fill = fill_title
        ws1["A1"].alignment = align_center
        ws1.row_dimensions[1].height = 40

        # Overall summary cards row
        ws1["A3"] = "Total Deliverables"
        ws1["B3"] = "Completed Tasks"
        ws1["C3"] = "Pending Tasks"
        
        for col in ["A", "B", "C"]:
            ws1[f"{col}3"].font = bold_font
            ws1[f"{col}3"].alignment = align_center
            ws1[f"{col}3"].fill = fill_accent
            
        total_deliverables = len(data["tasks"])
        completed_cnt = sum(1 for t in data["tasks"] if t["status"] == "COMPLETED")
        pending_cnt = total_deliverables - completed_cnt

        ws1["A4"] = total_deliverables
        ws1["B4"] = completed_cnt
        ws1["C4"] = pending_cnt
        
        for col in ["A", "B", "C"]:
            ws1[f"{col}4"].font = regular_font
            ws1[f"{col}4"].alignment = align_center
            ws1[f"{col}4"].border = grid_border
        
        ws1.row_dimensions[3].height = 20
        ws1.row_dimensions[4].height = 25

        # Deliverables Sheet Header & Data
        headers = ["Date", "Client", "Project", "Task", "Subtask", "Status", "Due Date", "Due Time", "Completed At", "Priority"]
        for col_idx, h_text in enumerate(headers, 1):
            cell = ws1.cell(row=7, column=col_idx, value=h_text)
            cell.font = header_font
            cell.fill = fill_header
            cell.alignment = align_center
        ws1.row_dimensions[7].height = 25

        # Data rows
        detail_row = 8
        for t in data["tasks"]:
            ws1.cell(row=detail_row, column=1, value=t["date"]).alignment = align_center
            ws1.cell(row=detail_row, column=2, value=t.get("client_name") or "-").alignment = align_left
            ws1.cell(row=detail_row, column=3, value=t["project_name"]).alignment = align_left
            ws1.cell(row=detail_row, column=4, value=t["task_name"]).alignment = align_left
            ws1.cell(row=detail_row, column=5, value=t["subtask_name"]).alignment = align_left
            ws1.cell(row=detail_row, column=6, value=t["status"]).alignment = align_center
            ws1.cell(row=detail_row, column=7, value=t["due_date"]).alignment = align_center
            ws1.cell(row=detail_row, column=8, value=t["due_time"] or "-").alignment = align_center
            ws1.cell(row=detail_row, column=9, value=t["completed_at"] or "-").alignment = align_center
            ws1.cell(row=detail_row, column=10, value=t["priority"]).alignment = align_center
            
            for col in range(1, 11):
                cell = ws1.cell(row=detail_row, column=col)
                cell.font = regular_font
                cell.border = grid_border
            ws1.row_dimensions[detail_row].height = 20
            detail_row += 1

        # Auto-adjust column widths
        for col in ws1.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws1.column_dimensions[col_letter].width = max(max_len + 4, 12)

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    def export_csv(start_date, end_date, member_id=None, project_id=None, status_filter=None, search_query=None, include_deactivated=False, organization=None):
        data = ReportGenerator.compile_report_data(
            start_date, end_date, member_id, project_id, status_filter, search_query, include_deactivated, organization=organization
        )
        
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow(["Date", "Client", "Project", "Task", "Subtask", "Status", "Due Date", "Due Time", "Completed At", "Priority"])
        
        # Data
        for t in data["tasks"]:
            writer.writerow([
                t["date"],
                t.get("client_name") or "",
                t["project_name"],
                t["task_name"],
                t["subtask_name"],
                t["status"],
                t["due_date"],
                t["due_time"] or "",
                t["completed_at"] or "",
                t["priority"]
            ])
            
        return b'\xef\xbb\xbf' + output.getvalue().encode('utf-8')

    @staticmethod
    def export_pdf(start_date, end_date, member_id=None, project_id=None, status_filter=None, search_query=None, include_deactivated=False, organization=None):
        data = ReportGenerator.compile_report_data(
            start_date, end_date, member_id, project_id, status_filter, search_query, include_deactivated, organization=organization
        )

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        styles = getSampleStyleSheet()
        
        # Define clean premium typography styles
        title_style = ParagraphStyle(
            'PDFTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            textColor=colors.HexColor('#000000'),
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            'PDFSubTitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            textColor=colors.HexColor('#666666'),
            spaceAfter=20
        )
        section_heading = ParagraphStyle(
            'PDFSection',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.HexColor('#000000'),
            spaceBefore=15,
            spaceAfter=10
        )
        body_style = ParagraphStyle(
            'PDFBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#333333')
        )
        bold_body = ParagraphStyle(
            'PDFBoldBody',
            parent=body_style,
            fontName='Helvetica-Bold'
        )

        story = []
        
        # Title block
        story.append(Paragraph("Fluxiflow Deliverables Report", title_style))
        story.append(Paragraph(f"Client & Project Progress Report — {data['start_date']} to {data['end_date']}", subtitle_style))
        
        total_deliverables = len(data["tasks"])
        completed_cnt = sum(1 for t in data["tasks"] if t["status"] == "COMPLETED")
        pending_cnt = total_deliverables - completed_cnt

        # Summary Box
        story.append(Paragraph("Deliverables Summary", section_heading))
        summary_table_data = [
            [
                Paragraph("<b>Total Deliverables</b>", body_style),
                Paragraph("<b>Completed Tasks</b>", body_style),
                Paragraph("<b>Pending Tasks</b>", body_style)
            ],
            [
                Paragraph(str(total_deliverables), body_style),
                Paragraph(str(completed_cnt), body_style),
                Paragraph(str(pending_cnt), body_style)
            ]
        ]
        summary_table = Table(summary_table_data, colWidths=[170, 170, 170])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F2F2F2')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))

        # Task Details Section
        story.append(Paragraph("Deliverables Log", section_heading))
        
        if len(data["tasks"]) == 0:
            story.append(Paragraph("No matching deliverables logged for this reporting period.", body_style))
        else:
            task_table_data = [
                [
                    Paragraph("<b>Date & Client</b>", body_style),
                    Paragraph("<b>Project & Task</b>", body_style),
                    Paragraph("<b>Status</b>", body_style),
                    Paragraph("<b>Due Date/Time</b>", body_style),
                    Paragraph("<b>Completed At</b>", body_style)
                ]
            ]
            for t in data["tasks"]:
                due_str = f"{t['due_date']}"
                if t['due_time']:
                    due_str += f", {t['due_time']}"
                
                if t["status"] == "COMPLETED":
                    status_html = "<b><font color='#10b981'>Completed</font></b>"
                else:
                    status_html = "<font color='#d97706'>Pending</font>"
                    
                task_name_val = f"<b>{t['task_name']}</b>"
                if t.get("subtask_name") and t["subtask_name"] != "-":
                    task_name_val = f"<b>{t['task_name']}</b><br/><font color='#666666'>Subtask: {t['subtask_name']}</font>"

                client_str = f"<br/><font color='#666666'>{t.get('client_name') or ''}</font>" if t.get('client_name') else ""

                task_table_data.append([
                    Paragraph(f"<b>{t['date']}</b>{client_str}", body_style),
                    Paragraph(f"{task_name_val}<br/><font color='#666666'>Project: {t['project_name']}</font>", body_style),
                    Paragraph(status_html, body_style),
                    Paragraph(due_str, body_style),
                    Paragraph(t["completed_at"] or "-", body_style)
                ])

            task_table = Table(task_table_data, colWidths=[110, 190, 80, 80, 80])
            task_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F2F2F2')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E5E5')),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(task_table)

        doc.build(story)
        buffer.seek(0)
        return buffer

    @staticmethod
    def export_project_report(project):
        from io import BytesIO
        from django.utils import timezone
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        # 1. Compile project stats
        tasks = project.tasks.all().order_by('due_date', 'due_time', 'created_at')
        total_tasks = tasks.count()
        
        completed_tasks = 0
        in_progress_tasks = 0
        pending_tasks = 0
        
        task_list_data = []
        
        # Helper to determine task overall status and progress
        for task in tasks:
            # calculate overall status based on assignees
            assignees_rels = task.assignee_relationships.all()
            total_assignees = assignees_rels.count()
            completed_assignees = sum(1 for rel in assignees_rels if rel.completed)
            
            if total_assignees > 0:
                if completed_assignees == total_assignees:
                    task_status = 'COMPLETED'
                elif completed_assignees > 0:
                    task_status = 'IN_PROGRESS'
                else:
                    task_status = 'PENDING'
            else:
                task_status = 'COMPLETED' if task.status == 'COMPLETED' else 'PENDING'
                
            # Progress calculation
            subtasks_count = task.subtasks.count()
            if subtasks_count > 0:
                completed_subtasks = task.subtasks.filter(status='COMPLETED').count()
                task_progress = round((completed_subtasks / subtasks_count) * 100)
            else:
                task_progress = 100 if task_status == 'COMPLETED' else 0
                
            if task_status == 'COMPLETED':
                completed_tasks += 1
            elif task_status == 'IN_PROGRESS':
                in_progress_tasks += 1
            else:
                pending_tasks += 1
                
            due_str = task.due_date.strftime("%d %b %Y") if task.due_date else "N/A"
            if task.due_time:
                due_str += f", {task.due_time.strftime('%I:%M %p')}"
                
            task_list_data.append({
                'name': task.name,
                'status': task_status,
                'progress': task_progress,
                'due_date': due_str
            })
            
        progress_pct = 0
        if total_tasks > 0:
            progress_pct = round((completed_tasks / total_tasks) * 100)
            
        # Determine overall project status
        if total_tasks > 0 and completed_tasks == total_tasks:
            project_status = "Completed"
        elif project.due_date and project.due_date < timezone.localtime(timezone.now()).date() and completed_tasks < total_tasks:
            project_status = "Overdue"
        elif completed_tasks > 0 or in_progress_tasks > 0:
            project_status = "In Progress"
        else:
            project_status = "Planning"
            
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )
        
        styles = getSampleStyleSheet()
        
        # Styles definition
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor('#111827'), # Dark slate
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'ReportSubTitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#6B7280'), # Cool grey
            spaceAfter=24
        )
        section_heading = ParagraphStyle(
            'ReportSection',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            textColor=colors.HexColor('#1F2937'),
            spaceBefore=16,
            spaceAfter=8,
            keepWithNext=True
        )
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            textColor=colors.HexColor('#374151'),
            leading=14
        )
        bold_body = ParagraphStyle(
            'ReportBoldBody',
            parent=body_style,
            fontName='Helvetica-Bold'
        )
        small_style = ParagraphStyle(
            'ReportSmall',
            parent=body_style,
            fontName='Helvetica',
            fontSize=8,
            textColor=colors.HexColor('#6B7280')
        )
        
        story = []
        
        # ── 1. HEADER SECTION (Branding) ──
        org_name = project.organization.name if project.organization else "Fluxiflow Workspace"
        gen_date = timezone.localtime(timezone.now()).strftime("%B %d, %Y")
        
        header_table_data = [
            [
                Paragraph(f"<b>FLUXIFLOW</b> | {org_name}", bold_body),
                Paragraph(f"Generated on {gen_date}", small_style)
            ]
        ]
        header_table = Table(header_table_data, colWidths=[350, 180])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LINEBELOW', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 15))
        
        # ── 2. PROJECT OVERVIEW ──
        story.append(Paragraph(project.name, title_style))
        if project.client_name:
            story.append(Paragraph(f"Client: <b>{project.client_name}</b>", subtitle_style))
        else:
            story.append(Paragraph("Client: Internal / Unspecified", subtitle_style))
            
        story.append(Paragraph("<b>Project Overview</b>", section_heading))
        desc_text = project.description or "No description provided."
        
        # Overview grid table
        start_date_str = project.start_date.strftime("%Y-%m-%d") if project.start_date else "N/A"
        due_date_str = project.due_date.strftime("%Y-%m-%d") if project.due_date else "N/A"
        
        overview_table_data = [
            [
                Paragraph("<b>Description</b>", bold_body),
                Paragraph(desc_text, body_style)
            ],
            [
                Paragraph("<b>Start Date</b>", bold_body),
                Paragraph(start_date_str, body_style)
            ],
            [
                Paragraph("<b>Due Date</b>", bold_body),
                Paragraph(due_date_str, body_style)
            ],
            [
                Paragraph("<b>Overall Status</b>", bold_body),
                Paragraph(project_status, bold_body)
            ]
        ]
        overview_table = Table(overview_table_data, colWidths=[110, 420])
        overview_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F3F4F6')),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F9FAFB')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(overview_table)
        story.append(Spacer(1, 15))
        
        # ── 3. PROGRESS SUMMARY ──
        story.append(Paragraph("<b>Delivery & Progress Summary</b>", section_heading))
        
        # Helper to create horizontal bar
        def make_pdf_progress_bar(pct):
            filled_width = (pct / 100.0) * 120.0
            unfilled_width = 120.0 - filled_width
            bar_data = [['']]
            bar_col_widths = []
            bar_styles = []
            if filled_width > 0:
                bar_col_widths.append(filled_width)
                bar_styles.append(('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#10B981'))) # Emerald Green
            if unfilled_width > 0:
                bar_col_widths.append(unfilled_width)
                bar_styles.append(('BACKGROUND', (-1, 0), (-1, 0), colors.HexColor('#E5E7EB'))) # Light gray
            bar_table = Table(bar_data, colWidths=bar_col_widths, rowHeights=[8])
            bar_table.setStyle(TableStyle(bar_styles + [
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            return bar_table
            
        progress_table_data = [
            [
                Paragraph("<b>Metric</b>", bold_body),
                Paragraph("<b>Value</b>", bold_body),
                Paragraph("<b>Visual Progress</b>", bold_body)
            ],
            [
                Paragraph("Overall Completion", body_style),
                Paragraph(f"{progress_pct}%", bold_body),
                make_pdf_progress_bar(progress_pct)
            ],
            [
                Paragraph("Total Project Tasks", body_style),
                Paragraph(str(total_tasks), body_style),
                ""
            ],
            [
                Paragraph("Completed Tasks", body_style),
                Paragraph(f"{completed_tasks} tasks", body_style),
                ""
            ],
            [
                Paragraph("In-Progress Tasks", body_style),
                Paragraph(f"{in_progress_tasks} tasks", body_style),
                ""
            ],
            [
                Paragraph("Pending Tasks", body_style),
                Paragraph(f"{pending_tasks} tasks", body_style),
                ""
            ]
        ]
        
        progress_table = Table(progress_table_data, colWidths=[160, 160, 210])
        progress_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(progress_table)
        story.append(Spacer(1, 15))
        
        # ── 4. TASK PROGRESS TABLE ──
        story.append(Paragraph("<b>Task Delivery Breakdown</b>", section_heading))
        
        if total_tasks == 0:
            story.append(Paragraph("No tasks created for this project yet.", body_style))
        else:
            task_table_headers = [
                Paragraph("<b>Task Name</b>", bold_body),
                Paragraph("<b>Status</b>", bold_body),
                Paragraph("<b>Progress</b>", bold_body),
                Paragraph("<b>Due Date</b>", bold_body)
            ]
            task_table_rows = [task_table_headers]
            for t in task_list_data:
                status_color = '#10B981' if t['status'] == 'COMPLETED' else ('#F59E0B' if t['status'] == 'IN_PROGRESS' else '#374151')
                status_p = Paragraph(f"<font color='{status_color}'><b>{t['status']}</b></font>", body_style)
                
                task_table_rows.append([
                    Paragraph(t['name'], body_style),
                    status_p,
                    Paragraph(f"{t['progress']}%", body_style),
                    Paragraph(t['due_date'], body_style)
                ])
                
            task_table = Table(task_table_rows, colWidths=[240, 95, 95, 100])
            task_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(task_table)
            
        story.append(Spacer(1, 15))
        
        # ── 5. COMPLETION SUMMARY ──
        completed_list = [t['name'] for t in task_list_data if t['status'] == 'COMPLETED']
        remaining_list = [t['name'] for t in task_list_data if t['status'] != 'COMPLETED']
        
        completed_bullet_text = "None"
        if completed_list:
            completed_bullet_text = "<br/>".join([f"• {name}" for name in completed_list[:5]])
            if len(completed_list) > 5:
                completed_bullet_text += f"<br/>• ...and {len(completed_list) - 5} more task(s)"
                
        remaining_bullet_text = "None (All tasks completed!)"
        if remaining_list:
            remaining_bullet_text = "<br/>".join([f"• {name}" for name in remaining_list[:5]])
            if len(remaining_list) > 5:
                remaining_bullet_text += f"<br/>• ...and {len(remaining_list) - 5} remaining task(s)"
                
        summary_block_data = [
            [
                Paragraph("<b>Key Completed Work:</b>", bold_body),
                Paragraph("<b>Remaining Deliverables:</b>", bold_body)
            ],
            [
                Paragraph(completed_bullet_text, body_style),
                Paragraph(remaining_bullet_text, body_style)
            ]
        ]
        summary_block_table = Table(summary_block_data, colWidths=[260, 270])
        summary_block_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F9FAFB')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(KeepTogether([summary_block_table]))
        
        # ── 6. FOOTER ──
        story.append(Spacer(1, 20))
        footer_table_data = [
            [
                Paragraph("Report generated dynamically by Fluxiflow. Client-Presentable Copy.", small_style),
                Paragraph("Page 1 of 1", small_style)
            ]
        ]
        footer_table = Table(footer_table_data, colWidths=[400, 130])
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('LINEABOVE', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(footer_table)
        
        doc.build(story)
        buffer.seek(0)
        return buffer
