from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.projects.models import Project

User = get_user_model()

class ProjectDateManagementTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='admin@fluxiflow.com',
            password='Password123!',
            name='Admin User',
            role='ADMIN'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_project_with_project_date(self):
        payload = {
            'name': 'Website Redesign 2024',
            'description': 'Main site overhaul',
            'project_date': '2024-03-15'
        }
        response = self.client.post('/api/projects/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['project_date'], '2024-03-15')

        project = Project.objects.get(id=response.data['id'])
        self.assertEqual(project.project_date, date(2024, 3, 15))

    def test_create_project_without_project_date(self):
        payload = {
            'name': 'Undated Scope',
            'description': 'No date attached'
        }
        response = self.client.post('/api/projects/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['project_date'])

    def test_update_project_date(self):
        project = Project.objects.create(
            name='Brand Refresh',
            created_by=self.user,
            project_date=date(2024, 3, 15)
        )
        patch_payload = {'project_date': '2024-05-20'}
        response = self.client.patch(f'/api/projects/{project.id}/', patch_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['project_date'], '2024-05-20')

        project.refresh_from_db()
        self.assertEqual(project.project_date, date(2024, 5, 20))

    def test_retrieve_project_date(self):
        project = Project.objects.create(
            name='Mobile App v2',
            created_by=self.user,
            project_date=date(2024, 8, 10)
        )
        response = self.client.get(f'/api/projects/{project.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['project_date'], '2024-08-10')

    def test_list_projects_with_and_without_dates(self):
        Project.objects.create(name='P1', created_by=self.user, project_date=date(2024, 3, 5))
        Project.objects.create(name='P2', created_by=self.user, project_date=None)

        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
