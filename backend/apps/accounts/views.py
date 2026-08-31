import hashlib
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from rest_framework import status, views, permissions
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from .models import CustomUser, Profile, Organization, Membership, Invitation, OTPVerification, Session
from .serializers import UserSerializer, ProfileUpdateSerializer
from .services import OTPService, InvitationEmailService
# pyrefly: ignore [missing-import]
from apps.activity.models import ActivityLog
# pyrefly: ignore [missing-import]
from apps.tasks.models import Task, TaskAssignee
# pyrefly: ignore [missing-import]
from apps.tasks.serializers import TaskSerializer
# pyrefly: ignore [missing-import]
from apps.core.permissions import IsAdmin
import datetime
from django.utils.timezone import make_aware

User: type[CustomUser] = get_user_model()  # type: ignore

def get_task_due_datetime(due_date, due_time):
    if due_time:
        due_dt = datetime.datetime.combine(due_date, due_time)
    else:
        due_dt = datetime.datetime.combine(due_date, datetime.time(23, 59, 59))
    if timezone.is_naive(due_dt):
        return make_aware(due_dt)
    return due_dt

def calculate_user_health_metrics(user, start_date=None, end_date=None):
    now = timezone.now()
    today_date = now.date()
    
    if start_date is None:
        start_date = now - timedelta(days=30)
    if end_date is None:
        end_date = now
        
    start_date_val = start_date
    end_date_val = end_date
    
    # pyrefly: ignore [missing-import]
    from apps.tasks.models import TaskAssignee, SubTaskAssignee
    
    # Get all TaskAssignee records for this user
    assignments = TaskAssignee.objects.filter(user=user).select_related('task')
    
    # Get all SubTaskAssignee records for this user
    subtask_assignments = SubTaskAssignee.objects.filter(user=user).select_related('subtask', 'subtask__task')
    
    # 1. Current Workload penalties (disjoint definitions)
    overdue_pending_tasks = 0
    today_pending_tasks = 0
    
    # Filter pending assignments to all currently active tasks
    pending_assignments = [
        a for a in assignments 
        if a.task.status != 'COMPLETED' and a.task.due_date
    ]
    pending_subtask_assignments = [
        sa for sa in subtask_assignments 
        if sa.subtask.status != 'COMPLETED' and sa.subtask.due_date
    ]
    
    from apps.tasks.helpers import calculate_submission_status, calculate_assignee_submission_status
    for a in pending_assignments:
        sub_status, _ = calculate_submission_status(a)
        if sub_status == "OVERDUE":
            overdue_pending_tasks += 1
        elif a.task.due_date == today_date:
            today_pending_tasks += 1
 
    for sa in pending_subtask_assignments:
        sub_status, _ = calculate_assignee_submission_status(sa, sa.subtask.due_date, sa.subtask.due_time)
        if sub_status == "OVERDUE":
            overdue_pending_tasks += 1
        elif sa.subtask.due_date == today_date:
            today_pending_tasks += 1
 
    # 2. Historical Performance: Completed tasks/subtasks in the date range
    completed_assignments_30 = [
        a for a in assignments 
        if a.task.status == 'COMPLETED' and a.task.completed_at and start_date_val <= a.task.completed_at <= end_date_val
    ]
    completed_subtask_assignments_30 = [
        sa for sa in subtask_assignments
        if sa.subtask.status == 'COMPLETED' and sa.subtask.completed_at and start_date_val <= sa.subtask.completed_at <= end_date_val
    ]
    
    total_completed_tasks = len(completed_assignments_30) + len(completed_subtask_assignments_30)
    on_time_completed_tasks = 0
    late_completed_tasks_in_last_30_days = 0
    
    for a in completed_assignments_30:
        sub_status, _ = calculate_submission_status(a)
        if sub_status == "LATE":
            late_completed_tasks_in_last_30_days += 1
        else:
            on_time_completed_tasks += 1
            
    for sa in completed_subtask_assignments_30:
        sub_status, _ = calculate_assignee_submission_status(sa, sa.subtask.due_date, sa.subtask.due_time)
        if sub_status == "LATE":
            late_completed_tasks_in_last_30_days += 1
        else:
            on_time_completed_tasks += 1
            
    if total_completed_tasks > 0:
        on_time_completion_rate = on_time_completed_tasks / total_completed_tasks
    else:
        # Default to 1.0 unless they have a critical number of overdue tasks (threshold of 7)
        if overdue_pending_tasks >= 7:
            on_time_completion_rate = 0.0
        else:
            on_time_completion_rate = 1.0
        
    historical_score = 70.0 * on_time_completion_rate
    
    overdue_pending_penalty = overdue_pending_tasks * 10
    today_pending_penalty = today_pending_tasks * 3
    late_completion_penalty = late_completed_tasks_in_last_30_days * 2
    
    current_workload_score = 100 - overdue_pending_penalty - today_pending_penalty - late_completion_penalty
    current_workload_score = max(0, current_workload_score)
    
    health_score = historical_score + (30.0 * (current_workload_score / 100.0))
    health_score = max(0, min(100, round(health_score)))
    
    # Health Status
    if health_score >= 90:
        health_status = 'excellent'
    elif health_score >= 80:
        health_status = 'healthy'
    elif health_score >= 60:
        health_status = 'needs_attention'
    elif health_score >= 40:
        health_status = 'at_risk'
    else:
        health_status = 'critical'
        
    # Recalculate completed_this_week & completed_this_month for the selected period
    start_of_week = end_date_val - timedelta(days=7)
    completed_this_week = 0
    completed_this_month = total_completed_tasks
    
    for a in completed_assignments_30:
        if a.completed_at and a.completed_at >= start_of_week:
            completed_this_week += 1
    for sa in completed_subtask_assignments_30:
        if sa.completed_at and sa.completed_at >= start_of_week:
            completed_this_week += 1
                
    return {
        "health_score": health_score,
        "health_status": health_status,
        "pending_tasks": len(pending_assignments) + len(pending_subtask_assignments),
        "today_tasks": today_pending_tasks,
        "overdue_tasks": overdue_pending_tasks,
        "completed_this_week": completed_this_week,
        "completed_this_month": completed_this_month,
        "on_time_completion_rate": round(on_time_completion_rate, 2),
        "late_completions": late_completed_tasks_in_last_30_days
    }


