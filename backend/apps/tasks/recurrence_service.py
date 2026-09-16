import calendar
import datetime
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from .models import Task, TaskAssignee, RecurringTaskSeries
from apps.core.timezone_utils import resolve_business_tz

WEEKDAY_MAP = {
    'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6,
    'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5, 'SUN': 6,
}
REVERSE_WEEKDAY_MAP = {v: k for k, v in WEEKDAY_MAP.items() if len(k) == 2}

class RecurrenceService:
    @staticmethod
    def calculate_next_date(series, current_date):
        """
        Calculates the next calendar due date based on the series rules and current instance date.
        Calculations are performed purely on datetime.date objects to avoid timezone shifts.
        """
        if not current_date:
            current_date = series.start_date

        freq = series.frequency.upper()
        interval = max(1, series.interval or 1)

        if freq == 'DAY':
            return current_date + datetime.timedelta(days=interval)

        elif freq == 'WEEK':
            raw_weekdays = series.weekdays or []
            selected_days = sorted(list(set(
                WEEKDAY_MAP[d.upper()] for d in raw_weekdays if d.upper() in WEEKDAY_MAP
            )))
            if not selected_days:
                selected_days = [current_date.weekday()]

            curr_weekday = current_date.weekday()
            
            # Check if there is a later selected weekday in the SAME week
            future_days_same_week = [d for d in selected_days if d > curr_weekday]
            if future_days_same_week:
                next_wday = future_days_same_week[0]
                days_ahead = next_wday - curr_weekday
                return current_date + datetime.timedelta(days=days_ahead)
            else:
                # Move forward by `interval` weeks, starting from the first selected weekday
                monday_of_curr_week = current_date - datetime.timedelta(days=curr_weekday)
                target_monday = monday_of_curr_week + datetime.timedelta(days=7 * interval)
                first_selected_day = selected_days[0]
                return target_monday + datetime.timedelta(days=first_selected_day)

        elif freq == 'MONTH':
            target_day = series.month_day or series.start_date.day
            total_months = current_date.year * 12 + (current_date.month - 1) + interval
            next_year = total_months // 12
            next_month = (total_months % 12) + 1
            max_days_in_month = calendar.monthrange(next_year, next_month)[1]
            next_day = min(target_day, max_days_in_month)
            return datetime.date(next_year, next_month, next_day)

        elif freq == 'YEAR':
            target_month = series.start_date.month
            target_day = series.month_day or series.start_date.day
            next_year = current_date.year + interval
            max_days_in_month = calendar.monthrange(next_year, target_month)[1]
            next_day = min(target_day, max_days_in_month)
            return datetime.date(next_year, target_month, next_day)

        return current_date + datetime.timedelta(days=1)

    @staticmethod
    def is_recurrence_ended(series, next_date, next_occurrence_number):
        """
        Determines whether the series end conditions have been reached.
        """
        end_type = series.end_type.upper() if series.end_type else 'NEVER'
        if end_type == 'ON':
            if series.end_date and next_date > series.end_date:
                return True
        elif end_type == 'AFTER':
            if series.occurrence_count and next_occurrence_number > series.occurrence_count:
                return True
        return False

    @staticmethod
    def validate_recurrence_data(data, has_subtasks=False):
        """
        Validates the incoming recurrence payload dict.
        Raises serializers.ValidationError if invalid.
        """
        if not data:
            return None

        freq_val = str(data.get('frequency', '')).lower()
        if freq_val in ('', 'none', 'does_not_repeat', 'no_repeat'):
            return None

        if has_subtasks:
            raise serializers.ValidationError({"recurrence": "Tasks with subtasks cannot be repeated."})

        valid_frequencies = ['day', 'week', 'month', 'year']
        if freq_val not in valid_frequencies:
            raise serializers.ValidationError({"recurrence": f"Invalid frequency '{freq_val}'. Must be one of {valid_frequencies}."})

        interval = data.get('interval', 1)
        if not isinstance(interval, int) or interval < 1:
            raise serializers.ValidationError({"recurrence": "Interval must be a positive integer."})

        weekdays = data.get('weekdays', [])
        if weekdays:
            if not isinstance(weekdays, list):
                raise serializers.ValidationError({"recurrence": "Weekdays must be a list."})
            for w in weekdays:
                if str(w).upper() not in WEEKDAY_MAP:
                    raise serializers.ValidationError({"recurrence": f"Invalid weekday '{w}'."})

        month_day = data.get('month_day')
        if month_day is not None:
            if not isinstance(month_day, int) or not (1 <= month_day <= 31):
                raise serializers.ValidationError({"recurrence": "month_day must be an integer between 1 and 31."})

        end_type = str(data.get('end_type', 'never')).lower()
        valid_end_types = ['never', 'on', 'after']
        if end_type not in valid_end_types:
            raise serializers.ValidationError({"recurrence": f"Invalid end_type '{end_type}'."})

        end_date = data.get('end_date')
        if end_type == 'on' and not end_date:
            raise serializers.ValidationError({"recurrence": "end_date is required when end_type is 'on'."})

        occurrence_count = data.get('occurrence_count')
        if end_type == 'after':
            if not isinstance(occurrence_count, int) or occurrence_count < 1:
                raise serializers.ValidationError({"recurrence": "occurrence_count must be a positive integer when end_type is 'after'."})

        return {
            'frequency': freq_val.upper(),
            'interval': interval,
            'weekdays': [str(w).upper()[:2] for w in weekdays] if weekdays else [],
            'month_day': month_day,
            'end_type': end_type.upper(),
            'end_date': end_date,
            'occurrence_count': occurrence_count,
        }

    @classmethod
    def apply_recurrence(cls, task, recurrence_data, user, active_org, request=None):
        """
        Creates, updates, or stops a RecurringTaskSeries for a given task.
        """
        has_subtasks = task.subtasks.exists() if task.pk else False
        clean_data = cls.validate_recurrence_data(recurrence_data, has_subtasks=has_subtasks)

        # Stopping recurrence
        if not clean_data:
            if task.recurring_series:
                series = task.recurring_series
                series.is_active = False
                series.save(update_fields=['is_active'])
                task.recurring_series = None
                task.save(update_fields=['recurring_series'])
            return None

        tz_obj = resolve_business_tz(request=request, organization=active_org, user=user)
        tz_str = str(tz_obj)

        start_date = task.due_date or timezone.now().date()

        if task.recurring_series:
            series = task.recurring_series
            series.frequency = clean_data['frequency']
            series.interval = clean_data['interval']
            series.weekdays = clean_data['weekdays']
            series.month_day = clean_data['month_day']
            series.end_type = clean_data['end_type']
            series.end_date = clean_data['end_date']
            series.occurrence_count = clean_data['occurrence_count']
            series.timezone = tz_str
            series.is_active = True
            series.save()
        else:
            series = RecurringTaskSeries.objects.create(
                organization=active_org,
                created_by=user,
                frequency=clean_data['frequency'],
                interval=clean_data['interval'],
                weekdays=clean_data['weekdays'],
                month_day=clean_data['month_day'],
                start_date=start_date,
                end_type=clean_data['end_type'],
                end_date=clean_data['end_date'],
                occurrence_count=clean_data['occurrence_count'],
                current_occurrence_number=1,
                timezone=tz_str,
                is_active=True
            )
            task.recurring_series = series
            task.recurrence_instance_date = start_date
            task.occurrence_index = 1
            task.save(update_fields=['recurring_series', 'recurrence_instance_date', 'occurrence_index'])

        return series

    @classmethod
    def materialize_next_occurrence(cls, task):
        """
        Generates the next occurrence for a completed recurring task.
        Safe against race conditions using select_for_update inside an atomic transaction.
        """
        if not task.recurring_series_id:
            return None

        with transaction.atomic():
            try:
                series = RecurringTaskSeries.objects.select_for_update().get(id=task.recurring_series_id)
            except RecurringTaskSeries.DoesNotExist:
                return None

            if not series.is_active:
                return None

            curr_date = task.recurrence_instance_date or task.due_date or series.start_date
            curr_index = task.occurrence_index or 1
            next_index = curr_index + 1
            next_date = cls.calculate_next_date(series, curr_date)

            if cls.is_recurrence_ended(series, next_date, next_index):
                series.is_active = False
                series.save(update_fields=['is_active'])
                return None

            # Idempotency check: avoid duplicate instance creation
            existing = Task.objects.filter(recurring_series=series, recurrence_instance_date=next_date).first()
            if existing:
                return existing

            # Materialize next instance
            next_task = Task.objects.create(
                project=task.project,
                organization=task.organization,
                task_type=task.task_type,
                name=task.name,
                description=task.description,
                priority=task.priority,
                due_date=next_date,
                due_time=task.due_time,
                status='PENDING',
                created_by=task.created_by,
                allocated_seconds=task.allocated_seconds,
                elapsed_seconds=0,
                timer_status='NOT_STARTED',
                recurring_series=series,
                recurrence_instance_date=next_date,
                occurrence_index=next_index,
                approval_required=task.approval_required,
                approval_status='NOT_STARTED' if task.approval_required else 'NOT_REQUIRED',
                approver=task.approver,
            )

            # Re-create assignees starting fresh (completed=False, completed_at=None)
            for rel in task.assignee_relationships.select_related('user').all():
                TaskAssignee.objects.create(
                    task=next_task,
                    user=rel.user,
                    completed=False,
                    completed_at=None
                )

            series.current_occurrence_number = next_index
            series.save(update_fields=['current_occurrence_number'])

            return next_task
