import io
import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from django.utils import timezone
from django.db import transaction
from apps.accounts.models import CustomUser as User
from apps.tasks.models import Task, TaskAssignee, SubTask, SubTaskAssignee
from apps.tasks.serializers import TaskSerializer, SubTaskSerializer
from apps.activity.models import ActivityLog

def generate_bulk_template(project):
    wb = openpyxl.Workbook()
    # Remove default sheet
    default_sheet = wb.active
    if default_sheet is not None:
        wb.remove(default_sheet)
    
    # 1. Tasks Sheet
    ws_tasks = wb.create_sheet(title="Tasks")
    ws_tasks.views.sheetView[0].showGridLines = True
    ws_tasks.freeze_panes = "A2"
    
    headers = [
        "Title",
        "Description",
        "Priority",
        "Status",
        "Due Date",
        "Due Time",
        "Assignee Emails"
    ]
    
    header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    ws_tasks.row_dimensions[1].height = 28
    
    for col_idx, header in enumerate(headers, 1):
        cell = ws_tasks.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        
    thin_border = Border(
        left=Side(style='thin', color='E5E7EB'),
        right=Side(style='thin', color='E5E7EB'),
        top=Side(style='thin', color='E5E7EB'),
        bottom=Side(style='thin', color='E5E7EB')
    )
    
    for row in range(2, 100):
        # Format columns: E (5) is Due Date, F (6) is Due Time
        ws_tasks.cell(row=row, column=5).number_format = 'yyyy-mm-dd'
        ws_tasks.cell(row=row, column=6).number_format = 'hh:mm'
        
        for col in range(1, len(headers) + 1):
            cell = ws_tasks.cell(row=row, column=col)
            cell.border = thin_border
            cell.font = Font(name="Segoe UI", size=10)
            
    column_widths = {
        "A": 30,  # Title
        "B": 40,  # Description
        "C": 15,  # Priority
        "D": 15,  # Status
        "E": 15,  # Due Date
        "F": 12,  # Due Time
        "G": 30,  # Assignee Emails
    }
    for col_letter, width in column_widths.items():
        ws_tasks.column_dimensions[col_letter].width = width
        
    # Dropdown validations
    dv_priority = DataValidation(type="list", formula1='"Low,Medium,High"', allow_blank=True)
    dv_priority.error = 'Invalid Priority value. Must be Low, Medium, or High.'
    dv_priority.errorTitle = 'Invalid Value'
    dv_priority.prompt = 'Choose Low, Medium, or High'
    dv_priority.promptTitle = 'Priority'
    ws_tasks.add_data_validation(dv_priority)
    dv_priority.add("C2:C100")
    
    dv_status = DataValidation(type="list", formula1='"Pending,Completed"', allow_blank=True)
    dv_status.error = 'Invalid Status value. Must be Pending or Completed.'
    dv_status.errorTitle = 'Invalid Value'
    dv_status.prompt = 'Choose Pending or Completed'
    dv_status.promptTitle = 'Status'
    ws_tasks.add_data_validation(dv_status)
    dv_status.add("D2:D100")
    
    # 2. Instructions Sheet
    ws_instructions = wb.create_sheet(title="Instructions")
    ws_instructions.views.sheetView[0].showGridLines = True
    ws_instructions.column_dimensions["A"].width = 25
    ws_instructions.column_dimensions["B"].width = 80
    
    ws_instructions.merge_cells("A1:B1")
    title_cell = ws_instructions["A1"]
    title_cell.value = "Fluxiflow Task Import Instructions"
    title_cell.fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    title_cell.font = Font(name="Segoe UI", size=14, bold=True, color="FFFFFF")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_instructions.row_dimensions[1].height = 40
    
    instructions = [
        ("Column Name", "Requirements & Format"),
        ("Title", "Required. The name of the task. Max 255 characters."),
        ("Description", "Optional. Detailed task description."),
        ("Priority", "Optional. Allowed values: Low, Medium, High. (Default: Medium)."),
        ("Status", "Optional. Allowed values: Pending, Completed. (Default: Pending)."),
        ("Due Date", "Required. Format: YYYY-MM-DD (e.g. 2026-08-12)."),
        ("Due Time", "Optional. Format: HH:MM (24-hour, e.g. 14:30 or 09:00)."),
        ("Assignee Emails", "Optional. Comma-separated list of team member emails (e.g. muhammed@example.com, saleel@demo.com). Members must be active in the system.")
    ]
    
    for row_idx, (col, desc) in enumerate(instructions, 3):
        ws_instructions.row_dimensions[row_idx].height = 24
        cell_a = ws_instructions.cell(row=row_idx, column=1, value=col)
        cell_b = ws_instructions.cell(row=row_idx, column=2, value=desc)
        
        if row_idx == 3:
            cell_a.font = Font(name="Segoe UI", size=11, bold=True)
            cell_b.font = Font(name="Segoe UI", size=11, bold=True)
            cell_a.fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
            cell_b.fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
        else:
            cell_a.font = Font(name="Segoe UI", size=10, bold=True)
            cell_b.font = Font(name="Segoe UI", size=10)
            
        cell_a.border = thin_border
        cell_b.border = thin_border
        cell_a.alignment = Alignment(vertical="center", wrap_text=True)
        cell_b.alignment = Alignment(vertical="center", wrap_text=True)
        
    example_start_row = 13
    ws_instructions.merge_cells(start_row=example_start_row, start_column=1, end_row=example_start_row, end_column=2)
    ex_title = ws_instructions.cell(row=example_start_row, column=1, value="Example Structure:")
    ex_title.font = Font(name="Segoe UI", size=12, bold=True)
    
    example_headers = ["Title", "Description", "Priority", "Status", "Due Date", "Due Time", "Assignee Emails"]
    ws_instructions.row_dimensions[example_start_row+1].height = 20
    for col_idx, h in enumerate(example_headers, 1):
        c = ws_instructions.cell(row=example_start_row+1, column=col_idx, value=h)
        c.font = Font(name="Segoe UI", size=9, bold=True)
        c.fill = PatternFill(start_color="E5E7EB", end_color="E5E7EB", fill_type="solid")
        c.border = thin_border
        
    example_data = [
        ["Website Redesign", "Redesign the corporate site", "High", "Pending", "2026-08-15", "18:00", "member@demo.com"],
        ["Setup Django API", "Initialize endpoints for projects", "Medium", "Pending", "2026-08-20", "12:00", "saleel@demo.com, fidha@demo.com"],
    ]
    for r_offset, row_val in enumerate(example_data, 2):
        ws_instructions.row_dimensions[example_start_row+r_offset].height = 20
        for col_idx, val in enumerate(row_val, 1):
            c = ws_instructions.cell(row=example_start_row+r_offset, column=col_idx, value=val)
            c.font = Font(name="Segoe UI", size=9)
            c.border = thin_border
            
    # 3. Reference Data Sheet
    ws_ref = wb.create_sheet(title="Reference Data")
    ws_ref.views.sheetView[0].showGridLines = True
    ws_ref.column_dimensions["A"].width = 25
    ws_ref.column_dimensions["B"].width = 35
    
    ws_ref.cell(row=1, column=1, value="Member Name").font = Font(name="Segoe UI", size=11, bold=True)
    ws_ref.cell(row=1, column=1).fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    ws_ref.cell(row=1, column=2, value="Member Email (Use in Spreadsheet)").font = Font(name="Segoe UI", size=11, bold=True)
    ws_ref.cell(row=1, column=2).fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    
    if project.organization:
        active_members = User.objects.filter(is_active=True, memberships__organization=project.organization).distinct().order_by('name')
    else:
        active_members = User.objects.filter(is_active=True).order_by('name')
        
    for r_idx, member in enumerate(active_members, 2):
        ws_ref.cell(row=r_idx, column=1, value=member.name).border = thin_border
        ws_ref.cell(row=r_idx, column=2, value=member.email).border = thin_border
        ws_ref.cell(row=r_idx, column=1).font = Font(name="Segoe UI", size=10)
        ws_ref.cell(row=r_idx, column=2).font = Font(name="Segoe UI", size=10)
        
    # Valid Priorities & Statuses Reference list
    ws_ref.cell(row=1, column=4, value="Valid Priority Choices").font = Font(name="Segoe UI", size=11, bold=True)
    ws_ref.cell(row=1, column=4).fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    priorities = ["Low", "Medium", "High"]
    for idx, p in enumerate(priorities, 2):
        cell = ws_ref.cell(row=idx, column=4, value=p)
        cell.font = Font(name="Segoe UI", size=10)
        cell.border = thin_border
        
    ws_ref.cell(row=1, column=5, value="Valid Status Choices").font = Font(name="Segoe UI", size=11, bold=True)
    ws_ref.cell(row=1, column=5).fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    statuses = ["Pending", "Completed"]
    for idx, s in enumerate(statuses, 2):
        cell = ws_ref.cell(row=idx, column=5, value=s)
        cell.font = Font(name="Segoe UI", size=10)
        cell.border = thin_border
        
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()

