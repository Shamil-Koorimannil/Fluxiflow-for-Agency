from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .serializers import CustomTokenRefreshSerializer
from .views import (
    RequestOTPView, VerifyOTPView, MeView, LogoutView, ProfileView,
    TeamListView, TeamDetailView, TeamWorkloadView,
    TeamDeactivateView, TeamReactivateView, TeamResendInvitationView, TeamTasksView,
    RequestEmailChangeOTPView, VerifyEmailChangeView, PasswordLoginView, GoogleAuthView,
    RequestPasswordChangeOTPView, SetPasswordWithOTPView, OrganizationViewSet
)

router = DefaultRouter()
router.register('organizations', OrganizationViewSet, basename='organizations')

urlpatterns = [
    # Passwordless OTP Auth routes
    path('auth/request-otp/', RequestOTPView.as_view(), name='request_otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('auth/google/', GoogleAuthView.as_view(), name='google_auth'),
    path('auth/token/refresh/', TokenRefreshView.as_view(serializer_class=CustomTokenRefreshSerializer), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    
    # New Auth and Security routes
    path('auth/request-email-change-otp/', RequestEmailChangeOTPView.as_view(), name='request_email_change_otp'),
    path('auth/verify-email-change/', VerifyEmailChangeView.as_view(), name='verify_email_change'),
    path('auth/login-password/', PasswordLoginView.as_view(), name='login_password'),
    path('auth/request-password-change-otp/', RequestPasswordChangeOTPView.as_view(), name='request_password_change_otp'),
    path('auth/set-password-with-otp/', SetPasswordWithOTPView.as_view(), name='set_password_with_otp'),

    # Profile route
    path('profile/', ProfileView.as_view(), name='profile_detail'),
    
    # Team workload and management routes
    path('team/', TeamListView.as_view(), name='team_list'),
    path('team/<uuid:pk>/', TeamDetailView.as_view(), name='team_detail'),
    path('team/<uuid:pk>/deactivate/', TeamDeactivateView.as_view(), name='team_deactivate'),
    path('team/<uuid:pk>/reactivate/', TeamReactivateView.as_view(), name='team_reactivate'),
    path('team/<uuid:pk>/resend/', TeamResendInvitationView.as_view(), name='team_resend'),
    path('team/<uuid:pk>/workload/', TeamWorkloadView.as_view(), name='team_workload'),
    path('team/<uuid:pk>/tasks/', TeamTasksView.as_view(), name='team_tasks'),
    
    # Organization router endpoints
    path('', include(router.urls)),
]
