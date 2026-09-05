from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from apps.accounts.models import Organization, Membership, Profile

User = get_user_model()

class Command(BaseCommand):
    help = 'Idempotently sets up initial ORG_ADMIN users for Zywo organization.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate setup without committing changes.'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no database modifications.'))

        required_admins = [
            {'email': 'zywo.in@gmail.com', 'name': 'Zywo Admin'},
            {'email': 'muhammedshamil251@gmail.com', 'name': 'Shamil Koorimannil'}
        ]

        with transaction.atomic():
            # 1. Resolve or create Zywo organization
            zywo_org = Organization.objects.filter(slug='zywo').first() or Organization.objects.filter(name='Zywo').first()
            if not zywo_org:
                if not dry_run:
                    zywo_org = Organization.objects.create(
                        name='Zywo',
                        slug='zywo',
                        enable_task_types=True,
                        weekly_capacity_hours=40
                    )
                else:
                    zywo_org = Organization(name='Zywo', slug='zywo')
                self.stdout.write(self.style.SUCCESS('Created Zywo organization.'))
            else:
                if zywo_org.name != 'Zywo' or zywo_org.slug != 'zywo':
                    zywo_org.name = 'Zywo'
                    zywo_org.slug = 'zywo'
                    if not dry_run:
                        zywo_org.save(update_fields=['name', 'slug'])

            # 2. Process required ORG_ADMIN users
            for admin_info in required_admins:
                email = admin_info['email'].strip().lower()
                name = admin_info['name']

                user = User.objects.filter(email=email).first()
                if not user:
                    if not dry_run:
                        user = User.objects.create_user(
                            email=email,
                            name=name,
                            role='MEMBER',
                            status='INVITED'
                        )
                        Profile.objects.get_or_create(user=user)
                    self.stdout.write(self.style.SUCCESS(f"Created CustomUser identity for {email} (status=INVITED)."))
                else:
                    self.stdout.write(f"Found existing CustomUser identity for {email}.")

                if not dry_run and user:
                    mem, created = Membership.objects.get_or_create(
                        organization=zywo_org,
                        user=user,
                        defaults={'role': 'ORG_ADMIN', 'is_active': True}
                    )
                    if not created and (mem.role != 'ORG_ADMIN' or not mem.is_active):
                        mem.role = 'ORG_ADMIN'
                        mem.is_active = True
                        mem.save(update_fields=['role', 'is_active'])
                        self.stdout.write(self.style.SUCCESS(f"Updated Zywo membership for {email} to ORG_ADMIN."))
                    else:
                        self.stdout.write(self.style.SUCCESS(f"Verified Zywo ORG_ADMIN membership for {email}."))

                    if not user.active_organization_id:
                        user.active_organization = zywo_org
                        user.save(update_fields=['active_organization'])

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING('DRY RUN complete.'))
                return

        self.stdout.write(self.style.SUCCESS('Successfully configured Zywo ORG_ADMIN users.'))
