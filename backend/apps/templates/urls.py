from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IndustryViewSet, ProjectTemplateViewSet

router = DefaultRouter()
router.register(r'industries', IndustryViewSet, basename='industry')
router.register(r'', ProjectTemplateViewSet, basename='project-template')

urlpatterns = [
    path('', include(router.urls)),
]
