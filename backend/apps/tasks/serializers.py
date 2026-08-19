from rest_framework import serializers
from django.utils import timezone
from apps.accounts.models import CustomUser as User
from apps.accounts.serializers import UserSerializer
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer
from .models import Task, TaskAssignee, SubTask, SubTaskAssignee

class SubTaskAssigneeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    submission_status = serializers.SerializerMethodField()
    late_by_minutes = serializers.SerializerMethodField()

    class Meta:
        model = SubTaskAssignee
        fields = ['user', 'completed', 'completed_at', 'submission_status', 'late_by_minutes']

    def get_submission_status(self, obj):
        from apps.tasks.helpers import calculate_assignee_submission_status
        status_str, _ = calculate_assignee_submission_status(obj, obj.subtask.due_date, obj.subtask.due_time)
        return status_str

    def get_late_by_minutes(self, obj):
        from apps.tasks.helpers import calculate_assignee_submission_status
        _, late_mins = calculate_assignee_submission_status(obj, obj.subtask.due_date, obj.subtask.due_time)
        return late_mins

class SubTaskSerializer(serializers.ModelSerializer):
    completed_by_detail = UserSerializer(source='completed_by', read_only=True)
    assignees = SubTaskAssigneeSerializer(source='assignee_relationships', many=True, read_only=True)
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    submission_status = serializers.SerializerMethodField()
    late_by_minutes = serializers.SerializerMethodField()
    due_datetime = serializers.SerializerMethodField()

    class Meta:
        model = SubTask
        fields = [
            'id', 'task', 'name', 'status', 'due_date', 'due_time', 'due_datetime',
            'completed_by', 'completed_by_detail', 'completed_at',
            'created_at', 'updated_at', 'assignees', 'assignee_ids',
            'submission_status', 'late_by_minutes'
        ]
        read_only_fields = ['id', 'completed_by', 'completed_at', 'created_at', 'updated_at']

    def get_due_datetime(self, obj):
        if not obj.due_date:
            return None
        from apps.tasks.helpers import get_task_due_datetime
        return get_task_due_datetime(obj.due_date, obj.due_time).isoformat()

    def get_submission_status(self, obj):
        if not obj.due_date:
            return "COMPLETED_ON_TIME" if obj.status == "COMPLETED" else "PENDING"
        from apps.tasks.helpers import get_task_due_datetime
        due_dt = get_task_due_datetime(obj.due_date, obj.due_time)
        if obj.status == "COMPLETED":
            completed_at = obj.completed_at or timezone.now()
            if completed_at > due_dt:
                return "LATE"
            return "COMPLETED_ON_TIME"
        else:
            now = timezone.now()
            if due_dt < now:
                return "OVERDUE"
            return "PENDING"

    def get_late_by_minutes(self, obj):
        if not obj.due_date or obj.status != "COMPLETED":
            return 0
        from apps.tasks.helpers import get_task_due_datetime
        due_dt = get_task_due_datetime(obj.due_date, obj.due_time)
        completed_at = obj.completed_at or timezone.now()
        if completed_at > due_dt:
            return int((completed_at - due_dt).total_seconds() // 60)
        return 0

    def validate_assignee_ids(self, value):
        if not value:
            return value
        inactive_users = User.objects.filter(id__in=value, is_active=False)
        is_create = self.instance is None
        if is_create:
            if inactive_users.exists():
                names = ", ".join([u.name for u in inactive_users])
                raise serializers.ValidationError(f"Cannot assign subtask to deactivated member(s): {names}")
        else:
            existing_assignee_ids = set(
                SubTaskAssignee.objects.filter(subtask=self.instance).values_list('user_id', flat=True)
            )
            newly_added_inactive_users = [u for u in inactive_users if u.id not in existing_assignee_ids]
            if newly_added_inactive_users:
                names = ", ".join([u.name for u in newly_added_inactive_users])
                raise serializers.ValidationError(f"Cannot assign subtask to deactivated member(s): {names}")
        return value

    def create(self, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', [])
        subtask = SubTask.objects.create(**validated_data)
        
        from apps.notifications.services import NotificationService
        
        current_assignees = []
        for uid in assignee_ids:
            try:
                user = User.objects.get(id=uid)
                SubTaskAssignee.objects.get_or_create(subtask=subtask, user=user)
                current_assignees.append(user)
            except User.DoesNotExist:
                pass
                
        if current_assignees:
            request = self.context.get('request')
            actor = request.user if (request and request.user.is_authenticated) else subtask.task.created_by
            NotificationService.handle_subtask_assignment_notifications(
                subtask=subtask,
                previous_assignees=[],
                current_assignees=current_assignees,
                actor=actor
            )
        return subtask

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', None)
        
        due_date_changed = 'due_date' in validated_data and validated_data['due_date'] != instance.due_date
        due_time_changed = 'due_time' in validated_data and validated_data['due_time'] != instance.due_time
        
        instance = super().update(instance, validated_data)
        
        if assignee_ids is not None:
            from apps.notifications.services import NotificationService
            request = self.context.get('request')
            previous_assignees = [rel.user for rel in SubTaskAssignee.objects.filter(subtask=instance).select_related('user')]
            
            SubTaskAssignee.objects.filter(subtask=instance).exclude(user_id__in=assignee_ids).delete()
            
            current_assignees = []
            for uid in assignee_ids:
                try:
                    user = User.objects.get(id=uid)
                    SubTaskAssignee.objects.get_or_create(subtask=instance, user=user)
                    current_assignees.append(user)
                except User.DoesNotExist:
                    pass
                    
            actor = request.user if (request and request.user.is_authenticated) else instance.task.created_by
            NotificationService.handle_subtask_assignment_notifications(
                subtask=instance,
                previous_assignees=previous_assignees,
                current_assignees=current_assignees,
                actor=actor
            )
        
        if (due_date_changed or due_time_changed):
            from apps.notifications.services import NotificationService
            request = self.context.get('request')
            actor = request.user if (request and request.user.is_authenticated) else instance.task.created_by
            current_assignees = [rel.user for rel in SubTaskAssignee.objects.filter(subtask=instance).select_related('user')]
            for user in current_assignees:
                NotificationService.create_notification(
                    recipient=user,
                    notification_type='TASK_DUE_SOON',
                    title='Subtask Deadline Changed',
                    message=f'The due date for subtask "{instance.name}" under task "{instance.task.name}" was changed.',
                    related_task=instance.task,
                    related_project=instance.task.project,
                    related_user=actor
                )
                
        return instance

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
        status_val = data.get('status')
        if status_val == 'COMPLETED':
            if self.instance and self.instance.subtasks.exclude(status='COMPLETED').exists():
                raise serializers.ValidationError(
                    {"status": "All subtasks must be completed before the task can be completed."}
                )
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
            
        project = validated_data.get('project')
        if project and project.organization:
            validated_data['organization'] = project.organization
        elif request and request.user:
            from apps.accounts.models import Membership
            user_membership = Membership.objects.filter(user=request.user).first()
            if user_membership:
                validated_data['organization'] = user_membership.organization

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
        # Calculate overall status based on assignees
        assignees_rels = TaskAssignee.objects.filter(task=instance)
        total_assignees = assignees_rels.count()
        completed_assignees = assignees_rels.filter(completed=True).count()
        
        if total_assignees > 0:
            if completed_assignees == total_assignees:
                overall_status = 'COMPLETED'
            elif completed_assignees > 0:
                overall_status = 'IN_PROGRESS'
            else:
                overall_status = 'PENDING'
        else:
            overall_status = 'COMPLETED' if instance.status == 'COMPLETED' else 'PENDING'
            
        rep['overall_status'] = overall_status

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
            time_str = f" · {due_time.strftime('%I:%M %p')}"

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
