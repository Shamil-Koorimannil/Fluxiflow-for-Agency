from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, SubProjectViewSet

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')
router.register('subprojects', SubProjectViewSet, basename='subproject')

urlpatterns = [
    path('', include(router.urls)),
]
