import random
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
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Profile, Organization, Membership, Invitation, OTPVerification, Session
from .serializers import UserSerializer, ProfileUpdateSerializer
from apps.activity.models import ActivityLog
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer
from apps.core.permissions import IsAdmin

User = get_user_model()

# --- OTP Authentication View Handlers ---

# --- Token-based Password Authentication Handlers ---

class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({"detail": "No active account found with the given credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.user
        if user.status == 'INACTIVE' or not user.is_active:
            return Response({"detail": "Your account has been deactivated. Please contact your administrator."}, status=status.HTTP_403_FORBIDDEN)

        # Update status from INVITED to ACTIVE if this is their first login
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

        refresh = serializer.validated_data['refresh']
        access = serializer.validated_data['access']

        # Store signature in Session database to maintain token revocation checks
        token_hash = hashlib.sha256(refresh.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']

        Session.objects.create(
            user=user,
            refresh_token_hash=token_hash,
            expires_at=expires_at
        )

        return Response({
            "access": access,
            "refresh": refresh,
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
        users = User.objects.all().order_by('name')
        data = []
        today = timezone.now().date()
        
        for user in users:
            pending_count = Task.objects.filter(
                assignee_relationships__user=user, 
                status='PENDING'
            ).distinct().count()
            
            today_count = Task.objects.filter(
                assignee_relationships__user=user, 
                status='PENDING', 
                due_date=today
            ).distinct().count()

            completed_count = Task.objects.filter(
                assignee_relationships__user=user, 
                status='COMPLETED'
            ).distinct().count()
            
            user_data = UserSerializer(user, context={'request': request}).data
            user_data['pending_tasks_count'] = pending_count
            user_data['today_tasks_count'] = today_count
            user_data['completed_tasks_count'] = completed_count
            data.append(user_data)
            
        return Response(data)

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        name = request.data.get('name', '').strip()
        role = request.data.get('role', 'MEMBER')
        password = request.data.get('password', '').strip()

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
            new_user = User.objects.create_user(
                email=email,
                name=name,
                role=role,
                status='INVITED',
                password=password if password else 'password123'
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

            # Send invitation email via SMTP
            try:
                send_mail(
                    subject="Invitation to join Fluxiflow for Agency",
                    message=f"Hello {name},\n\nYou have been invited to join Fluxiflow for Agency by {request.user.name}.\n\nYou can log in and access your workspace at:\nhttp://localhost:5173/login",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False
                )
            except Exception as e:
                print(f"Invitation email delivery error to {email}: {e}")

            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                action='USER_INVITED',
                entity_type='User',
                entity_id=new_user.id,
                description=f"{request.user.name} invited {name} ({email}) to the team."
            )

        return Response({"detail": "Invitation sent successfully."}, status=status.HTTP_201_CREATED)


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
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip().lower()
        role = request.data.get('role', None)
        password = request.data.get('password', '').strip()

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
            if password:
                user.set_password(password)
                # Revoke active sessions on password change
                Session.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
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
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({"detail": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user.status = 'INACTIVE'
            user.is_active = False
            user.save()

            # Revoke all active sessions immediately
            Session.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())

            # Log deactivation
            ActivityLog.objects.create(
                user=request.user,
                action='USER_DEACTIVATED',
                entity_type='User',
                entity_id=user.id,
                description=f"{request.user.name} deactivated account for {user.name}."
            )

        return Response({"detail": "Member deactivated successfully."}, status=status.HTTP_200_OK)


class TeamResendInvitationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
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

        # Mock Email delivery - output to console
        print(f"\n==================================================")
        print(f" RESENDING INVITATION TO: {user.email}")
        print(f" LINK: http://localhost:5173/login")
        print(f"==================================================\n")

        # Send resend invitation email via SMTP
        try:
            send_mail(
                subject="Reminder: Invitation to join Fluxiflow for Agency",
                message=f"Hello {user.name},\n\nThis is a reminder that you have been invited to join Fluxiflow for Agency by {request.user.name}.\n\nYou can log in and access your workspace at:\nhttp://localhost:5173/login",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False
            )
        except Exception as e:
            print(f"Resend invitation email delivery error to {user.email}: {e}")

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
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)
        start_of_week = timezone.now() - timedelta(days=timezone.now().weekday())
        start_of_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_pending = Task.objects.filter(
            assignee_relationships__user=user, 
            status='PENDING'
        ).distinct().count()
        
        due_today = Task.objects.filter(
            assignee_relationships__user=user, 
            status='PENDING', 
            due_date=today
        ).distinct().count()
        
        completed_week = Task.objects.filter(
            assignee_relationships__user=user, 
            status='COMPLETED', 
            completed_at__gte=start_of_week
        ).distinct().count()
        
        completed_month = Task.objects.filter(
            assignee_relationships__user=user, 
            status='COMPLETED', 
            completed_at__gte=start_of_month
        ).distinct().count()

        user_tasks = Task.objects.filter(assignee_relationships__user=user).distinct().order_by('due_date', 'due_time')
        
        today_tasks = user_tasks.filter(due_date=today)
        tomorrow_tasks = user_tasks.filter(due_date=tomorrow)
        yesterday_tasks = user_tasks.filter(due_date=yesterday)
        
        upcoming_tasks = user_tasks.filter(due_date__gt=tomorrow, status='PENDING')
        completed_tasks = user_tasks.filter(status='COMPLETED').order_by('-completed_at')
        other_pending_tasks = user_tasks.filter(due_date__lt=today, status='PENDING')

        context = {'request': request}
        
        return Response({
            "summary": {
                "name": user.name,
                "role": user.role,
                "total_pending": total_pending,
                "due_today": due_today,
                "completed_this_week": completed_week,
                "completed_this_month": completed_month,
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