def parse_excel_row_value_to_date(val):
    if val is None or str(val).strip() == "":
        return None
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.strftime("%Y-%m-%d")
    try:
        date_str = str(val).split(" ")[0].strip()
        parsed = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        return parsed.strftime("%Y-%m-%d")
    except ValueError:
        return str(val).strip()

def parse_excel_row_value_to_time(val):
    if val is None or str(val).strip() == "":
        return None
    if isinstance(val, datetime.time):
        return val.strftime("%H:%M")
    if isinstance(val, datetime.datetime):
        return val.time().strftime("%H:%M")
    try:
        time_str = str(val).strip()
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                parsed = datetime.datetime.strptime(time_str, fmt).time()
                return parsed.strftime("%H:%M")
            except ValueError:
                continue
        raise ValueError()
    except ValueError:
        return str(val).strip()

def parse_excel_file(file_obj):
    import uuid
    try:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
    except Exception as e:
        return False, f"Invalid Excel file structure: {str(e)}"
        
    if "Tasks" not in wb.sheetnames:
        return False, "The spreadsheet must contain a sheet named 'Tasks'."
        
    ws = wb["Tasks"]
    header_row = [cell.value for cell in ws[1]]
    expected_headers = ["Title", "Description", "Priority", "Status", "Due Date", "Due Time", "Assignee Emails"]
    
    col_mapping = {}
    for h in expected_headers:
        matched_idx = None
        for idx, val in enumerate(header_row):
            if val and str(val).strip().lower() == h.lower():
                matched_idx = idx + 1
                break
        col_mapping[h] = matched_idx
        
    if not col_mapping["Title"]:
        return False, "The 'Tasks' sheet must have at least a 'Title' column."
        
    def get_val(row_cells, header_name):
        col_idx = col_mapping.get(header_name)
        if not col_idx:
            return None
        val = row_cells[col_idx - 1].value
        if val is None:
            return None
        return str(val).strip()

    rows = list(ws.iter_rows(min_row=2))
    parsed_rows = []
    
    for row_idx, row in enumerate(rows, 2):
        if all(cell.value is None for cell in row):
            continue
            
        title = get_val(row, "Title")
        description = get_val(row, "Description")
        priority = get_val(row, "Priority")
        status = get_val(row, "Status")
        
        due_date_raw = row[col_mapping["Due Date"] - 1].value if col_mapping["Due Date"] else None
        due_time_raw = row[col_mapping["Due Time"] - 1].value if col_mapping["Due Time"] else None
        
        due_date = parse_excel_row_value_to_date(due_date_raw)
        due_time = parse_excel_row_value_to_time(due_time_raw)
        
        assignee_emails_str = get_val(row, "Assignee Emails")
        
        # Server-side auto-generated key:
        import_key = f"task_{row_idx}_{uuid.uuid4().hex[:6]}"
        
        parsed_rows.append({
            "row_number": row_idx,
            "import_key": import_key,
            "title": title,
            "description": description,
            "priority": priority,
            "status": status,
            "due_date": due_date,
            "due_time": due_time,
            "assignee_emails_str": assignee_emails_str,
            "parent_key": None,
        })
        
    return True, parsed_rows

