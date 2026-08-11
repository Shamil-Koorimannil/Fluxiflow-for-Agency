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

def calculate_submission_status(task_assignee):
    """
    Returns (status_str, late_by_minutes)
    status_str: PENDING, OVERDUE, COMPLETED_ON_TIME, LATE
    """
    task = task_assignee.task
    due_dt = get_task_due_datetime(task.due_date, task.due_time)
    
    if not task_assignee.completed:
        now = timezone.now()
        if due_dt < now:
            return "OVERDUE", 0
        else:
            return "PENDING", 0
    else:
        completed_at = task_assignee.completed_at or timezone.now()
        if completed_at > due_dt:
            diff = completed_at - due_dt
            late_by_minutes = int(diff.total_seconds() // 60)
            return "LATE", late_by_minutes
        else:
            return "COMPLETED_ON_TIME", 0

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
