from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, SubTaskViewSet, TaskCommentViewSet, TaskAttachmentViewSet

router = DefaultRouter()
router.register('tasks', TaskViewSet, basename='task')
router.register('subtasks', SubTaskViewSet, basename='subtask')
router.register('comments', TaskCommentViewSet, basename='comment')
router.register('attachments', TaskAttachmentViewSet, basename='attachment')

urlpatterns = [
    path('', include(router.urls)),
]