def validate_bulk_import_data(tasks_list, project):
    errors = []
    
    if project.organization:
        org_users = User.objects.filter(memberships__organization=project.organization)
    else:
        org_users = User.objects.all()
    user_by_email = {u.email.lower(): u for u in org_users}
    
    # 1. Row duplicates check (compares all key task columns)
    seen_rows = []
    duplicate_count = 0
    for item in tasks_list:
        row_key = (
            (item.get("title") or "").strip().lower(),
            (item.get("description") or "").strip().lower(),
            (item.get("priority") or "").strip().lower(),
            (item.get("status") or "").strip().lower(),
            (item.get("due_date") or "").strip().lower(),
            (item.get("due_time") or "").strip().lower(),
            (item.get("assignee_emails_str") or "").strip().lower(),
        )
        if row_key in seen_rows:
            duplicate_count += 1
        else:
            seen_rows.append(row_key)
            
    # 2. General validation
    for item in tasks_list:
        row_idx = item.get("row_number", 0)
        title = item.get("title")
        priority = item.get("priority")
        status = item.get("status")
        due_date = item.get("due_date")
        due_time = item.get("due_time")
        assignee_emails_str = item.get("assignee_emails_str")
        
        # Title validation
        if not title or str(title).strip() == "":
            errors.append({
                "row": row_idx,
                "field": "Title",
                "value": "",
                "message": "Task Title is required."
            })
            
        # Priority validation
        if priority:
            p_val = str(priority).strip().upper()
            if p_val not in ["LOW", "MEDIUM", "HIGH"]:
                errors.append({
                    "row": row_idx,
                    "field": "Priority",
                    "value": str(priority),
                    "message": "Invalid Priority. Must be Low, Medium, or High."
                })
                
        # Status validation
        if status:
            s_val = str(status).strip().upper()
            if s_val not in ["PENDING", "COMPLETED"]:
                errors.append({
                    "row": row_idx,
                    "field": "Status",
                    "value": str(status),
                    "message": "Invalid Status. Must be Pending or Completed."
                })

        # Due date validation
        if not due_date or str(due_date).strip() == "":
            errors.append({
                "row": row_idx,
                "field": "Due Date",
                "value": "",
                "message": "Due Date is required."
            })
        else:
            try:
                datetime.datetime.strptime(str(due_date).strip(), "%Y-%m-%d")
            except ValueError:
                errors.append({
                    "row": row_idx,
                    "field": "Due Date",
                    "value": str(due_date),
                    "message": "Invalid Due Date format. Use YYYY-MM-DD."
                })
                
        # Due time validation
        if due_time and str(due_time).strip() != "":
            try:
                datetime.datetime.strptime(str(due_time).strip(), "%H:%M")
            except ValueError:
                errors.append({
                    "row": row_idx,
                    "field": "Due Time",
                    "value": str(due_time),
                    "message": "Invalid Due Time format. Use HH:MM."
                })
                
        # Assignee emails validation
        if assignee_emails_str and str(assignee_emails_str).strip() != "":
            emails = [e.strip() for e in assignee_emails_str.split(",") if e.strip()]
            for email in emails:
                email_lower = email.lower()
                if email_lower not in user_by_email:
                    errors.append({
                        "row": row_idx,
                        "field": "Assignee Emails",
                        "value": email,
                        "message": f"'{email}' is not a member of this workspace."
                      })
                else:
                    target_user = user_by_email[email_lower]
                    if not target_user.is_active:
                        errors.append({
                            "row": row_idx,
                            "field": "Assignee Emails",
                            "value": email,
                            "message": f"Cannot assign task to deactivated member(s): {target_user.name}."
                        })
                        
    return {"errors": errors, "duplicate_count": duplicate_count}

