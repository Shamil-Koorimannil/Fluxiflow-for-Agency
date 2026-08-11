from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import OTPVerification

class Command(BaseCommand):
    help = 'Cleans up expired or verified OTP records older than 24 hours'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=24)
        
        # Expired OTPs older than 24 hours
        deleted_expired, _ = OTPVerification.objects.filter(
            expires_at__lt=cutoff
        ).delete()
        
        # Verified OTPs older than 24 hours
        deleted_verified, _ = OTPVerification.objects.filter(
            verified_at__lt=cutoff
        ).delete()
        
        total_deleted = deleted_expired + deleted_verified
        self.stdout.write(self.style.SUCCESS(
            f"Successfully cleaned up {total_deleted} old OTP verification records."
        ))
