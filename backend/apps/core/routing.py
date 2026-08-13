from django.urls import path
from apps.core.consumers import TaskConsumer

websocket_urlpatterns = [
    path('ws/tasks/', TaskConsumer.as_asgi()),
]