def import_tasks_confirm(tasks_list, project, request_user, request=None):
    total_tasks_created = 0
    
    if project.organization:
        org_users = User.objects.filter(memberships__organization=project.organization)
    else:
        org_users = User.objects.all()
    user_by_email = {u.email.lower(): u for u in org_users}
    
    with transaction.atomic():
        for row_data in tasks_list:
            # Resolve assignees
            assignees = []
            assignee_emails_str = row_data.get("assignee_emails_str")
            if assignee_emails_str and str(assignee_emails_str).strip() != "":
                emails = [e.strip() for e in assignee_emails_str.split(",") if e.strip()]
                for email in emails:
                    u = user_by_email.get(email.lower())
                    if u:
                        assignees.append(u)
            
            priority_val = str(row_data.get("priority", "MEDIUM")).strip().upper()
            status_val = str(row_data.get("status", "PENDING")).strip().upper()
            due_time_val = row_data.get("due_time")
            if due_time_val:
                due_time_val = f"{due_time_val}:00"
                
            serializer_data = {
                'project': str(project.id),
                'name': row_data.get("title"),
                'description': row_data.get("description"),
                'priority': priority_val,
                'status': 'PENDING',  # Create as PENDING first to execute assignee setup
                'due_date': row_data.get("due_date"),
                'due_time': due_time_val,
                'assignee_ids': [str(u.id) for u in assignees],
            }
            
            serializer = TaskSerializer(data=serializer_data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            task = serializer.save()
            
            # If project organization exists, save it on task
            if project.organization:
                task.organization = project.organization
                task.save()
                
            # Apply task completion logic if imported as COMPLETED
            if status_val == 'COMPLETED':
                # Complete task assignees first
                for assignee_rel in TaskAssignee.objects.filter(task=task):
                    assignee_rel.completed = True
                    assignee_rel.completed_at = timezone.now()
                    assignee_rel.save()
                    
                # Complete the main task
                task.status = 'COMPLETED'
                task.completed_by = request_user
                task.completed_at = timezone.now()
                task.save()
                
            total_tasks_created += 1
            
        # Log a single bulk import ActivityLog
        ActivityLog.objects.create(
            user=request_user,
            action='TASK_IMPORTED',
            entity_type='Project',
            entity_id=project.id,
            description=f"{request_user.name} imported {total_tasks_created} tasks into project '{project.name}'."
        )
        
    return total_tasks_created, 0
