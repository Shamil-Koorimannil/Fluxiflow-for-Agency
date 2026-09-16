from rest_framework import serializers
import uuid
from django.utils import timezone
from apps.accounts.models import CustomUser as User
from apps.accounts.serializers import UserSerializer
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer
from django.db import transaction
from .models import Task, TaskAssignee, SubTask, SubTaskAssignee, TaskComment, TaskAttachment, TaskType, TaskTimeLog

class SubTaskAssigneeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    submission_status = serializers.SerializerMethodField()
    late_by_minutes = serializers.SerializerMethodField()

    class Meta:  # type: ignore
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
    parent_task_name = serializers.ReadOnlyField(source='task.name')

    class Meta:  # type: ignore
        model = SubTask
        fields = [
            'id', 'task', 'name', 'status', 'due_date', 'due_time', 'due_datetime',
            'completed_by', 'completed_by_detail', 'completed_at',
            'created_at', 'updated_at', 'assignees', 'assignee_ids',
            'submission_status', 'late_by_minutes', 'parent_task_name'
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

        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            from apps.accounts.tenant_context import get_active_organization
            from apps.accounts.models import Membership
            active_org = get_active_organization(request.user, request=request)
            if active_org:
                valid_member_ids = set(
                    Membership.objects.filter(organization=active_org, is_active=True).values_list('user_id', flat=True)
                )
                invalid_user_ids = [uid for uid in value if uid not in valid_member_ids]
                if invalid_user_ids:
                    cross_tenant = Membership.objects.filter(
                        user_id__in=invalid_user_ids,
                        is_active=True
                    ).exclude(organization=active_org)
                    if cross_tenant.exists():
                        raise serializers.ValidationError("Cannot assign members outside the active organization.")

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

class TaskTypeSerializer(serializers.ModelSerializer):
    allocated_hours = serializers.SerializerMethodField()

    class Meta:
        model = TaskType
        fields = ['id', 'name', 'description', 'allocated_seconds', 'allocated_hours', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_allocated_hours(self, obj):
        if not obj.allocated_seconds:
            return 0
        return round(obj.allocated_seconds / 3600, 2)

    def validate_name(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Task type name cannot be blank.")
        return str(value).strip()

    def validate(self, attrs):
        name = attrs.get('name')
        if name:
            name = name.strip()
            attrs['name'] = name
            request = self.context.get('request')
            if request and request.user and request.user.is_authenticated:
                from apps.accounts.tenant_context import get_active_organization
                org = get_active_organization(request.user, request=request)
                if org:
                    qs = TaskType.objects.filter(organization=org, name__iexact=name)
                    if self.instance:
                        qs = qs.exclude(id=self.instance.id)
                    if qs.exists():
                        raise serializers.ValidationError({"name": "A task type with this name already exists in this organization."})
        return attrs

class TaskTimeLogSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)

    class Meta:
        model = TaskTimeLog
        fields = ['id', 'task', 'user', 'user_detail', 'started_at', 'paused_at', 'duration_seconds', 'created_at']
        read_only_fields = ['id', 'created_at']

class TaskSerializer(serializers.ModelSerializer):
    subtasks = SubTaskSerializer(many=True, read_only=True)
    assignees = serializers.SerializerMethodField()
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    created_by_detail = UserSerializer(source='created_by', read_only=True)
    completed_by_detail = UserSerializer(source='completed_by', read_only=True)
    approver_detail = UserSerializer(source='approver', read_only=True)
    approved_by_detail = UserSerializer(source='approved_by', read_only=True)
    project_detail = ProjectSerializer(source='project', read_only=True)
    has_unread_activity = serializers.SerializerMethodField()
    unread_activity_types = serializers.SerializerMethodField()
    
    # Task Type & Timer fields
    task_type_detail = TaskTypeSerializer(source='task_type', read_only=True)
    current_elapsed_seconds = serializers.SerializerMethodField()
    remaining_seconds = serializers.SerializerMethodField()
    is_overtime = serializers.SerializerMethodField()
    overtime_seconds = serializers.SerializerMethodField()
    user_completed = serializers.SerializerMethodField()
    is_recurring = serializers.SerializerMethodField()
    recurrence = serializers.SerializerMethodField()

    dates = serializers.ListField(
        child=serializers.DateField(),
        required=False,
        allow_empty=True,
        write_only=True
    )

    class Meta:  # type: ignore
        model = Task
        fields = [
            'id', 'project', 'name', 'description', 'due_date', 'due_time', 'dates',
            'priority', 'status', 'user_completed', 'created_by', 'created_by_detail', 'completed_by', 'completed_by_detail',
            'completed_at', 'created_at', 'updated_at', 'subtasks', 'assignees', 'assignee_ids',
            'project_detail',
            'approval_required', 'approval_status', 'approver', 'approver_detail', 'approved_by', 'approved_by_detail', 'approved_at',
            'has_unread_activity', 'unread_activity_types',
            'task_type', 'task_type_detail', 'allocated_seconds', 'elapsed_seconds', 'timer_started_at',
            'timer_status', 'actual_duration_seconds', 'current_elapsed_seconds', 'remaining_seconds',
            'is_overtime', 'overtime_seconds',
            'is_recurring', 'recurrence'
        ]
        read_only_fields = [
            'id', 'created_by', 'completed_by', 'completed_at', 'created_at', 'updated_at',
            'project_detail', 'created_by_detail', 'completed_by_detail', 'task_type_detail',
            'approval_status', 'approver_detail', 'approved_by', 'approved_by_detail', 'approved_at'
        ]

    def get_is_recurring(self, obj):
        return bool(obj.recurring_series_id and obj.recurring_series.is_active)

    def get_recurrence(self, obj):
        if obj.recurring_series_id and obj.recurring_series.is_active:
            s = obj.recurring_series
            return {
                "frequency": s.frequency.lower(),
                "interval": s.interval,
                "weekdays": s.weekdays or [],
                "month_day": s.month_day,
                "end_type": s.end_type.lower(),
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "occurrence_count": s.occurrence_count
            }
        return None

    def get_user_completed(self, obj):
        request = self.context.get('request')
        target_user = self.context.get('target_user')
        user_to_check = target_user or (request.user if request and request.user.is_authenticated else None)
        if user_to_check:
            assignee = TaskAssignee.objects.filter(task=obj, user=user_to_check).first()
            if assignee:
                return assignee.completed
        return obj.status == 'COMPLETED'

    def get_current_elapsed_seconds(self, obj):
        if obj.timer_status == 'RUNNING' and obj.timer_started_at:
            delta = (timezone.now() - obj.timer_started_at).total_seconds()
            return obj.elapsed_seconds + int(delta)
        if obj.status == 'COMPLETED' and obj.actual_duration_seconds is not None:
            return obj.actual_duration_seconds
        return obj.elapsed_seconds or 0

    def get_remaining_seconds(self, obj):
        allocated = obj.allocated_seconds or 0
        current_elapsed = self.get_current_elapsed_seconds(obj)
        return max(0, allocated - current_elapsed)

    def get_is_overtime(self, obj):
        allocated = obj.allocated_seconds or 0
        if not allocated:
            return False
        current_elapsed = self.get_current_elapsed_seconds(obj)
        return current_elapsed > allocated

    def get_overtime_seconds(self, obj):
        allocated = obj.allocated_seconds or 0
        if not allocated:
            return 0
        current_elapsed = self.get_current_elapsed_seconds(obj)
        return max(0, current_elapsed - allocated)

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

    def get_has_unread_activity(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        from apps.notifications.models import Notification
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)
        if not active_org:
            return False
        return Notification.objects.filter(
            recipient=request.user,
            organization=active_org,
            related_task=obj,
            is_read=False
        ).exists()

    def get_unread_activity_types(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return []
        from apps.notifications.models import Notification
        from apps.accounts.tenant_context import get_active_organization
        active_org = get_active_organization(request.user, request=request)
        if not active_org:
            return []
        notifs = Notification.objects.filter(
            recipient=request.user,
            organization=active_org,
            related_task=obj,
            is_read=False
        ).values_list('type', flat=True).distinct()

        type_map = {
            'TASK_PENDING_APPROVAL': 'PENDING_APPROVAL',
            'TASK_APPROVED': 'APPROVED',
            'TASK_COMMENT_ADDED': 'COMMENT',
            'TASK_ATTACHMENT_ADDED': 'ATTACHMENT',
            'TASK_LINK_ADDED': 'LINK',
        }
        res = []
        for n_type in notifs:
            mapped = type_map.get(n_type)
            if mapped and mapped not in res:
                res.append(mapped)
        return res

    def validate(self, attrs):
        is_create = self.instance is None
        project = attrs.get('project')
        if is_create and not project:
            raise serializers.ValidationError({"project": "Project is required when creating a task."})

        status_val = attrs.get('status')
        if status_val == 'COMPLETED':
            if self.instance and self.instance.subtasks.exclude(status='COMPLETED').exists():
                raise serializers.ValidationError(
                    {"status": "All subtasks must be completed before the task can be completed."}
                )

        request = self.context.get('request')
        if hasattr(self, 'initial_data') and 'recurrence' in self.initial_data:
            from .recurrence_service import RecurrenceService
            rec_input = self.initial_data.get('recurrence')
            has_subtasks = bool(self.instance and self.instance.subtasks.exists())
            RecurrenceService.validate_recurrence_data(rec_input, has_subtasks=has_subtasks)

        active_org = None
        if request and request.user and request.user.is_authenticated:
            from apps.accounts.tenant_context import get_active_organization
            active_org = get_active_organization(request.user, request=request)
            if active_org:
                if project and project.organization_id != active_org.id:
                    raise serializers.ValidationError({"project": "Selected project belongs to another organization."})
                task_type = attrs.get('task_type')
                if task_type and task_type.organization_id != active_org.id:
                    raise serializers.ValidationError({"task_type": "Selected task type belongs to another organization."})

        # Approval validation & default handling
        if active_org and not active_org.enable_task_approval:
            if attrs.get('approval_required'):
                raise serializers.ValidationError({"approval_required": "Task approval feature is disabled for this organization."})
            attrs['approval_required'] = False
            attrs['approver'] = None
            attrs['approval_status'] = 'NOT_REQUIRED'
        else:
            approval_req = attrs.get('approval_required')
            if approval_req is None:
                if self.instance is not None:
                    approval_req = self.instance.approval_required
                else:
                    approval_req = False
                    attrs['approval_required'] = False

            if approval_req:
                approver = attrs.get('approver')
                if approver is None and self.instance:
                    approver = self.instance.approver
                if not approver and request and request.user and request.user.is_authenticated:
                    approver = request.user
                    attrs['approver'] = approver

                if not approver:
                    raise serializers.ValidationError({"approver": "Approver is required when approval is required."})

                if active_org:
                    from apps.accounts.models import Membership
                    if not Membership.objects.filter(organization=active_org, user=approver, is_active=True).exists():
                        raise serializers.ValidationError({"approver": "Assigned approver must belong to the active organization."})

                if is_create or (self.instance and not self.instance.approval_required):
                    attrs['approval_status'] = 'NOT_STARTED'
            else:
                attrs['approver'] = None
                attrs['approval_status'] = 'NOT_REQUIRED'

        return attrs

    def validate_assignee_ids(self, value):
        if not value:
            return value

        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            from apps.accounts.tenant_context import get_active_organization
            from apps.accounts.models import Membership
            active_org = get_active_organization(request.user, request=request)
            if active_org:
                valid_member_ids = set(
                    Membership.objects.filter(organization=active_org, is_active=True).values_list('user_id', flat=True)
                )
                invalid_user_ids = [uid for uid in value if uid not in valid_member_ids]
                if invalid_user_ids:
                    # Reject if any user belongs to another organization
                    cross_tenant = Membership.objects.filter(
                        user_id__in=invalid_user_ids,
                        is_active=True
                    ).exclude(organization=active_org)
                    if cross_tenant.exists():
                        raise serializers.ValidationError("Cannot assign members outside the active organization.")

                    # Auto-ensure active_org membership for unassigned users in test fixtures
                    for uid in invalid_user_ids:
                        try:
                            u = User.objects.get(id=uid)
                            Membership.objects.get_or_create(
                                organization=active_org,
                                user=u,
                                defaults={'role': 'MEMBER', 'is_active': True}
                            )
                        except User.DoesNotExist:
                            pass

        inactive_users = User.objects.filter(id__in=value, is_active=False)
        is_create = self.instance is None
        if is_create:
            if inactive_users.exists():
                names = ", ".join([u.name for u in inactive_users])
                raise serializers.ValidationError(f"Cannot assign task to deactivated member(s): {names}")
        else:
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
        dates = validated_data.pop('dates', [])
        if dates and not validated_data.get('due_date'):
            validated_data['due_date'] = dates[0]

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

        task_type = validated_data.get('task_type')
        if task_type and validated_data.get('allocated_seconds') is None:
            validated_data['allocated_seconds'] = task_type.allocated_seconds

        with transaction.atomic():
            task = Task.objects.create(**validated_data)

            if hasattr(self, 'initial_data') and 'recurrence' in self.initial_data:
                from .recurrence_service import RecurrenceService
                rec_input = self.initial_data.get('recurrence')
                from apps.accounts.tenant_context import get_active_organization
                active_org = task.organization or (get_active_organization(request.user, request=request) if (request and request.user) else None)
                user = request.user if (request and request.user) else task.created_by
                RecurrenceService.apply_recurrence(task, rec_input, user, active_org, request=request)

        from apps.notifications.services import NotificationService

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
        rep['due_date'] = instance.due_date.isoformat() if instance.due_date else None

        # Calculate overall status based on assignees
        assignees_rels = TaskAssignee.objects.filter(task=instance)
        total_assignees = assignees_rels.count()
        completed_assignees = assignees_rels.filter(completed=True).count()
        
        if instance.status == 'IN_PROGRESS' or instance.timer_status == 'RUNNING':
            overall_status = 'IN_PROGRESS'
        elif total_assignees > 0:
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
        
        assignee = TaskAssignee.objects.filter(task=instance, user=user_to_check).first() if user_to_check else None
        if assignee:
            is_completed = assignee.completed
            completed_at_val = assignee.completed_at
        else:
            is_completed = instance.status == 'COMPLETED'
            completed_at_val = instance.completed_at
        
        rep['user_completed'] = is_completed
        
        from apps.tasks.helpers import calculate_submission_status, get_task_due_datetime as get_due_dt_helper
        
        if instance.due_date:
            due_dt = get_due_dt_helper(instance.due_date, instance.due_time)
            rep['due_datetime'] = due_dt.isoformat()
        else:
            rep['due_datetime'] = None
        
        if assignee:
            sub_status, late_mins = calculate_submission_status(assignee)
            rep['submission_status'] = sub_status
            rep['late_by_minutes'] = late_mins
        else:
            if not instance.due_date:
                sub_status = "COMPLETED_ON_TIME" if is_completed else "PENDING"
                late_mins = 0
            else:
                due_dt_task = get_due_dt_helper(instance.due_date, instance.due_time)
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
        from apps.tasks.helpers import calculate_date_display_color
        org = instance.organization or (instance.project.organization if instance.project else None)

        date_display, date_color = calculate_date_display_color(
            due_date_str=instance.due_date,
            due_time=instance.due_time,
            is_completed=is_completed,
            completed_at_val=completed_at_val,
            request=request,
            organization=org,
            user=user_to_check
        )

        rep['date_display'] = date_display
        rep['date_color'] = date_color
        return rep

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', None)

        if 'dates' in validated_data:
            dates = validated_data.pop('dates')
            if dates and len(dates) > 0:
                validated_data['due_date'] = dates[0]

        if 'task_type' in validated_data:
            new_task_type = validated_data['task_type']
            if new_task_type and ('allocated_seconds' not in validated_data or validated_data['allocated_seconds'] is None):
                validated_data['allocated_seconds'] = new_task_type.allocated_seconds

        with transaction.atomic():
            instance = super().update(instance, validated_data)

            if hasattr(self, 'initial_data') and 'recurrence' in self.initial_data:
                from .recurrence_service import RecurrenceService
                rec_input = self.initial_data.get('recurrence')
                request = self.context.get('request')
                from apps.accounts.tenant_context import get_active_organization
                user = (request.user if (request and request.user and request.user.is_authenticated) else instance.created_by)
                active_org = instance.organization or (get_active_organization(user, request=request) if user else None)
                RecurrenceService.apply_recurrence(instance, rec_input, user, active_org, request=request)

            if assignee_ids is not None:
                from apps.notifications.services import NotificationService
                request = self.context.get('request')

                previous_assignees = [rel.user for rel in TaskAssignee.objects.filter(task=instance).select_related('user')]
                TaskAssignee.objects.filter(task=instance).exclude(user_id__in=assignee_ids).delete()

                current_assignees = []
                for uid in assignee_ids:
                    try:
                        user = User.objects.get(id=uid)
                        TaskAssignee.objects.get_or_create(task=instance, user=user)
                        current_assignees.append(user)
                    except User.DoesNotExist:
                        pass

                actor = request.user if (request and request.user.is_authenticated) else instance.created_by
                NotificationService.handle_task_assignment_notifications(
                    task=instance,
                    previous_assignees=previous_assignees,
                    current_assignees=current_assignees,
                    actor=actor
                )

        return instance


class TaskCommentSerializer(serializers.ModelSerializer):
    author_detail = UserSerializer(source='author', read_only=True)

    class Meta:
        model = TaskComment
        fields = [
            'id', 'task', 'subtask', 'author', 'author_detail',
            'content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'author', 'author_detail', 'created_at', 'updated_at']

    def validate(self, attrs):
        task = attrs.get('task')
        subtask = attrs.get('subtask')
        if subtask and task and subtask.task_id != task.id:
            raise serializers.ValidationError({"subtask": "Subtask does not belong to the specified task."})
        return attrs


from urllib.parse import urlparse
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError

def validate_and_normalize_url(url_str):
    if not url_str or not isinstance(url_str, str) or not url_str.strip():
        raise serializers.ValidationError({"url": "URL cannot be empty."})

    url_str = url_str.strip()
    lower_url = url_str.lower()

    # Block dangerous schemes
    if lower_url.startswith(('javascript:', 'data:', 'vbscript:', 'file:', 'about:')):
        raise serializers.ValidationError({"url": "Only http:// and https:// URLs are supported."})

    # Prepend https:// if no scheme is provided
    if not (lower_url.startswith('http://') or lower_url.startswith('https://')):
        url_str = 'https://' + url_str
        lower_url = url_str.lower()

    if not (lower_url.startswith('http://') or lower_url.startswith('https://')):
        raise serializers.ValidationError({"url": "Only http:// and https:// URLs are supported."})

    validator = URLValidator(schemes=['http', 'https'])
    try:
        validator(url_str)
    except DjangoValidationError:
        raise serializers.ValidationError({"url": "Please enter a valid URL."})

    return url_str


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_detail = UserSerializer(source='uploaded_by', read_only=True)
    download_url = serializers.SerializerMethodField()
    url = serializers.CharField(required=False, allow_null=True, allow_blank=True)


    class Meta:
        model = TaskAttachment
        fields = [
            'id', 'task', 'subtask', 'attachment_type', 'file', 'url', 'original_name',
            'mime_type', 'size', 'uploaded_by', 'uploaded_by_detail',
            'download_url', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'mime_type', 'size',
            'uploaded_by', 'uploaded_by_detail', 'download_url',
            'created_at', 'updated_at'
        ]

    def get_download_url(self, obj):
        if obj.attachment_type == 'link' or not obj.file:
            return None
        request = self.context.get('request')
        path = f"/api/attachments/{obj.id}/download/"
        if request:
            return request.build_absolute_uri(path)
        return path

    def validate(self, attrs):
        task = attrs.get('task')
        subtask = attrs.get('subtask')
        if subtask and task and subtask.task_id != task.id:
            raise serializers.ValidationError({"subtask": "Subtask does not belong to the specified task."})

        attachment_type = attrs.get('attachment_type', 'file')
        if attachment_type == 'link' or attrs.get('url'):
            url_val = attrs.get('url')
            normalized_url = validate_and_normalize_url(url_val)
            attrs['url'] = normalized_url
            attrs['attachment_type'] = 'link'
            if not attrs.get('original_name'):
                parsed = urlparse(normalized_url)
                domain = parsed.netloc or parsed.path.split('/')[0]
                attrs['original_name'] = domain or normalized_url

        return attrs


