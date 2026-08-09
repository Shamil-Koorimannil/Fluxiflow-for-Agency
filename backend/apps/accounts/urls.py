from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .serializers import CustomTokenRefreshSerializer
from .views import (
    CustomTokenObtainPairView, MeView, LogoutView, ProfileView,
    TeamListView, TeamDetailView, TeamWorkloadView,
    TeamDeactivateView, TeamResendInvitationView
)

urlpatterns = [
    # Traditional Auth routes
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(serializer_class=CustomTokenRefreshSerializer), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    
    # Profile route
    path('profile/', ProfileView.as_view(), name='profile_detail'),
    
    # Team workload and management routes
    path('team/', TeamListView.as_view(), name='team_list'),
    path('team/<uuid:pk>/', TeamDetailView.as_view(), name='team_detail'),
    path('team/<uuid:pk>/deactivate/', TeamDeactivateView.as_view(), name='team_deactivate'),
    path('team/<uuid:pk>/resend/', TeamResendInvitationView.as_view(), name='team_resend'),
    path('team/<uuid:pk>/workload/', TeamWorkloadView.as_view(), name='team_workload'),
]
