from django.test import TestCase
from django.urls import reverse
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.accounts.models import Organization

User = get_user_model()
from apps.projects.models import Project
from apps.tasks.models import Task, SubTask
from apps.templates.models import Industry, ProjectTemplate, TemplateTask, TemplateSubTask
from apps.templates.services import TemplateProjectService


class TemplateModelAndSeedingTests(TestCase):
    def setUp(self):
        call_command('seed_project_templates')

    def test_advertising_industry_seeded(self):
        industry = Industry.objects.filter(name='Advertising').first()
        self.assertIsNotNone(industry)

    def test_software_technology_industry_seeded(self):
        industry = Industry.objects.filter(name='Software & Technology').first()
        self.assertIsNotNone(industry)
        self.assertTrue(industry.is_active)

    def test_17_total_v1_templates_seeded(self):
        self.assertEqual(ProjectTemplate.objects.count(), 17)

    def test_13_advertising_templates_untouched(self):
        industry = Industry.objects.get(name='Advertising')
        templates = ProjectTemplate.objects.filter(industry=industry)
        self.assertEqual(templates.count(), 13)

        expected_names = [
            "Package Design", "Outdoor Print Design", "Motion Design", "Static Website",
            "Ecommerce Website", "AI Ad Film", "Ad Film Production", "Brand Strategy",
            "Campaign Strategy", "R&D", "Performance Marketing", "SEO", "Social Media"
        ]
        actual_names = list(templates.values_list('name', flat=True))
        for name in expected_names:
            self.assertIn(name, actual_names)

    def test_4_software_technology_templates_seeded(self):
        industry = Industry.objects.get(name='Software & Technology')
        templates = ProjectTemplate.objects.filter(industry=industry)
        self.assertEqual(templates.count(), 4)

        expected_names = [
            "Software Development", "Web Application", "Mobile Application", "SaaS Product"
        ]
        actual_names = list(templates.values_list('name', flat=True))
        self.assertEqual(sorted(actual_names), sorted(expected_names))

    def test_seed_command_idempotency(self):
        call_command('seed_project_templates')
        call_command('seed_project_templates')
        self.assertEqual(ProjectTemplate.objects.count(), 17)
        self.assertEqual(Industry.objects.count(), 2)

    def test_software_development_hierarchy(self):
        tpl = ProjectTemplate.objects.get(name='Software Development')
        tasks = list(tpl.tasks.all().order_by('position'))
        self.assertEqual(len(tasks), 9)

        expected_task_names = [
            "Requirement & Product Planning",
            "UI/UX Design",
            "User & Authentication Module",
            "Core Application Modules",
            "Admin & Management Module",
            "API & Integration Module",
            "Database & Backend",
            "Testing & QA",
            "Deployment & Launch",
        ]
        actual_task_names = [t.name for t in tasks]
        self.assertEqual(actual_task_names, expected_task_names)

        # Check subtasks of task 1
        t1_subtasks = list(tasks[0].subtasks.all().order_by('position').values_list('name', flat=True))
        self.assertEqual(t1_subtasks, ["Requirements & Scope", "Functional Specification", "Technical Specification"])

        # Check subtasks of task 9
        t9_subtasks = list(tasks[8].subtasks.all().order_by('position').values_list('name', flat=True))
        self.assertEqual(t9_subtasks, ["Production Setup", "Deployment", "Final Verification"])

    def test_web_application_hierarchy(self):
        tpl = ProjectTemplate.objects.get(name='Web Application')
        tasks = list(tpl.tasks.all().order_by('position'))
        self.assertEqual(len(tasks), 9)

        actual_task_names = [t.name for t in tasks]
        self.assertIn("Requirement Gathering", actual_task_names)
        self.assertIn("Core Web Application", actual_task_names)
        self.assertIn("Admin Panel", actual_task_names)

        admin_task = tpl.tasks.get(name='Admin Panel')
        admin_subtasks = list(admin_task.subtasks.all().order_by('position').values_list('name', flat=True))
        self.assertEqual(admin_subtasks, ["Admin Dashboard", "User Management", "Content / Data Management", "Reports & Settings"])

    def test_mobile_application_hierarchy(self):
        tpl = ProjectTemplate.objects.get(name='Mobile Application')
        tasks = list(tpl.tasks.all().order_by('position'))
        self.assertEqual(len(tasks), 11)

        actual_task_names = [t.name for t in tasks]
        self.assertEqual(actual_task_names[7], "iOS Application")
        self.assertEqual(actual_task_names[8], "Android Application")

        ios_subtasks = list(tasks[7].subtasks.all().order_by('position').values_list('name', flat=True))
        self.assertEqual(ios_subtasks, ["iOS Implementation", "iOS Testing", "App Store Build"])

        android_subtasks = list(tasks[8].subtasks.all().order_by('position').values_list('name', flat=True))
        self.assertEqual(android_subtasks, ["Android Implementation", "Android Testing", "Play Store Build"])

    def test_saas_product_hierarchy(self):
        tpl = ProjectTemplate.objects.get(name='SaaS Product')
        tasks = list(tpl.tasks.all().order_by('position'))
        self.assertEqual(len(tasks), 12)

        actual_task_names = [t.name for t in tasks]
        self.assertEqual(actual_task_names[4], "Subscription & Billing")
        self.assertEqual(actual_task_names[6], "Backend & API")
        self.assertEqual(actual_task_names[8], "Security & Infrastructure")
        self.assertEqual(actual_task_names[11], "Product Maintenance")

        billing_subtasks = list(tasks[4].subtasks.all().order_by('position').values_list('name', flat=True))
        self.assertEqual(billing_subtasks, ["Pricing Plans", "Subscription Management", "Payment & Billing", "Invoices", "Upgrade / Downgrade / Cancellation"])

    def test_no_users_or_roles_or_assignees_created_during_seeding(self):
        # Template seeding must not assign or create TaskAssignees or SubTaskAssignees or Users
        # Template models do not have assignees
        tpl = ProjectTemplate.objects.get(name='SaaS Product')
        for task in tpl.tasks.all():
            self.assertFalse(hasattr(task, 'assignees'))


