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

def calculate_user_health_metrics(user):
    now = timezone.now()
    start_date = now - timedelta(days=30)
    today_date = now.date()
    
    # Get all TaskAssignee records for this user
    assignments = TaskAssignee.objects.filter(user=user).select_related('task')
    
    # 1. Current Workload penalties (disjoint definitions)
    overdue_pending_tasks = 0
    today_pending_tasks = 0
    
    # We only count workload issues if the overall task is still PENDING
    pending_assignments = [a for a in assignments if not a.completed and a.task.status == 'PENDING']
    
    # pyrefly: ignore [missing-import]
    from apps.tasks.helpers import calculate_submission_status
    for a in pending_assignments:
        sub_status, _ = calculate_submission_status(a)
        if sub_status == "OVERDUE":
            overdue_pending_tasks += 1
        elif a.task.due_date == today_date:
            today_pending_tasks += 1

    # 2. Historical Performance: Completed tasks in the last 30 days
    completed_assignments_30 = [
        a for a in assignments 
        if a.completed and a.completed_at and a.completed_at >= start_date
    ]
    
    total_completed_tasks = len(completed_assignments_30)
    on_time_completed_tasks = 0
    late_completed_tasks_in_last_30_days = 0
    
    for a in completed_assignments_30:
        sub_status, _ = calculate_submission_status(a)
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
        
    # Additional week/month completion counts
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    completed_this_week = 0
    completed_this_month = 0
    
    for a in assignments:
        if a.completed and a.completed_at:
            if a.completed_at >= start_of_week:
                completed_this_week += 1
            if a.completed_at >= start_of_month:
                completed_this_month += 1
                
    return {
        "health_score": health_score,
        "health_status": health_status,
        "pending_tasks": len(pending_assignments),
        "today_tasks": TaskAssignee.objects.filter(
            user=user, 
            completed=False, 
            task__due_date=today_date,
            task__status='PENDING'
        ).count(),
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
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        user: CustomUser | None = User.objects.filter(email=email).first()  # type: ignore
        if not user:
            # Prevent email enumeration by returning a generic success message
            return Response({
                "message": "If this email is registered, a verification code has been sent."
            }, status=status.HTTP_200_OK)
            
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
        
        refresh_token_str = str(refresh)
        access_token_str = str(getattr(refresh, 'access_token'))
        
        # Store signature in Session database to maintain token revocation checks
        token_hash = hashlib.sha256(refresh_token_str.encode('utf-8')).hexdigest()
        simple_jwt_settings = getattr(settings, 'SIMPLE_JWT', {})
        refresh_lifetime = simple_jwt_settings.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7))
        expires_at = timezone.now() + refresh_lifetime

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
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)


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
        users = User.objects.all().order_by('name').prefetch_related('task_assignments__task')
        data = []
        
        for user in users:
            metrics = calculate_user_health_metrics(user)
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
            if User.objects.filter(email=email).exclude(id=user.id).exists():
                return Response({"detail": "A user with this email address already exists."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if name:
                user.name = name
            if email:
                user.email = email
                user.username = email
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

        metrics = calculate_user_health_metrics(user)
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)

        user_tasks = Task.objects.filter(assignee_relationships__user=user).distinct().order_by('due_date', 'due_time')
        
        # Segment tasks based on assignee completion status
        completed_tasks = user_tasks.filter(
            assignee_relationships__user=user, 
            assignee_relationships__completed=True
        ).order_by('-assignee_relationships__completed_at')
        
        incomplete_tasks = user_tasks.filter(
            assignee_relationships__user=user, 
            assignee_relationships__completed=False,
            status='PENDING'
        )

        today_tasks = incomplete_tasks.filter(due_date=today)
        tomorrow_tasks = incomplete_tasks.filter(due_date=tomorrow)
        yesterday_tasks = incomplete_tasks.filter(due_date=yesterday)
        
        upcoming_tasks = incomplete_tasks.filter(due_date__gt=tomorrow)
        other_pending_tasks = incomplete_tasks.filter(due_date__lt=yesterday)

        context = {'request': request, 'target_user': user}
        
        return Response({
            "summary": {
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
            "workload": {
                "today": TaskSerializer(today_tasks, many=True, context=context).data,
                "tomorrow": TaskSerializer(tomorrow_tasks, many=True, context=context).data,
                "yesterday": TaskSerializer(yesterday_tasks, many=True, context=context).data,
                "pending": TaskSerializer(other_pending_tasks, many=True, context=context).data,
                "upcoming": TaskSerializer(upcoming_tasks, many=True, context=context).data,
                "completed": TaskSerializer(completed_tasks, many=True, context=context).data,
            }
        })


class TeamTasksView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        today_date = now.date()
        
        queryset = Task.objects.filter(assignee_relationships__user=user).distinct().order_by('due_date', 'due_time')
        status_param = request.query_params.get('status')
        
        if status_param == 'today':
            queryset = queryset.filter(
                assignee_relationships__user=user,
                assignee_relationships__completed=False,
                status='PENDING',
                due_date=today_date
            )
        elif status_param == 'pending':
            queryset = queryset.filter(
                assignee_relationships__user=user,
                assignee_relationships__completed=False,
                status='PENDING'
            )
        elif status_param == 'upcoming':
            queryset = queryset.filter(
                assignee_relationships__user=user,
                assignee_relationships__completed=False,
                status='PENDING',
                due_date__gt=today_date
            )
        elif status_param == 'completed':
            queryset = queryset.filter(
                assignee_relationships__user=user,
                assignee_relationships__completed=True
            ).order_by('-assignee_relationships__completed_at')
        elif status_param == 'overdue':
            from django.db.models import Q
            queryset = queryset.filter(
                assignee_relationships__user=user,
                assignee_relationships__completed=False,
                status='PENDING'
            ).filter(
                Q(due_date__lt=today_date) | 
                Q(due_date=today_date, due_time__lt=now.time())
            )
            
        context = {'request': request, 'target_user': user}
        serializer = TaskSerializer(queryset, many=True, context=context)
        return Response(serializer.data)
