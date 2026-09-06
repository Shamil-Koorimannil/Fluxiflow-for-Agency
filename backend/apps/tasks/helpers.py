import datetime
from django.utils import timezone
from apps.core.timezone_utils import (
    resolve_business_tz,
    get_business_now,
    get_business_today,
    get_task_due_datetime_in_tz
)

def get_task_due_datetime(due_date, due_time, tz=None, request=None, organization=None, user=None):
    return get_task_due_datetime_in_tz(due_date, due_time, tz=tz, request=request, organization=organization, user=user)

def calculate_assignee_submission_status(assignee_obj, due_date, due_time, tz=None, request=None, organization=None, user=None):
    """
    Returns (status_str, late_by_minutes)
    status_str: PENDING, OVERDUE, COMPLETED_ON_TIME, LATE
    """
    if hasattr(assignee_obj, 'task'):
        is_completed = (assignee_obj.task.status == 'COMPLETED')
        completed_at = assignee_obj.task.completed_at
        if not organization:
            organization = getattr(assignee_obj.task, 'organization', None) or getattr(getattr(assignee_obj.task, 'project', None), 'organization', None)
        if not user:
            user = getattr(assignee_obj, 'user', None)
    else:
        is_completed = (assignee_obj.subtask.status == 'COMPLETED')
        completed_at = assignee_obj.subtask.completed_at
        if not organization:
            task = getattr(assignee_obj.subtask, 'task', None)
            organization = getattr(task, 'organization', None) or getattr(getattr(task, 'project', None), 'organization', None)
        if not user:
            user = getattr(assignee_obj, 'user', None)

    if not due_date:
        if not is_completed:
            return "PENDING", 0
        else:
            return "COMPLETED_ON_TIME", 0

    tz = resolve_business_tz(request=request, organization=organization, user=user)
    due_dt = get_task_due_datetime_in_tz(due_date, due_time, tz=tz)
    
    if not is_completed:
        now = get_business_now(tz=tz)
        if due_dt < now:
            return "OVERDUE", 0
        else:
            return "PENDING", 0
    else:
        completed_at_val = completed_at or get_business_now(tz=tz)
        if timezone.is_naive(completed_at_val):
            completed_at_val = timezone.make_aware(completed_at_val, tz)
        else:
            completed_at_val = completed_at_val.astimezone(tz)
            
        if completed_at_val > due_dt:
            diff = completed_at_val - due_dt
            late_by_minutes = int(diff.total_seconds() // 60)
            return "LATE", late_by_minutes
        else:
            return "COMPLETED_ON_TIME", 0

def calculate_submission_status(task_assignee, tz=None, request=None, organization=None, user=None):
    """
    Returns (status_str, late_by_minutes)
    status_str: PENDING, OVERDUE, COMPLETED_ON_TIME, LATE
    """
    return calculate_assignee_submission_status(
        task_assignee,
        task_assignee.task.due_date,
        task_assignee.task.due_time,
        tz=tz,
        request=request,
        organization=organization,
        user=user
    )

def format_late_duration(minutes):
    if not minutes or minutes <= 0:
        return ""
    
    days = minutes // 1440
    remaining = minutes % 1440
    hours = remaining // 60
    mins = remaining % 60
    
    if days > 0:
        if hours > 0:
            return f"{days}d {hours}h"
        return f"{days}d"
    
    if hours > 0:
        if mins > 0:
            return f"{hours}h {mins}m"
        return f"{hours}h"
        
    return f"{mins} min"

def format_notification_duration(minutes):
    if not minutes or minutes <= 0:
        return ""
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes / 60.0
    if hours.is_integer():
        return f"{int(hours)} hours" if int(hours) > 1 else "1 hour"
    return f"{hours:.1f} hours"

def calculate_date_display_color(due_date_str, due_time, is_completed, completed_at_val=None, tz=None, request=None, organization=None, user=None):
    from datetime import datetime, date, time, timedelta

    if not due_date_str:
        return "No due date", "gray"
        
    try:
        if isinstance(due_date_str, date):
            due_date = due_date_str
        else:
            due_date = date.fromisoformat(due_date_str)
    except Exception:
        try:
            due_date = datetime.fromisoformat(due_date_str).date()
        except Exception:
            return "Invalid Date", "gray"

    tz = resolve_business_tz(request=request, organization=organization, user=user)
    today = get_business_today(tz=tz)
    now_local = get_business_now(tz=tz)
    
    due_dt = get_task_due_datetime_in_tz(due_date, due_time, tz=tz)
    
    time_str = ""
    if due_time:
        if isinstance(due_time, str):
            try:
                due_time_obj = time.fromisoformat(due_time)
                time_str = f" · {due_time_obj.strftime('%I:%M %p')}"
            except Exception:
                time_str = f" · {due_time}"
        else:
            time_str = f" · {due_time.strftime('%I:%M %p')}"

    if is_completed:
        date_color = 'gray'
        if completed_at_val:
            if timezone.is_naive(completed_at_val):
                completed_local = timezone.make_aware(completed_at_val, tz)
            else:
                completed_local = completed_at_val.astimezone(tz)
            completed_date = completed_local.date()
            if completed_date == today:
                date_display = "Completed Today"
            elif completed_date == today - timedelta(days=1):
                date_display = "Completed Yesterday"
            else:
                date_display = f"Completed {completed_date.strftime('%b %d')}"
        else:
            date_display = "Completed"
    else:
        # Incomplete
        if due_dt < now_local:
            date_color = 'red'
            if due_date == today - timedelta(days=1):
                date_display = f"Yesterday{time_str}"
            else:
                date_display = f"{due_date.strftime('%b %d')}{time_str}"
        else:
            if due_date == today:
                date_color = 'amber'
                date_display = f"Today{time_str}"
            elif due_date == today + timedelta(days=1):
                date_color = 'green'
                date_display = f"Tomorrow{time_str}"
            else:
                date_color = 'gray'
                date_display = f"{due_date.strftime('%b %d')}{time_str}"

    return date_display, date_color
