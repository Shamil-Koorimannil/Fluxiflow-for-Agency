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

    def test_13_advertising_templates_seeded(self):
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

    def test_brand_strategy_structure(self):
        tpl = ProjectTemplate.objects.get(name='Brand Strategy')
        tasks = list(tpl.tasks.all().order_by('position'))
        self.assertEqual(len(tasks), 4)
        self.assertEqual(tasks[0].name, 'Discovery & Research')
        self.assertEqual(tasks[1].name, 'Brand Strategy Development')

        subtasks = list(tasks[1].subtasks.all().order_by('position'))
        self.assertEqual(len(subtasks), 2)
        self.assertEqual(subtasks[0].name, 'Market, Audience & competitor research')
        self.assertEqual(subtasks[1].name, 'Brand Messaging')

    def test_social_media_structure(self):
        tpl = ProjectTemplate.objects.get(name='Social Media')
        poster_task = tpl.tasks.get(name='Poster')
        reel_task = tpl.tasks.get(name='Reel')

        poster_subtasks = list(poster_task.subtasks.values_list('name', flat=True))
        self.assertEqual(poster_subtasks, ['Concept', 'Design'])

        reel_subtasks = list(reel_task.subtasks.values_list('name', flat=True))
        self.assertEqual(reel_subtasks, ['Content', 'Shoot', 'Post production'])

    def test_seed_command_idempotency(self):
        call_command('seed_project_templates')
        call_command('seed_project_templates')
        self.assertEqual(ProjectTemplate.objects.count(), 13)


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
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'Advertising')

    def test_list_templates(self):
        res = self.client.get('/api/templates/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 13)

    def test_search_by_template_name(self):
        res = self.client.get('/api/templates/?search=brand')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [t['name'] for t in res.data]
        self.assertIn('Brand Strategy', names)

    def test_search_by_task_name(self):
        res = self.client.get('/api/templates/?search=website')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [t['name'] for t in res.data]
        self.assertIn('Static Website', names)
        self.assertIn('Ecommerce Website', names)

    def test_search_by_subtask_name(self):
        res = self.client.get('/api/templates/?search=shoot')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [t['name'] for t in res.data]
        self.assertIn('Social Media', names)

    def test_template_detail(self):
        tpl = ProjectTemplate.objects.get(name='Brand Strategy')
        res = self.client.get(f'/api/templates/{tpl.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['name'], 'Brand Strategy')
        self.assertEqual(res.data['task_count'], 4)
        self.assertEqual(res.data['subtask_count'], 2)
        self.assertEqual(len(res.data['tasks']), 4)


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

    def test_create_project_from_default_template(self):
        tpl = ProjectTemplate.objects.get(name='Package Design')
        res = self.client.post(
            f'/api/templates/{tpl.id}/create-project/',
            {'name': 'Client A Packaging'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        project_id = res.data['id']
        project = Project.objects.get(id=project_id)
        self.assertEqual(project.name, 'Client A Packaging')
        self.assertEqual(project.organization, self.org)

        tasks = list(project.tasks.all().order_by('created_at'))
        self.assertEqual(len(tasks), 5)
        self.assertEqual(tasks[0].name, 'Study Brief & Research')

    def test_create_project_from_customized_snapshot(self):
        tpl = ProjectTemplate.objects.get(name='Brand Strategy')
        snapshot_payload = {
            'name': 'Client X Brand Strategy & Positioning',
            'description': 'Custom brand strategy project',
            'tasks': [
                {
                    'name': 'Custom Discovery Task',
                    'description': 'Deep dive interview',
                    'priority': 'HIGH',
                    'subtasks': [
                        {'name': 'Stakeholder Interview'},
                        {'name': 'Competitor Matrix'}
                    ]
                },
                {
                    'name': 'Custom Strategy Task',
                    'priority': 'MEDIUM',
                    'subtasks': []
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
        self.assertEqual(project.name, 'Client X Brand Strategy & Positioning')

        tasks = list(project.tasks.all().order_by('created_at'))
        self.assertEqual(len(tasks), 2)
        self.assertEqual(tasks[0].name, 'Custom Discovery Task')

        subtasks = list(tasks[0].subtasks.all().order_by('created_at'))
        self.assertEqual(len(subtasks), 2)
        self.assertEqual(subtasks[0].name, 'Stakeholder Interview')
        self.assertEqual(subtasks[1].name, 'Competitor Matrix')

        # Verify original system template remains completely unchanged!
        system_tpl = ProjectTemplate.objects.get(name='Brand Strategy')
        self.assertEqual(system_tpl.name, 'Brand Strategy')
        self.assertEqual(system_tpl.tasks.count(), 4)

    def test_created_project_is_completely_independent(self):
        tpl = ProjectTemplate.objects.get(name='Static Website')
        res = self.client.post(
            f'/api/templates/{tpl.id}/create-project/',
            {'name': 'Standalone Website Project'},
            format='json'
        )
        project = Project.objects.get(id=res.data['id'])
        task = project.tasks.first()
        task.name = 'Modified Project Task Name'
        task.save()

        # Original template task must not be modified
        tpl_task = tpl.tasks.first()
        self.assertNotEqual(tpl_task.name, 'Modified Project Task Name')

    def test_blank_project_creation_unaffected(self):
        res = self.client.post(
            '/api/projects/',
            {'name': 'Normal Blank Project'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        p = Project.objects.get(id=res.data['id'])
        self.assertEqual(p.name, 'Normal Blank Project')
        self.assertEqual(p.tasks.count(), 0)
