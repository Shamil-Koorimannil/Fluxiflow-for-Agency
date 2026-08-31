from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from apps.accounts.models import Organization, Membership
from apps.projects.models import Project
from apps.tasks.models import Task, SubTask, TaskType
from apps.clients.models import Client
from apps.keep.models import KeepItem

User = get_user_model()

class Command(BaseCommand):
    help = 'Idempotently bootstraps default organization and backfills existing workspace records.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Calculate proposed changes without modifying the database.'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no data will be changed.'))

        with transaction.atomic():
            # 1. Determine or create bootstrap organization (Zywo)
            org = Organization.objects.filter(slug='zywo').first() or Organization.objects.first()
            created_org = False
            if not org:
                if not dry_run:
                    org = Organization.objects.create(
                        name='Zywo',
                        slug='zywo',
                        enable_task_types=True,
                        weekly_capacity_hours=40
                    )
                else:
                    org = Organization(name='Zywo', slug='zywo')
                created_org = True
            else:
                if org.name != 'Zywo' or org.slug != 'zywo':
                    org.name = 'Zywo'
                    org.slug = 'zywo'
                    if not dry_run:
                        org.save(update_fields=['name', 'slug'])

            org_name = 'Zywo'

            # 2. Process users & memberships
            all_users = User.objects.all()
            primary_admin = User.objects.filter(role='ADMIN').order_by('created_at').first() or User.objects.filter(is_superuser=True).first()

            memberships_to_create = []
            memberships_to_update = []
            users_to_update_active_org = []

            for u in all_users:
                target_role = 'ORG_ADMIN' if u == primary_admin else ('ADMIN' if u.role == 'ADMIN' else 'MEMBER')
                mem = Membership.objects.filter(user=u, organization=org).first() if org and getattr(org, 'id', None) else None
                
                if not mem:
                    memberships_to_create.append((u, target_role))
                else:
                    if u.role == 'ADMIN' and mem.role == 'MEMBER':
                        memberships_to_update.append((mem, target_role))

                if not u.active_organization_id:
                    users_to_update_active_org.append(u)

            # 3. Process existing unassigned models
            unassigned_projects = Project.objects.filter(organization__isnull=True)
            unassigned_tasks = Task.objects.filter(organization__isnull=True)
            unassigned_clients = Client.objects.filter(organization__isnull=True)
            unassigned_keep_items = KeepItem.objects.filter(organization__isnull=True)
            unassigned_task_types = TaskType.objects.filter(organization__isnull=True)

            if dry_run:
                self.stdout.write(self.style.SUCCESS('DRY RUN — Summary of proposed changes:'))
                self.stdout.write(f"Organization to create: {org_name if created_org else 'None (Already exists)'}")
                self.stdout.write(f"Users to process: {len(all_users)}")
                self.stdout.write(f"Memberships to create: {len(memberships_to_create)}")
                self.stdout.write(f"Memberships to repair: {len(memberships_to_update)}")
                self.stdout.write(f"Projects to assign: {unassigned_projects.count()}")
                self.stdout.write(f"Tasks to assign: {unassigned_tasks.count()}")
                self.stdout.write(f"Clients to assign: {unassigned_clients.count()}")
                self.stdout.write(f"Keep items to assign: {unassigned_keep_items.count()}")
                self.stdout.write(f"Task types to assign: {unassigned_task_types.count()}")
                transaction.set_rollback(True)
                return

            # Execute actual changes atomically
            created_memberships_count = 0
            for u, role in memberships_to_create:
                Membership.objects.get_or_create(
                    user=u,
                    organization=org,
                    defaults={'role': role, 'is_active': True}
                )
                created_memberships_count += 1

            for mem, role in memberships_to_update:
                mem.role = role
                mem.save(update_fields=['role'])

            updated_active_org_count = 0
            for u in users_to_update_active_org:
                u.active_organization = org
                u.save(update_fields=['active_organization'])
                updated_active_org_count += 1

            projects_count = unassigned_projects.update(organization=org)
            tasks_count = unassigned_tasks.update(organization=org)
            clients_count = unassigned_clients.update(organization=org)
            keep_count = unassigned_keep_items.update(organization=org)
            task_types_count = unassigned_task_types.update(organization=org)

            self.stdout.write(self.style.SUCCESS("Organization bootstrap complete."))
            self.stdout.write(f"Organization:\n    {org.name}")
            self.stdout.write(f"Users processed:\n    {len(all_users)}")
            self.stdout.write(f"Memberships created:\n    {created_memberships_count}")
            self.stdout.write(f"Projects assigned:\n    {projects_count}")
            self.stdout.write(f"Tasks assigned:\n    {tasks_count}")
            self.stdout.write(f"Clients assigned:\n    {clients_count}")
            self.stdout.write(f"Keep items assigned:\n    {keep_count}")
            self.stdout.write(f"Task types assigned:\n    {task_types_count}")
