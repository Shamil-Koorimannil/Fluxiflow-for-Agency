"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('fluxiflow-control/', admin.site.urls),
    
    # Keep API endpoints
    path('api/keep/', include('apps.keep.urls')),
    
    # API endpoints from local apps
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.projects.urls')),
    path('api/', include('apps.tasks.urls')),
    path('api/', include('apps.activity.urls')),
    path('api/', include('apps.core.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.reports.urls')),
    path('api/', include('apps.clients.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
