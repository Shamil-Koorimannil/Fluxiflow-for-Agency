import json
import urllib.parse
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.accounts.models import CustomUser as User

@database_sync_to_async
def get_user_from_token(token):
    from rest_framework_simplejwt.tokens import AccessToken
    try:
        # Verify access token
        access_token = AccessToken(token)
        user_id = access_token.get('user_id')
        if not user_id:
            return None
        # Make sure the user is active and exists
        return User.objects.filter(id=user_id, status='ACTIVE', is_active=True).first()
    except Exception:
        return None

@database_sync_to_async
def get_user_organizations(user):
    from apps.accounts.models import Organization
    # Return list of organization UUIDs/IDs the user belongs to
    return [str(oid) for oid in Organization.objects.filter(memberships__user=user).values_list('id', flat=True)]

class TaskConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        query_params = urllib.parse.parse_qs(query_string)
        token = query_params.get("token", [None])[0]

        if not token:
            # Reject connection if token is missing
            await self.close(code=4001)
            return

        user = await get_user_from_token(token)
        if not user:
            # Reject connection if token is invalid or user is not active
            await self.close(code=4002)
            return

        self.user = user
        self.org_ids = await get_user_organizations(user)

        # Enforce tenant isolation: join organization-scoped groups
        for org_id in self.org_ids:
            group_name = f"organization_{org_id}"
            await self.channel_layer.group_add(group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        # Gracefully remove memberships from groups
        if hasattr(self, 'org_ids'):
            for org_id in self.org_ids:
                group_name = f"organization_{org_id}"
                await self.channel_layer.group_discard(group_name, self.channel_name)

    async def task_event(self, event):
        """
        Handler for task events sent via channel layer.
        Broadcasts minimal details to client to trigger query invalidation.
        """
        await self.send_json({
            "type": event.get("event_type"),
            "task_id": event.get("task_id"),
        })
