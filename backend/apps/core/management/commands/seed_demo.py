import datetime
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.accounts.models import Profile, Organization, Membership, Invitation, Session, OTPVerification
from apps.projects.models import Project
from apps.tasks.models import Task, TaskAssignee, SubTask
from apps.activity.models import ActivityLog

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds local database with only the primary Admin user and clears mock data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Bypass the confirmation prompt and force database clear/seed.',
        )

    def handle(self, *args, **options):
        if not options.get('no_input'):
            self.stdout.write(self.style.WARNING("WARNING: This script will delete ALL records in your database before seeding!"))
            confirm = input("Are you sure you want to proceed? (yes/no): ").strip().lower()
            if confirm not in ['yes', 'y']:
                self.stdout.write(self.style.ERROR("Seeding aborted."))
                return

        self.stdout.write('Clearing existing database records...')
        ActivityLog.objects.all().delete()
        SubTask.objects.all().delete()
        TaskAssignee.objects.all().delete()
        Task.objects.all().delete()
        Project.objects.all().delete()
        Profile.objects.all().delete()
        Session.objects.all().delete()
        OTPVerification.objects.all().delete()
        Invitation.objects.all().delete()
        Membership.objects.all().delete()
        User.objects.all().delete()
        Organization.objects.all().delete()

        self.stdout.write('Seeding organization...')
        org = Organization.objects.create(name='Fluxiflow Agency')

        self.stdout.write('Seeding admin user...')
        password = 'password123'
        
        admin = User.objects.create_superuser(
            email='muhammedshamil251@gmail.com',
            name='Muhammed Shamil',
            password=password,
            status='ACTIVE'
        )
        Profile.objects.get_or_create(user=admin)
        Membership.objects.create(organization=org, user=admin)

        self.stdout.write(self.style.SUCCESS('Successfully cleared all mock data and set up admin: muhammedshamil251@gmail.com!'))