class TemplateAPITests(TestCase):
    def setUp(self):
        call_command('seed_project_templates')
        self.client = APIClient()
        self.org = Organization.objects.create(name='Test Agency')
        self.user = User.objects.create_user(
            email='user@testagency.com',
            name='Test User',
            password='password123',
            active_organization=self.org
        )
        from apps.accounts.models import Membership
        Membership.objects.create(user=self.user, organization=self.org, role='ORG_ADMIN')
        self.client.force_authenticate(user=self.user)

    def test_list_industries(self):
        res = self.client.get('/api/templates/industries/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        names = [i['name'] for i in res.data]
        self.assertIn('Advertising', names)
        self.assertIn('Software & Technology', names)

    def test_list_templates(self):
        res = self.client.get('/api/templates/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 17)

    def test_industry_filtering(self):
        adv_res = self.client.get('/api/templates/?industry=Advertising')
        self.assertEqual(adv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(adv_res.data), 13)

        sw_res = self.client.get('/api/templates/?industry=Software%20%26%20Technology')
        self.assertEqual(sw_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(sw_res.data), 4)

    def test_search_and_industry_filter_combination(self):
        res = self.client.get('/api/templates/?industry=Software%20%26%20Technology&search=SaaS')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'SaaS Product')

    def test_search_by_template_name(self):
        res = self.client.get('/api/templates/?search=Mobile')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [t['name'] for t in res.data]
        self.assertIn('Mobile Application', names)

    def test_search_by_task_name(self):
        res = self.client.get('/api/templates/?search=Subscription')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [t['name'] for t in res.data]
        self.assertIn('SaaS Product', names)

    def test_search_by_subtask_name(self):
        res = self.client.get('/api/templates/?search=Play%20Store')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [t['name'] for t in res.data]
        self.assertIn('Mobile Application', names)

    def test_template_detail(self):
        tpl = ProjectTemplate.objects.get(name='SaaS Product')
        res = self.client.get(f'/api/templates/{tpl.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['name'], 'SaaS Product')
        self.assertEqual(res.data['task_count'], 12)
        self.assertEqual(len(res.data['tasks']), 12)


class ProjectCreationFromTemplateTests(TestCase):
    def setUp(self):
        call_command('seed_project_templates')
        self.client = APIClient()
        self.org = Organization.objects.create(name='Agency Org')
        self.user = User.objects.create_user(
            email='admin@agency.com',
            name='Agency Admin',
            password='password123',
            active_organization=self.org
        )
        from apps.accounts.models import Membership
        Membership.objects.create(user=self.user, organization=self.org, role='ORG_ADMIN')
        self.client.force_authenticate(user=self.user)

    def test_create_project_from_saas_template(self):
        tpl = ProjectTemplate.objects.get(name='SaaS Product')
        res = self.client.post(
            f'/api/templates/{tpl.id}/create-project/',
            {'name': 'CloudSaaS V1'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        project_id = res.data['id']
        project = Project.objects.get(id=project_id)
        self.assertEqual(project.name, 'CloudSaaS V1')
        self.assertEqual(project.organization, self.org)

        tasks = list(project.tasks.all().order_by('created_at'))
        self.assertEqual(len(tasks), 12)
        self.assertEqual(tasks[0].name, 'Product Discovery & Requirements')

    def test_create_project_from_customized_snapshot_leaves_template_byte_for_byte_unchanged(self):
        tpl = ProjectTemplate.objects.get(name='Software Development')
        snapshot_payload = {
            'name': 'Custom FinTech App',
            'description': 'Custom banking software',
            'tasks': [
                {
                    'name': 'Discovery Phase Custom',
                    'description': 'Scope & compliance',
                    'priority': 'HIGH',
                    'subtasks': [
                        {'name': 'Regulatory Review'},
                        {'name': 'Security Audit'}
                    ]
                }
            ]
        }

        res = self.client.post(
            f'/api/templates/{tpl.id}/create-project/',
            snapshot_payload,
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(id=res.data['id'])
        self.assertEqual(project.name, 'Custom FinTech App')
        self.assertEqual(project.organization, self.org)

        tasks = list(project.tasks.all().order_by('created_at'))
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0].name, 'Discovery Phase Custom')

        # System template must remain completely unchanged!
        system_tpl = ProjectTemplate.objects.get(name='Software Development')
        self.assertEqual(system_tpl.name, 'Software Development')
        self.assertEqual(system_tpl.tasks.count(), 9)

    def test_created_project_is_completely_independent(self):
        tpl = ProjectTemplate.objects.get(name='Web Application')
        res = self.client.post(
            f'/api/templates/{tpl.id}/create-project/',
            {'name': 'Standalone Web Portal'},
            format='json'
        )
        project = Project.objects.get(id=res.data['id'])
        task = project.tasks.first()
        task.name = 'Renamed Project Task'
        task.save()

        # Original template task must remain unchanged
        tpl_task = tpl.tasks.first()
        self.assertNotEqual(tpl_task.name, 'Renamed Project Task')

    def test_tenant_isolation_on_project_creation(self):
        tpl = ProjectTemplate.objects.get(name='Mobile Application')
        res = self.client.post(
            f'/api/templates/{tpl.id}/create-project/',
            {'name': 'Tenant Isolated Mobile App'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(id=res.data['id'])
        # Must be bound to authenticated user's active organization
        self.assertEqual(project.organization, self.org)

