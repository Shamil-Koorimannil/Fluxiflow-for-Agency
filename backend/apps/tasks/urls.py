from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, SubTaskViewSet

router = DefaultRouter()
router.register('tasks', TaskViewSet, basename='task')
router.register('subtasks', SubTaskViewSet, basename='subtask')

urlpatterns = [
    path('', include(router.urls)),
]
