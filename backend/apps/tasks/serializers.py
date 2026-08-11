from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Task, TaskAssignee, SubTask
from apps.accounts.serializers import UserSerializer
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer

User = get_user_model()

class SubTaskSerializer(serializers.ModelSerializer):
    completed_by_detail = UserSerializer(source='completed_by', read_only=True)

    class Meta:
        model = SubTask
        fields = ['id', 'task', 'name', 'status', 'completed_by', 'completed_by_detail', 'completed_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'completed_by', 'completed_at', 'created_at', 'updated_at']

class TaskSerializer(serializers.ModelSerializer):
    subtasks = SubTaskSerializer(many=True, read_only=True)
    assignees = serializers.SerializerMethodField()
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    project_detail = ProjectSerializer(source='project', read_only=True)
    created_by_detail = UserSerializer(source='created_by', read_only=True)
    completed_by_detail = UserSerializer(source='completed_by', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'name', 'description', 'due_date', 'due_time',
            'priority', 'status', 'created_by', 'created_by_detail', 'completed_by', 'completed_by_detail',
            'completed_at', 'created_at', 'updated_at', 'subtasks', 'assignees', 'assignee_ids',
            'project_detail'
        ]
        read_only_fields = [
            'id', 'created_by', 'completed_by', 'completed_at', 'created_at', 'updated_at',
            'project_detail', 'created_by_detail', 'completed_by_detail'
        ]

    def get_assignees(self, obj):
        relationships = TaskAssignee.objects.filter(task=obj).select_related('user')
        data = []
        from apps.tasks.helpers import calculate_submission_status
        for rel in relationships:
            user_data = UserSerializer(rel.user, context=self.context).data
            sub_status, late_mins = calculate_submission_status(rel)
            user_data['completed'] = rel.completed
            user_data['completed_at'] = rel.completed_at.isoformat() if rel.completed_at else None
            user_data['submission_status'] = sub_status
            user_data['late_by_minutes'] = late_mins
            data.append(user_data)
        return data

    def validate(self, data):
        return data

    def validate_assignee_ids(self, value):
        if not value:
            return value
        # Find any inactive users in value
        inactive_users = User.objects.filter(id__in=value, is_active=False)
        # If this is a create request, we fail if any user is inactive
        is_create = self.instance is None
        if is_create:
            if inactive_users.exists():
                names = ", ".join([u.name for u in inactive_users])
                raise serializers.ValidationError(f"Cannot assign task to deactivated member(s): {names}")
        else:
            # For update: check if any of the inactive users in 'value' were NOT already assigned to this task
            existing_assignee_ids = set(
                TaskAssignee.objects.filter(task=self.instance).values_list('user_id', flat=True)
            )
            newly_added_inactive_users = [u for u in inactive_users if u.id not in existing_assignee_ids]
            if newly_added_inactive_users:
                names = ", ".join([u.name for u in newly_added_inactive_users])
                raise serializers.ValidationError(f"Cannot assign task to deactivated member(s): {names}")
        return value

    def create(self, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', [])
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            
        task = Task.objects.create(**validated_data)
        
        from apps.notifications.services import NotificationService

        # Create TaskAssignee relationships
        current_assignees = []
        for uid in assignee_ids:
            try:
                user = User.objects.get(id=uid)
                TaskAssignee.objects.get_or_create(task=task, user=user)
                current_assignees.append(user)
            except User.DoesNotExist:
                pass

        if current_assignees:
            NotificationService.handle_task_assignment_notifications(
                task=task,
                previous_assignees=[],
                current_assignees=current_assignees,
                actor=request.user if (request and request.user.is_authenticated) else task.created_by
            )
                
        return task

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        request = self.context.get('request')
        target_user = self.context.get('target_user')
        user_to_check = target_user or (request.user if request and request.user.is_authenticated else None)
        
        is_completed = False
        completed_at_val = None
        
        from apps.tasks.helpers import calculate_submission_status, get_task_due_datetime, get_task_due_datetime as get_due_dt_helper
        
        due_dt = get_due_dt_helper(instance.due_date, instance.due_time)
        rep['due_datetime'] = due_dt.isoformat()
        
        if user_to_check:
            assignee = TaskAssignee.objects.filter(task=instance, user=user_to_check).first()
            if assignee:
                sub_status, late_mins = calculate_submission_status(assignee)
                rep['submission_status'] = sub_status
                rep['late_by_minutes'] = late_mins
                
                is_completed = assignee.completed
                completed_at_val = assignee.completed_at
                
                # Override task fields with assignee-specific values
                rep['status'] = 'COMPLETED' if assignee.completed else 'PENDING'
                rep['completed_at'] = assignee.completed_at.isoformat() if assignee.completed_at else None
                if not assignee.completed:
                    rep['completed_by'] = None
                    rep['completed_by_detail'] = None
                else:
                    rep['completed_by'] = str(user_to_check.id)
                    rep['completed_by_detail'] = UserSerializer(user_to_check, context=self.context).data
            else:
                is_completed = instance.status == 'COMPLETED'
                completed_at_val = instance.completed_at
                
                # Calculate based on overall task details
                from apps.tasks.helpers import get_task_due_datetime
                due_dt_task = get_task_due_datetime(instance.due_date, instance.due_time)
                if not is_completed:
                    now = timezone.now()
                    sub_status = "OVERDUE" if due_dt_task < now else "PENDING"
                    late_mins = 0
                else:
                    comp_at = completed_at_val or timezone.now()
                    if comp_at > due_dt_task:
                        sub_status = "LATE"
                        late_mins = int((comp_at - due_dt_task).total_seconds() // 60)
                    else:
                        sub_status = "COMPLETED_ON_TIME"
                        late_mins = 0
                
                rep['submission_status'] = sub_status
                rep['late_by_minutes'] = late_mins
        else:
            is_completed = instance.status == 'COMPLETED'
            completed_at_val = instance.completed_at
            
            # Calculate based on overall task details
            from apps.tasks.helpers import get_task_due_datetime
            due_dt_task = get_task_due_datetime(instance.due_date, instance.due_time)
            if not is_completed:
                now = timezone.now()
                sub_status = "OVERDUE" if due_dt_task < now else "PENDING"
                late_mins = 0
            else:
                comp_at = completed_at_val or timezone.now()
                if comp_at > due_dt_task:
                    sub_status = "LATE"
                    late_mins = int((comp_at - due_dt_task).total_seconds() // 60)
                else:
                    sub_status = "COMPLETED_ON_TIME"
                    late_mins = 0
            
            rep['submission_status'] = sub_status
            rep['late_by_minutes'] = late_mins

        # Calculate date representation
        from datetime import timedelta, time, datetime
        
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        
        due_date = instance.due_date
        due_time = instance.due_time
        
        # Combine due date & time to make aware datetime for comparison
        if due_time:
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

        rep['date_display'] = date_display
        rep['date_color'] = date_color
        return rep

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', None)
        
        # Call super update
        instance = super().update(instance, validated_data)
        
        # If assignee_ids are updated
        if assignee_ids is not None:
            from apps.notifications.services import NotificationService
            request = self.context.get('request')
            
            # Fetch previous assignees list
            previous_assignees = [rel.user for rel in TaskAssignee.objects.filter(task=instance).select_related('user')]

            # Delete assignee relations that are no longer assigned
            TaskAssignee.objects.filter(task=instance).exclude(user_id__in=assignee_ids).delete()
            
            # Add new assignees without resetting existing ones
            current_assignees = []
            for uid in assignee_ids:
                try:
                    user = User.objects.get(id=uid)
                    TaskAssignee.objects.get_or_create(task=instance, user=user)
                    current_assignees.append(user)
                except User.DoesNotExist:
                    pass

            # Trigger assignment/unassignment/reassignment notifications
            actor = request.user if (request and request.user.is_authenticated) else instance.created_by
            NotificationService.handle_task_assignment_notifications(
                task=instance,
                previous_assignees=previous_assignees,
                current_assignees=current_assignees,
                actor=actor
            )
                    
        return instance