# --- OTP Authentication View Handlers ---

class RequestOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            validate_email(email)
        except ValidationError:
            return Response({"detail": "Invalid email address format."}, status=status.HTTP_400_BAD_REQUEST)

        user: CustomUser | None = User.objects.filter(email=email).first()  # type: ignore
        if not user:
            return Response({
                "detail": "This email is not registered or invited in the system. Please verify your spelling or contact your administrator."
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if user.status == 'INACTIVE' or not user.is_active:
            return Response({
                "detail": "Your account is currently deactivated. Please contact your administrator."
            }, status=status.HTTP_403_FORBIDDEN)
            
        # Check if an OTP was recently generated (within 60 seconds)
        last_otp = OTPVerification.objects.filter(
            email=user.email,
            purpose='LOGIN',
            verified_at__isnull=True,
            created_at__gt=timezone.now() - timedelta(seconds=60)
        ).exists()
        if last_otp:
            return Response({
                "detail": "Please wait 60 seconds before requesting another code."
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            
        try:
            otp_code = OTPService.generate_otp(user.email, purpose='LOGIN')
            OTPService.send_otp_email(user.name, user.email, otp_code)
        except Exception as e:
            return Response({"detail": f"Failed to send OTP code: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({
            "message": "If this email is registered, a verification code has been sent."
        }, status=status.HTTP_200_OK)


class VerifyOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        otp_code = request.data.get('otp', '').strip()
        
        if not email or not otp_code:
            return Response({"detail": "Email and verification code are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        user: CustomUser | None = User.objects.filter(email=email).first()  # type: ignore
        if not user:
            return Response({"detail": "No active account found with the given credentials."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user.status == 'INACTIVE' or not user.is_active:
            return Response({
                "detail": "Your account is currently deactivated. Please contact your administrator."
            }, status=status.HTTP_403_FORBIDDEN)
            
        success, message = OTPService.verify_otp(user.email, otp_code, purpose='LOGIN')
        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update user from INVITED to ACTIVE if this is their first login
        with transaction.atomic():
            if user.status == 'INVITED':
                user.status = 'ACTIVE'
                user.save()
                
                # Update any pending invitations
                Invitation.objects.filter(email=user.email, status='PENDING').update(
                    status='ACCEPTED',
                    accepted_at=timezone.now()
                )

                ActivityLog.objects.create(
                    user=user,
                    action='PROFILE_UPDATED',
                    entity_type='User',
                    entity_id=user.id,
                    description=f"{user.name} logged in for the first time and activated their account."
                )
                
        # Generate session tokens using RefreshToken
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        
        remember_me = request.data.get('remember_me', False)
        if remember_me:
            refresh.lifetime = timedelta(days=30)
            expires_at = timezone.now() + timedelta(days=30)
        else:
            refresh.lifetime = timedelta(days=1)
            expires_at = timezone.now() + timedelta(days=1)

        refresh_token_str = str(refresh)
        access_token_str = str(getattr(refresh, 'access_token'))
        
        # Store signature in Session database to maintain token revocation checks
        token_hash = hashlib.sha256(refresh_token_str.encode('utf-8')).hexdigest()

        Session.objects.create(
            user=user,
            refresh_token_hash=token_hash,
            expires_at=expires_at
        )

        return Response({
            "access": access_token_str,
            "refresh": refresh_token_str,
            "user": UserSerializer(user, context={'request': request}).data
        }, status=status.HTTP_200_OK)



class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        active_mem = get_active_membership(request.user)
        user_data = UserSerializer(request.user, context={'request': request}).data
        
        # Override role with membership role if present
        if active_mem:
            user_data['role'] = active_mem.role

        org_memberships = Membership.objects.filter(
            user=request.user,
            is_active=True,
            organization__is_active=True
        ).select_related('organization')

        orgs_list = []
        for m in org_memberships:
            orgs_list.append({
                "id": str(m.organization.id),
                "name": m.organization.name,
                "slug": m.organization.slug,
                "role": m.role,
                "logo_url": request.build_absolute_uri(m.organization.logo.url) if m.organization.logo else None
            })

        active_org_data = None
        if active_mem:
            active_org_data = {
                "id": str(active_mem.organization.id),
                "name": active_mem.organization.name,
                "slug": active_mem.organization.slug,
                "role": active_mem.role,
                "logo_url": request.build_absolute_uri(active_mem.organization.logo.url) if active_mem.organization.logo else None
            }

        return Response({
            **user_data,
            "active_organization": active_org_data,
            "organizations": orgs_list
        })


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token_hash = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()
            Session.objects.filter(refresh_token_hash=token_hash).update(revoked_at=timezone.now())

        # Invalidate all active sessions for this user on manual logout
        Session.objects.filter(user=request.user, revoked_at__isnull=True).update(revoked_at=timezone.now())

        # Log logout
        ActivityLog.objects.create(
            user=request.user,
            action='LOGOUT',
            entity_type='User',
            entity_id=request.user.id,
            description=f"{request.user.name} logged out."
        )

        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


class ProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, created = Profile.objects.get_or_create(user=request.user)
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        profile, created = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileUpdateSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                action='PROFILE_UPDATED',
                entity_type='Profile',
                entity_id=profile.id,
                description=f"{request.user.name} updated their profile details."
            )
            
            user_serializer = UserSerializer(request.user, context={'request': request})
            return Response(user_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- Admin-only Team Workload and CRUD endpoints ---

class TeamListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        import django.utils.dateparse
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = django.utils.dateparse.parse_datetime(start_date_str)
                if start_date and timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except Exception:
                pass
        if end_date_str:
            try:
                end_date = django.utils.dateparse.parse_datetime(end_date_str)
                if end_date and timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except Exception:
                pass

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response([], status=status.HTTP_200_OK)

        member_ids = Membership.objects.filter(organization=active_org, is_active=True).values_list('user_id', flat=True)
        users = User.objects.filter(id__in=member_ids).order_by('name').prefetch_related('task_assignments__task')
        data = []
        
        for user in users:
            metrics = calculate_user_health_metrics(user, start_date=start_date, end_date=end_date)
            user_data = UserSerializer(user, context={'request': request}).data
            
            user_data['health_score'] = metrics['health_score']
            user_data['health_status'] = metrics['health_status']
            user_data['pending_tasks'] = metrics['pending_tasks']
            user_data['today_tasks'] = metrics['today_tasks']
            user_data['overdue_tasks'] = metrics['overdue_tasks']
            user_data['completed_this_week'] = metrics['completed_this_week']
            user_data['completed_this_month'] = metrics['completed_this_month']
            user_data['on_time_completion_rate'] = metrics['on_time_completion_rate']
            user_data['late_completions'] = metrics['late_completions']
            
            # Backwards compatibility fields
            user_data['pending_tasks_count'] = metrics['pending_tasks']
            user_data['today_tasks_count'] = metrics['today_tasks']
            user_data['completed_tasks_count'] = metrics['completed_this_month']
            
            data.append(user_data)
            
        return Response(data)

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        name = request.data.get('name', '').strip()
        role = request.data.get('role', 'MEMBER')

        if not email or not name:
            return Response({"detail": "Name and email are required fields."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce unique email
        if User.objects.filter(email=email).exists():
            return Response({"detail": "A user with this email address already exists."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Get default organization
            org = Organization.objects.first()
            if not org:
                org = Organization.objects.create(name="Fluxiflow Agency")

            # Create User in INVITED state
            new_user = User.objects.create_user(  # type: ignore
                email=email,
                name=name,
                role=role,
                status='INVITED'
            )
            Profile.objects.get_or_create(user=new_user)
            Membership.objects.create(organization=org, user=new_user)

            # Create invitation
            expires_at = timezone.now() + timedelta(days=7)
            Invitation.objects.create(
                organization=org,
                email=email,
                name=name,
                role=role,
                status='PENDING',
                invited_by=request.user,
                expires_at=expires_at
            )

            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                action='USER_INVITED',
                entity_type='User',
                entity_id=new_user.id,
                description=f"{request.user.name} invited {name} ({email}) to the team."
            )

        # Send invitation email AFTER transaction commit so a DB rollback
        # doesn't result in an email going out for a failed creation.
        frontend_url = str(getattr(settings, 'FRONTEND_URL', 'http://localhost:5173'))
        email_sent, email_error = InvitationEmailService.send_invitation_email(
            member_name=name,
            member_email=email,
            invited_by_name=request.user.name,
            frontend_url=frontend_url,
        )

        if email_sent:
            return Response(
                {"detail": "Member invited successfully.", "email_sent": True},
                status=status.HTTP_201_CREATED
            )
        else:
            return Response(
                {
                    "detail": "Member added, but the invitation email could not be sent. Use Resend Invitation to try again.",
                    "email_sent": False,
                    "member_email": email,
                },
                status=status.HTTP_201_CREATED
            )


class TeamDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk=None):
        try:
            user: CustomUser = User.objects.get(id=pk)  # type: ignore
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip().lower()
        role = request.data.get('role', None)

        if email and email != user.email:
            return Response({"detail": "Email changes require OTP verification. Direct changes are not allowed."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if name:
                user.name = name
            if role:
                user.role = role
            user.save()

            # Profile picture patch
            profile, created = Profile.objects.get_or_create(user=user)
            if 'avatar' in request.FILES:
                profile.avatar = request.FILES['avatar']
                profile.save()

            ActivityLog.objects.create(
                user=request.user,
                action='USER_UPDATED',
                entity_type='User',
                entity_id=user.id,
                description=f"{request.user.name} updated team member details for {user.name}."
            )

        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TeamDeactivateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk=None):
        try:
            user: CustomUser = User.objects.get(id=pk)  # type: ignore
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({"detail": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user.status = 'INACTIVE'
            user.is_active = False
            user.deactivated_at = timezone.now()
            user.save()

            # Revoke all active sessions immediately
            Session.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())

            # Log deactivation
            ActivityLog.objects.create(
                user=request.user,
                action='USER_DEACTIVATED',
                entity_type='User',
                entity_id=user.id,
                description=f"{request.user.name} deactivated {user.name}."
            )

            # pyrefly: ignore [missing-import]
            from apps.notifications.services import NotificationService
            NotificationService.notify_admins(
                notification_type='MEMBER_DEACTIVATED',
                title='Member Deactivated',
                message=f"{user.name} was deactivated.",
                related_user=user
            )

        return Response({"detail": "Member deactivated successfully."}, status=status.HTTP_200_OK)


class TeamReactivateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk=None):
        try:
            user: CustomUser = User.objects.get(id=pk)  # type: ignore
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            user.status = 'ACTIVE'
            user.is_active = True
            user.deactivated_at = None
            user.save()

            # Log reactivation
            ActivityLog.objects.create(
                user=request.user,
                action='USER_ACTIVATED',
                entity_type='User',
                entity_id=user.id,
                description=f"{request.user.name} reactivated {user.name}."
            )

            # pyrefly: ignore [missing-import]
            from apps.notifications.services import NotificationService
            NotificationService.notify_admins(
                notification_type='MEMBER_REACTIVATED',
                title='Member Reactivated',
                message=f"{user.name} was reactivated.",
                related_user=user
            )

        return Response({"detail": "Member reactivated successfully."}, status=status.HTTP_200_OK)


class TeamResendInvitationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk=None):
        try:
            user: CustomUser = User.objects.get(id=pk)  # type: ignore
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.status != 'INVITED':
            return Response({"detail": "Only invited members can have invitations resent."}, status=status.HTTP_400_BAD_REQUEST)

        # Update Invitation expiration
        try:
            invite = Invitation.objects.get(email=user.email, status='PENDING')
            invite.expires_at = timezone.now() + timedelta(days=7)
            invite.save()
        except Invitation.DoesNotExist:
            org = Organization.objects.first()
            invite = Invitation.objects.create(
                organization=org,
                email=user.email,
                name=user.name,
                role=user.role,
                status='PENDING',
                invited_by=request.user,
                expires_at=timezone.now() + timedelta(days=7)
            )

        # Send resend invitation email via service
        frontend_url = str(getattr(settings, 'FRONTEND_URL', 'http://localhost:5173'))
        email_sent, email_error = InvitationEmailService.send_resend_invitation_email(
            member_name=user.name,
            member_email=user.email,
            invited_by_name=request.user.name,
            frontend_url=frontend_url,
        )

        if not email_sent:
            return Response(
                {"detail": f"Resend failed: could not deliver invitation email. {email_error or ''}".strip()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        ActivityLog.objects.create(
            user=request.user,
            action='USER_INVITATION_RESENT',
            entity_type='User',
            entity_id=user.id,
            description=f"{request.user.name} resent the team invitation to {user.name} ({user.email})."
        )

        return Response({"detail": "Invitation resent successfully."}, status=status.HTTP_200_OK)



class TeamWorkloadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, pk=None):
        try:
            user: CustomUser = User.objects.get(id=pk)  # type: ignore
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        import django.utils.dateparse
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = django.utils.dateparse.parse_datetime(start_date_str)
                if start_date and timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except Exception:
                pass
        if end_date_str:
            try:
                end_date = django.utils.dateparse.parse_datetime(end_date_str)
                if end_date and timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except Exception:
                pass

        metrics = calculate_user_health_metrics(user, start_date=start_date, end_date=end_date)
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)

        # Query unique task IDs first to avoid duplicate results from joined tables
        task_ids = Task.objects.filter(assignee_relationships__user=user).values_list('id', flat=True).distinct()
        user_tasks = Task.objects.filter(id__in=task_ids).order_by('due_date', 'due_time')

        # Workload capacity calculations
        membership = user.memberships.first()
        org = membership.organization if membership else Organization.objects.first()
        capacity_hours = org.weekly_capacity_hours if org else 40
        capacity_seconds = capacity_hours * 3600

        total_tasks_count = user_tasks.count()
        completed_tasks_count = user_tasks.filter(status='COMPLETED').count()
        active_tasks_count = total_tasks_count - completed_tasks_count

        total_allocated_seconds = sum(t.allocated_seconds or 0 for t in user_tasks)
        completed_allocated_seconds = sum(t.allocated_seconds or 0 for t in user_tasks.filter(status='COMPLETED'))
        remaining_allocated_seconds = sum(t.allocated_seconds or 0 for t in user_tasks.filter(status='PENDING'))
        
        total_tracked_seconds = 0
        now_ts = timezone.now()
        for t in user_tasks:
            if t.status == 'COMPLETED' and t.actual_duration_seconds is not None:
                total_tracked_seconds += t.actual_duration_seconds
            else:
                secs = t.elapsed_seconds or 0
                if t.timer_status == 'RUNNING' and t.timer_started_at:
                    secs += max(0, int((now_ts - t.timer_started_at).total_seconds()))
                total_tracked_seconds += secs

        unestimated_task_count = user_tasks.filter(status='PENDING', allocated_seconds__isnull=True).count()

        workload_percentage = round((total_allocated_seconds / capacity_seconds) * 100, 1) if capacity_seconds > 0 else 0.0
        if workload_percentage < 70.0:
            workload_status = 'Underloaded'
        elif workload_percentage <= 100.0:
            workload_status = 'Balanced'
        elif workload_percentage <= 120.0:
            workload_status = 'High'
        else:
            workload_status = 'Overloaded'

        # Segment tasks based on canonical task status
        completed_tasks = user_tasks.filter(status='COMPLETED').order_by('-completed_at')
        incomplete_tasks = user_tasks.filter(status='PENDING')

        today_tasks = incomplete_tasks.filter(due_date=today)
        tomorrow_tasks = incomplete_tasks.filter(due_date=tomorrow)
        overdue_tasks = incomplete_tasks.filter(due_date__lt=today)
        upcoming_tasks = incomplete_tasks.filter(due_date__gt=tomorrow)
        no_due_date_tasks = incomplete_tasks.filter(due_date__isnull=True)

        context = {'request': request, 'target_user': user}
        user_serialized = UserSerializer(user, context=context).data

        workload_stats = {
            "member_id": str(user.id),
            "user": user_serialized,
            "total_tasks_count": total_tasks_count,
            "active_tasks_count": active_tasks_count,
            "completed_tasks_count": completed_tasks_count,
            "total_allocated_seconds": total_allocated_seconds,
            "completed_allocated_seconds": completed_allocated_seconds,
            "remaining_allocated_seconds": remaining_allocated_seconds,
            "total_tracked_seconds": total_tracked_seconds,
            "total_allocated_hours": round(total_allocated_seconds / 3600.0, 1),
            "completed_allocated_hours": round(completed_allocated_seconds / 3600.0, 1),
            "remaining_allocated_hours": round(remaining_allocated_seconds / 3600.0, 1),
            "total_tracked_hours": round(total_tracked_seconds / 3600.0, 1),
            "unestimated_task_count": unestimated_task_count,
            "capacity_hours": capacity_hours,
            "workload_percentage": workload_percentage,
            "workload_status": workload_status,
        }
        
        return Response({
            "summary": {
                "id": str(user.id),
                "name": user.name,
                "role": user.role,
                "email": user.email,
                "status": user.status,
                "is_active": user.is_active,
                "deactivated_at": user.deactivated_at.isoformat() if user.deactivated_at else None,  # type: ignore
                "avatar_url": request.build_absolute_uri(user.profile.avatar.url) if (getattr(user, 'profile', None) and user.profile.avatar) else None,
                "total_pending": metrics["pending_tasks"],
                "due_today": metrics["today_tasks"],
                "completed_this_week": metrics["completed_this_week"],
                "completed_this_month": metrics["completed_this_month"],
                "health_score": metrics["health_score"],
                "health_status": metrics["health_status"],
                "overdue_tasks": metrics["overdue_tasks"],
                "on_time_completion_rate": metrics["on_time_completion_rate"],
                "late_completions": metrics["late_completions"]
            },
            "workload_stats": workload_stats,
            "workload": {
                "today": TaskSerializer(today_tasks, many=True, context=context).data,
                "tomorrow": TaskSerializer(tomorrow_tasks, many=True, context=context).data,
                "overdue": TaskSerializer(overdue_tasks, many=True, context=context).data,
                "upcoming": TaskSerializer(upcoming_tasks, many=True, context=context).data,
                "no_due_date": TaskSerializer(no_due_date_tasks, many=True, context=context).data,
                "completed": TaskSerializer(completed_tasks, many=True, context=context).data,
            },
            "tasks": TaskSerializer(user_tasks, many=True, context=context).data
        })


class TeamTasksView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        import django.utils.dateparse
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = django.utils.dateparse.parse_datetime(start_date_str)
                if start_date and timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except Exception:
                pass
        if end_date_str:
            try:
                end_date = django.utils.dateparse.parse_datetime(end_date_str)
                if end_date and timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except Exception:
                pass

        now = timezone.now()
        today_date = now.date()

        # Query using the canonical assignment relationship
        queryset = Task.objects.filter(assignee_relationships__user=user).distinct()
        
        queryset = queryset.order_by('due_date', 'due_time', 'created_at')
            
        context = {'request': request, 'target_user': user}
        serializer = TaskSerializer(queryset, many=True, context=context)
        return Response(serializer.data)


class RequestEmailChangeOTPView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        user_id = request.data.get('user_id')
        new_email = request.data.get('new_email', '').strip().lower()

        if not user_id or not new_email:
            return Response({"detail": "User ID and new email are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Authorization: Ordinary members cannot change other users' email
        if request.user.role != 'ADMIN' and str(request.user.id) != str(user_id):
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            validate_email(new_email)
        except ValidationError:
            return Response({"detail": "Invalid email address format."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the email is already used by another account
        if User.objects.filter(email=new_email).exclude(id=user.id).exists():
            return Response({"detail": "A user with this email address already exists."}, status=status.HTTP_400_BAD_REQUEST)

        # Rate-limiting: Wait 60s
        last_otp = OTPVerification.objects.filter(
            email=new_email,
            purpose='EMAIL_CHANGE',
            verified_at__isnull=True,
            created_at__gt=timezone.now() - timedelta(seconds=60)
        ).exists()
        if last_otp:
            return Response({"detail": "Please wait 60 seconds before requesting another code."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        try:
            otp_code = OTPService.generate_otp(new_email, purpose='EMAIL_CHANGE')
            OTPService.send_email_change_otp_email(user.name, new_email, otp_code)
        except Exception as e:
            return Response({"detail": f"Failed to send verification code: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "Verification code has been sent to the new email address."}, status=status.HTTP_200_OK)


class VerifyEmailChangeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_id = request.data.get('user_id')
        new_email = request.data.get('new_email', '').strip().lower()
        otp_code = request.data.get('otp', '').strip()

        if not user_id or not new_email or not otp_code:
            return Response({"detail": "User ID, new email, and code are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Authorization: Ordinary members cannot change other users' email
        if request.user.role != 'ADMIN' and str(request.user.id) != str(user_id):
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if the email is already used by another account
        if User.objects.filter(email=new_email).exclude(id=user.id).exists():
            return Response({"detail": "A user with this email address already exists."}, status=status.HTTP_400_BAD_REQUEST)

        success, message = OTPService.verify_otp(new_email, otp_code, purpose='EMAIL_CHANGE')
        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        # Successful verification: Update user's email
        with transaction.atomic():
            old_email = user.email
            user.email = new_email
            user.username = new_email
            user.save()

            ActivityLog.objects.create(
                user=request.user,
                action='USER_UPDATED',
                entity_type='User',
                entity_id=user.id,
                description=f"{request.user.name} changed email of user {user.name} from {old_email} to {new_email}."
            )

        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class PasswordLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response({"detail": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"detail": "No active account found with the given credentials."}, status=status.HTTP_400_BAD_REQUEST)

        if user.status == 'INACTIVE' or not user.is_active:
            return Response({
                "detail": "Your account is currently deactivated. Please contact your administrator."
            }, status=status.HTTP_403_FORBIDDEN)

        if not user.has_usable_password():
            return Response({
                "detail": "No password has been set for this account. Please log in with OTP or create a password from your profile."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(password):
            return Response({"detail": "No active account found with the given credentials."}, status=status.HTTP_400_BAD_REQUEST)

        # Successful login: Update status if INVITED to ACTIVE
        with transaction.atomic():
            if user.status == 'INVITED':
                user.status = 'ACTIVE'
                user.save()
                
                Invitation.objects.filter(email=user.email, status='PENDING').update(
                    status='ACCEPTED',
                    accepted_at=timezone.now()
                )

                ActivityLog.objects.create(
                    user=user,
                    action='PROFILE_UPDATED',
                    entity_type='User',
                    entity_id=user.id,
                    description=f"{user.name} logged in for the first time and activated their account."
                )

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        
        remember_me = request.data.get('remember_me', False)
        if remember_me:
            refresh.lifetime = timedelta(days=30)
            expires_at = timezone.now() + timedelta(days=30)
        else:
            refresh.lifetime = timedelta(days=1)
            expires_at = timezone.now() + timedelta(days=1)

        refresh_token_str = str(refresh)
        access_token_str = str(getattr(refresh, 'access_token'))
        
        token_hash = hashlib.sha256(refresh_token_str.encode('utf-8')).hexdigest()

        Session.objects.create(
            user=user,
            refresh_token_hash=token_hash,
            expires_at=expires_at
        )

        return Response({
            "access": access_token_str,
            "refresh": refresh_token_str,
            "user": UserSerializer(user, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class RequestPasswordChangeOTPView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Rate-limiting: Wait 60s
        last_otp = OTPVerification.objects.filter(
            email=user.email,
            purpose='PASSWORD_CHANGE',
            verified_at__isnull=True,
            created_at__gt=timezone.now() - timedelta(seconds=60)
        ).exists()
        if last_otp:
            return Response({"detail": "Please wait 60 seconds before requesting another code."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        try:
            otp_code = OTPService.generate_otp(user.email, purpose='PASSWORD_CHANGE')
            OTPService.send_password_change_otp_email(user.name, user.email, otp_code)
        except Exception as e:
            return Response({"detail": f"Failed to send verification code: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "Verification code has been sent to your email address."}, status=status.HTTP_200_OK)


class SetPasswordWithOTPView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        otp_code = request.data.get('otp', '').strip()
        new_password = request.data.get('new_password', '')

        if not otp_code or not new_password:
            return Response({"detail": "Verification code and new password are required."}, status=status.HTTP_400_BAD_REQUEST)

        success, message = OTPService.verify_otp(user.email, otp_code, purpose='PASSWORD_CHANGE')
        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password using Django validators
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({"detail": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        # Set and hash password
        with transaction.atomic():
            user.set_password(new_password)
            user.save()

            ActivityLog.objects.create(
                user=user,
                action='PROFILE_UPDATED',
                entity_type='User',
                entity_id=user.id,
                description=f"{user.name} set/changed their password."
            )

        return Response({"message": "Password has been successfully updated."}, status=status.HTTP_200_OK)


from rest_framework import viewsets
from rest_framework.decorators import action
from apps.accounts.tenant_context import (
    get_active_membership,
    get_active_organization,
    is_org_admin,
    IsTenantMember,
    IsTenantOrgAdmin
)
from apps.accounts.serializers import OrganizationSerializer, MembershipSerializer

class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        memberships = Membership.objects.filter(
            user=self.request.user,
            is_active=True,
            organization__is_active=True
        ).values_list('organization_id', flat=True)
        return Organization.objects.filter(id__in=memberships).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        
        active_membership = get_active_membership(request.user)
        active_org_data = None
        if active_membership:
            active_org_data = OrganizationSerializer(active_membership.organization, context={'request': request}).data

        return Response({
            "organizations": serializer.data,
            "active_organization": active_org_data
        })

    def create(self, request, *args, **kwargs):
        name = request.data.get('name')
        if not name or not name.strip():
            return Response({"detail": "Organization name is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            org = Organization.objects.create(name=name.strip())
            membership = Membership.objects.create(
                organization=org,
                user=request.user,
                role='ORG_ADMIN',
                is_active=True
            )
            request.user.active_organization = org
            request.user.save(update_fields=['active_organization'])

        serializer = self.get_serializer(org, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='switch')
    def switch_organization(self, request):
        org_id = request.data.get('organization_id')
        if not org_id:
            return Response({"detail": "organization_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        membership = Membership.objects.filter(
            user=request.user,
            organization_id=org_id,
            is_active=True,
            organization__is_active=True
        ).select_related('organization').first()

        if not membership:
            return Response({"detail": "You do not have access to this organization."}, status=status.HTTP_403_FORBIDDEN)

        request.user.active_organization = membership.organization
        request.user.save(update_fields=['active_organization'])

        org_data = OrganizationSerializer(membership.organization, context={'request': request}).data
        return Response({
            "active_organization": org_data,
            "role": membership.role
        })

    @action(detail=False, methods=['patch', 'put'], url_path='profile')
    def update_organization_profile(self, request):
        if not is_org_admin(request.user):
            return Response({"detail": "Only Organization Admins can modify organization profile."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response({"detail": "No active organization found."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(active_org, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='members')
    def list_members(self, request):
        active_org = get_active_organization(request.user)
        if not active_org:
            return Response({"detail": "No active organization context found."}, status=status.HTTP_400_BAD_REQUEST)

        memberships = Membership.objects.filter(
            organization=active_org,
            is_active=True
        ).select_related('user', 'user__profile')
        serializer = MembershipSerializer(memberships, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='invite')
    def invite_member(self, request):
        if not is_org_admin(request.user):
            return Response({"detail": "Only Organization Admins can invite new members."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response({"detail": "No active organization found."}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email', '').strip().lower()
        role = request.data.get('role', 'MEMBER')
        name = request.data.get('name', '').strip() or email.split('@')[0]

        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if role not in ('ORG_ADMIN', 'ADMIN', 'MEMBER'):
            return Response({"detail": "Invalid role specified."}, status=status.HTTP_400_BAD_REQUEST)

        target_user = CustomUser.objects.filter(email=email).first()
        if target_user:
            existing_mem = Membership.objects.filter(organization=active_org, user=target_user).first()
            if existing_mem:
                if existing_mem.is_active:
                    return Response({"detail": "User is already an active member of this organization."}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    existing_mem.is_active = True
                    existing_mem.role = role
                    existing_mem.save()
                    return Response(MembershipSerializer(existing_mem, context={'request': request}).data)
            else:
                mem = Membership.objects.create(
                    organization=active_org,
                    user=target_user,
                    role=role,
                    is_active=True
                )
                return Response(MembershipSerializer(mem, context={'request': request}).data, status=status.HTTP_201_CREATED)
        else:
            target_user = CustomUser.objects.create_user(
                email=email,
                name=name,
                role='MEMBER',
                status='INVITED'
            )
            mem = Membership.objects.create(
                organization=active_org,
                user=target_user,
                role=role,
                is_active=True
            )
            return Response(MembershipSerializer(mem, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['patch'], url_path=r'members/(?P<user_id>[^/.]+)/role')
    def update_member_role(self, request, user_id=None):
        if not is_org_admin(request.user):
            return Response({"detail": "Only Organization Admins can modify member roles."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response({"detail": "No active organization found."}, status=status.HTTP_400_BAD_REQUEST)

        new_role = request.data.get('role')
        if new_role not in ('ORG_ADMIN', 'ADMIN', 'MEMBER'):
            return Response({"detail": "Invalid role specified."}, status=status.HTTP_400_BAD_REQUEST)

        target_membership = Membership.objects.filter(organization=active_org, user_id=user_id, is_active=True).first()
        if not target_membership:
            return Response({"detail": "Member not found in active organization."}, status=status.HTTP_404_NOT_FOUND)

        if target_membership.role == 'ORG_ADMIN' and new_role != 'ORG_ADMIN':
            admin_count = Membership.objects.filter(organization=active_org, role='ORG_ADMIN', is_active=True).count()
            if admin_count <= 1:
                return Response({"detail": "Cannot demote the last Organization Admin. Assign another Organization Admin first."}, status=status.HTTP_400_BAD_REQUEST)

        target_membership.role = new_role
        target_membership.save(update_fields=['role'])
        return Response(MembershipSerializer(target_membership, context={'request': request}).data)

    @action(detail=False, methods=['delete'], url_path=r'members/(?P<user_id>[^/.]+)')
    def remove_member(self, request, user_id=None):
        if not is_org_admin(request.user):
            return Response({"detail": "Only Organization Admins can remove members."}, status=status.HTTP_403_FORBIDDEN)

        active_org = get_active_organization(request.user)
        if not active_org:
            return Response({"detail": "No active organization found."}, status=status.HTTP_400_BAD_REQUEST)

        target_membership = Membership.objects.filter(organization=active_org, user_id=user_id, is_active=True).first()
        if not target_membership:
            return Response({"detail": "Member not found in active organization."}, status=status.HTTP_404_NOT_FOUND)

        if target_membership.role == 'ORG_ADMIN':
            admin_count = Membership.objects.filter(organization=active_org, role='ORG_ADMIN', is_active=True).count()
            if admin_count <= 1:
                return Response({"detail": "Cannot remove the last Organization Admin. Assign another Organization Admin first."}, status=status.HTTP_400_BAD_REQUEST)

        target_membership.is_active = False
        target_membership.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

