from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.notifications.models import Notification

class Command(BaseCommand):
    help = 'Prunes notifications older than 90 days'

    def handle(self, *args, **options):
        cutoff_date = timezone.now() - timedelta(days=90)
        old_notifications = Notification.objects.filter(created_at__lt=cutoff_date)
        count = old_notifications.count()
        old_notifications.delete()
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} notifications older than 90 days.'))
