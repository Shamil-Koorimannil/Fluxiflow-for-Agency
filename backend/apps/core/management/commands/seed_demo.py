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
    help = 'Seeds local database with realistic Fluxiflow for Agency demo data including Organizations and Memberships'

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

        self.stdout.write('Seeding users...')
        password = 'password123'
        
        admin = User.objects.create_superuser(
            email='muhammedshamil251@gmail.com',
            name='Muhammed Shamil',
            password=password,
            status='ACTIVE'
        )
        Profile.objects.get_or_create(user=admin)
        Membership.objects.create(organization=org, user=admin)

        member = User.objects.create_user(
            email='member@demo.com',
            name='Demo Member',
            password=password,
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.get_or_create(user=member)
        Membership.objects.create(organization=org, user=member)

        saleel = User.objects.create_user(
            email='saleel@demo.com',
            name='Saleel',
            password=password,
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.get_or_create(user=saleel)
        Membership.objects.create(organization=org, user=saleel)

        fidha = User.objects.create_user(
            email='fidha@demo.com',
            name='Fidha',
            password=password,
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.get_or_create(user=fidha)
        Membership.objects.create(organization=org, user=fidha)

        shamil = User.objects.create_user(
            email='shamil@demo.com',
            name='Shamil',
            password=password,
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.get_or_create(user=shamil)
        Membership.objects.create(organization=org, user=shamil)

        # Seed one invited user to demonstrate invited state in table
        invited_user = User.objects.create_user(
            email='invited@demo.com',
            name='Sarah Thomas',
            password=password,
            role='MEMBER',
            status='INVITED'
        )
        Profile.objects.get_or_create(user=invited_user)
        Membership.objects.create(organization=org, user=invited_user)
        Invitation.objects.create(
            organization=org,
            email='invited@demo.com',
            name='Sarah Thomas',
            role='MEMBER',
            status='PENDING',
            invited_by=admin,
            expires_at=timezone.now() + datetime.timedelta(days=7)
        )

        self.stdout.write('Seeding projects...')
        p1 = Project.objects.create(
            name='Website Development',
            description='Corporate website redesign and redevelopment.',
            organization=org,
            created_by=admin
        )
        p2 = Project.objects.create(
            name='Marketing Campaign',
            description='Q3 social media and advertising campaign.',
            organization=org,
            created_by=admin
        )

        p3 = Project.objects.create(
            name='E-Commerce Project',
            description='Online Shopify store launch with stripe integrations.',
            organization=org,
            created_by=admin
        )

        self.stdout.write('Seeding tasks...')
        today = timezone.now().date()
        time_10am = datetime.time(10, 0)
        time_2pm = datetime.time(14, 0)
        
        t_today1 = Task.objects.create(
            project=p1,
            organization=org,
            name='Review website wireframes',
            description='Confirm the header layout, client logos row, and testimonials grid with the design team.',
            due_date=today,
            due_time=time_10am,
            priority='HIGH',
            status='PENDING',
            created_by=admin
        )
        TaskAssignee.objects.create(task=t_today1, user=member)
        TaskAssignee.objects.create(task=t_today1, user=saleel)

        SubTask.objects.create(task=t_today1, name='Verify desktop grid spacing', status='PENDING')
        SubTask.objects.create(task=t_today1, name='Approve mobile navbar style', status='COMPLETED', completed_by=member, completed_at=timezone.now())

        t_today2 = Task.objects.create(
            project=p2,
            organization=org,
            name='Draft Instagram posts copy',
            description='Write captions and select hashtags for the upcoming launch campaign.',
            due_date=today,
            due_time=time_2pm,
            priority='MEDIUM',
            status='PENDING',
            created_by=admin
        )
        TaskAssignee.objects.create(task=t_today2, user=saleel)

        t_overdue = Task.objects.create(
            project=p1,
            organization=org,
            name='Design hero section banner',
            description='Hero banner must follow the minimalist SaaS guidelines.',
            due_date=today - datetime.timedelta(days=2),
            due_time=time_10am,
            priority='HIGH',
            status='PENDING',
            created_by=admin
        )
        TaskAssignee.objects.create(task=t_overdue, user=fidha)

        t_upcoming1 = Task.objects.create(
            project=p1,
            organization=org,
            name='Setup React Router & Tailwind',
            description='Set up Vite project and structure folders.',
            due_date=today + datetime.timedelta(days=3),
            due_time=time_10am,
            priority='MEDIUM',
            status='PENDING',
            created_by=admin
        )
        TaskAssignee.objects.create(task=t_upcoming1, user=shamil)

        t_upcoming2 = Task.objects.create(
            project=p2,
            organization=org,
            name='Q3 Content Strategy Alignment',
            description='Sync call to align Q3 editorial calendar.',
            due_date=today + datetime.timedelta(days=5),
            due_time=time_2pm,
            priority='LOW',
            status='PENDING',
            created_by=admin
        )
        TaskAssignee.objects.create(task=t_upcoming2, user=member)
        TaskAssignee.objects.create(task=t_upcoming2, user=admin)

        t_completed1 = Task.objects.create(
            project=p1,
            organization=org,
            name='Create style guide and colors',
            description='Select monochrome layout rules, Roboto font sizes, and button border-radii.',
            due_date=today - datetime.timedelta(days=4),
            due_time=time_10am,
            priority='MEDIUM',
            status='COMPLETED',
            created_by=admin,
            completed_by=fidha,
            completed_at=timezone.now() - datetime.timedelta(days=3)
        )
        TaskAssignee.objects.create(task=t_completed1, user=fidha, completed=True, completed_at=timezone.now() - datetime.timedelta(days=3))
        TaskAssignee.objects.create(task=t_completed1, user=saleel, completed=True, completed_at=timezone.now() - datetime.timedelta(days=3))

        SubTask.objects.create(task=t_completed1, name='Approve typography styles', status='COMPLETED', completed_by=fidha, completed_at=timezone.now() - datetime.timedelta(days=3))
        SubTask.objects.create(task=t_completed1, name='Approve border-radius variables', status='COMPLETED', completed_by=fidha, completed_at=timezone.now() - datetime.timedelta(days=3))

        t_completed2 = Task.objects.create(
            project=p3,
            organization=org,
            name='Shopify API Credential Setup',
            description='Setup secret keys for dev sandbox.',
            due_date=today - datetime.timedelta(days=1),
            due_time=time_2pm,
            priority='HIGH',
            status='COMPLETED',
            created_by=admin,
            completed_by=admin,
            completed_at=timezone.now() - datetime.timedelta(hours=5)
        )
        TaskAssignee.objects.create(task=t_completed2, user=admin, completed=True, completed_at=timezone.now() - datetime.timedelta(hours=5))

        self.stdout.write('Seeding activity logs...')
        ActivityLog.objects.create(
            user=admin,
            action='PROJECT_CREATED',
            entity_type='Project',
            entity_id=p1.id,
            description="Demo Admin created project 'Website Development'.",
            created_at=timezone.now() - datetime.timedelta(days=10)
        )
        ActivityLog.objects.create(
            user=admin,
            action='TASK_CREATED',
            entity_type='Task',
            entity_id=t_completed1.id,
            description="Demo Admin created task 'Create style guide and colors'.",
            created_at=timezone.now() - datetime.timedelta(days=8)
        )
        ActivityLog.objects.create(
            user=admin,
            action='TASK_ASSIGNED',
            entity_type='Task',
            entity_id=t_completed1.id,
            description="Demo Admin assigned task 'Create style guide guide and colors' to Fidha and Saleel.",
            created_at=timezone.now() - datetime.timedelta(days=8)
        )
        ActivityLog.objects.create(
            user=fidha,
            action='TASK_COMPLETED',
            entity_type='Task',
            entity_id=t_completed1.id,
            description="Fidha completed task 'Create style guide and colors'.",
            created_at=timezone.now() - datetime.timedelta(days=3)
        )
        ActivityLog.objects.create(
            user=admin,
            action='TASK_CREATED',
            entity_type='Task',
            entity_id=t_today1.id,
            description="Demo Admin created task 'Review website wireframes'.",
            created_at=timezone.now() - datetime.timedelta(days=1)
        )
        ActivityLog.objects.create(
            user=admin,
            action='TASK_ASSIGNED',
            entity_type='Task',
            entity_id=t_today1.id,
            description="Demo Admin assigned task 'Review website wireframes' to Demo Member and Saleel.",
            created_at=timezone.now() - datetime.timedelta(days=1)
        )
        ActivityLog.objects.create(
            user=member,
            action='SUBTASK_COMPLETED',
            entity_type='SubTask',
            entity_id=t_today1.subtasks.first().id,
            description="Demo Member completed subtask 'Approve mobile navbar style'.",
            created_at=timezone.now() - datetime.timedelta(hours=2)
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded development database with V2 demo data!'))
