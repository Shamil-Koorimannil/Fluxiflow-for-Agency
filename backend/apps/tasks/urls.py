from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, SubTaskViewSet, TaskCommentViewSet, TaskAttachmentViewSet, TaskTypeViewSet, OrganizationSettingsView

router = DefaultRouter()
router.register('tasks', TaskViewSet, basename='task')
router.register('subtasks', SubTaskViewSet, basename='subtask')
router.register('comments', TaskCommentViewSet, basename='comment')
router.register('attachments', TaskAttachmentViewSet, basename='attachment')
router.register('task-types', TaskTypeViewSet, basename='task-type')
router.register('organization-settings', OrganizationSettingsView, basename='organization-settings')

urlpatterns = [
    path('', include(router.urls)),
]

