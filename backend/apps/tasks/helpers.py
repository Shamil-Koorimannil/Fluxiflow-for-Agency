import datetime
from django.utils import timezone
from django.utils.timezone import make_aware

def get_task_due_datetime(due_date, due_time):
    if due_time:
        due_dt = datetime.datetime.combine(due_date, due_time)
    else:
        # End of the configured local day
        due_dt = datetime.datetime.combine(due_date, datetime.time.max)
    if timezone.is_naive(due_dt):
        return make_aware(due_dt)
    return due_dt

def calculate_assignee_submission_status(assignee_obj, due_date, due_time):
    """
    Returns (status_str, late_by_minutes)
    status_str: PENDING, OVERDUE, COMPLETED_ON_TIME, LATE
    """
    if not due_date:
        if not assignee_obj.completed:
            return "PENDING", 0
        else:
            return "COMPLETED_ON_TIME", 0

    due_dt = get_task_due_datetime(due_date, due_time)
    
    if not assignee_obj.completed:
        now = timezone.now()
        if due_dt < now:
            return "OVERDUE", 0
        else:
            return "PENDING", 0
    else:
        completed_at = assignee_obj.completed_at or timezone.now()
        if completed_at > due_dt:
            diff = completed_at - due_dt
            late_by_minutes = int(diff.total_seconds() // 60)
            return "LATE", late_by_minutes
        else:
            return "COMPLETED_ON_TIME", 0

def calculate_submission_status(task_assignee):
    """
    Returns (status_str, late_by_minutes)
    status_str: PENDING, OVERDUE, COMPLETED_ON_TIME, LATE
    """
    return calculate_assignee_submission_status(task_assignee, task_assignee.task.due_date, task_assignee.task.due_time)

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

def calculate_date_display_color(due_date_str, due_time, is_completed, completed_at_val=None):
    from datetime import datetime, date, time, timedelta
    from django.utils import timezone

    if not due_date_str:
        return "No due date", "gray"
        
    try:
        if isinstance(due_date_str, date):
            due_date = due_date_str
        else:
            due_date = date.fromisoformat(due_date_str)
    except Exception:
        # Fallback if string is datetime
        try:
            due_date = datetime.fromisoformat(due_date_str).date()
        except Exception:
            return "Invalid Date", "gray"
            
    today = timezone.localtime(timezone.now()).date()
    now_local = timezone.localtime(timezone.now())
    
    # Combine due date & time to make aware datetime for comparison
    if due_time:
        if isinstance(due_time, str):
            try:
                due_time = time.fromisoformat(due_time)
            except Exception:
                due_time = time(23, 59, 59)
        due_dt = datetime.combine(due_date, due_time)
    else:
        due_dt = datetime.combine(due_date, time(23, 59, 59))
        
    if timezone.is_naive(due_dt):
        due_dt = timezone.make_aware(due_dt, timezone.get_current_timezone())
        
    due_dt = timezone.localtime(due_dt)
    
    time_str = ""
    if due_time:
        time_str = f" · {due_time.strftime('%I:%M %p').lstrip('0')}"

    if is_completed:
        date_color = 'gray'
        if completed_at_val:
            completed_local = timezone.localtime(completed_at_val)
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
            # Overdue!
            date_color = 'red'
            if due_date == today - timedelta(days=1):
                date_display = f"Yesterday{time_str}"
            else:
                date_display = f"{due_date.strftime('%b %d')}{time_str}"
        else:
            # Future or Today
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

