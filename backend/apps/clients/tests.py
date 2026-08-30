import io
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import Organization
from apps.clients.models import Client, ClientBrandAsset
from apps.projects.models import Project

User = get_user_model()

class ClientManagementTestSuite(TestCase):
    def setUp(self):
        # Setup test organizations and users
        self.org1 = Organization.objects.create(name="Acme Agency")
        self.org2 = Organization.objects.create(name="Stark Industries")

        self.admin1 = User.objects.create_user(
            email='admin1@acme.com', password='Password123!', name='Admin One', role='ADMIN'
        )
        self.admin1.memberships.create(organization=self.org1)

        self.member1 = User.objects.create_user(
            email='member1@acme.com', password='Password123!', name='Member One', role='MEMBER'
        )
        self.member1.memberships.create(organization=self.org1)

        self.admin2 = User.objects.create_user(
            email='admin2@stark.com', password='Password123!', name='Admin Two', role='ADMIN'
        )
        self.admin2.memberships.create(organization=self.org2)

        self.client_admin1 = APIClient()
        self.client_admin1.force_authenticate(user=self.admin1)

        self.client_member1 = APIClient()
        self.client_member1.force_authenticate(user=self.member1)

        self.client_admin2 = APIClient()
        self.client_admin2.force_authenticate(user=self.admin2)

    # 1. Admin can create Client
    def test_admin_create_client(self):
        res = self.client_admin1.post('/api/clients/', {
            'name': 'Wayne Enterprises',
            'company_name': 'Wayne Corp',
            'email': 'bruce@wayne.com',
            'phone': '123-456-7890',
            'website': 'https://wayne.com',
            'status': 'ACTIVE'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Wayne Enterprises')

    # 2. Member CANNOT create or access Client API (V1 Admin Only Policy)
    def test_member_cannot_access_client_api(self):
        # Create a client as admin first
        c = Client.objects.create(organization=self.org1, name='Test Client', created_by=self.admin1)

        # GET /api/clients/
        res_list = self.client_member1.get('/api/clients/')
        self.assertEqual(res_list.status_code, status.HTTP_403_FORBIDDEN)

        # GET /api/clients/{id}/
        res_detail = self.client_member1.get(f'/api/clients/{c.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

        # POST /api/clients/
        res_post = self.client_member1.post('/api/clients/', {'name': 'Unauthorized'}, format='json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    # 3. Organization A cannot access Organization B Client
    def test_organization_isolation_client(self):
        client_b = Client.objects.create(organization=self.org2, name='Org B Client', created_by=self.admin2)

        # Admin 1 (Org 1) trying to access Org B Client
        res = self.client_admin1.get(f'/api/clients/{client_b.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # 4. Search and Status Filtering
    def test_client_search_and_filtering(self):
        c1 = Client.objects.create(organization=self.org1, name='Alpha Corp', email='contact@alpha.com', status='ACTIVE')
        c2 = Client.objects.create(organization=self.org1, name='Beta Systems', email='info@beta.com', status='INACTIVE')

        # Search query
        res_search = self.client_admin1.get('/api/clients/?q=Alpha')
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.data), 1)
        self.assertEqual(res_search.data[0]['id'], str(c1.id))

        # Status filter
        res_inactive = self.client_admin1.get('/api/clients/?status=INACTIVE')
        self.assertEqual(res_inactive.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_inactive.data), 1)
        self.assertEqual(res_inactive.data[0]['id'], str(c2.id))

    # 5. Project Client Linking & Project Filtering
    def test_project_client_relationship(self):
        client_obj = Client.objects.create(organization=self.org1, name='Cyberdyne', created_by=self.admin1)

        # Create project linked to client
        res_p = self.client_admin1.post('/api/projects/', {
            'name': 'Skynet Redesign',
            'client': str(client_obj.id)
        }, format='json')
        self.assertEqual(res_p.status_code, status.HTTP_201_CREATED)
        p_id = res_p.data['id']

        # Get projects for client endpoint
        res_client_projects = self.client_admin1.get(f'/api/clients/{client_obj.id}/projects/')
        self.assertEqual(res_client_projects.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_client_projects.data), 1)
        self.assertEqual(res_client_projects.data[0]['id'], p_id)

        # Projects list filter ?client=
        res_filter = self.client_admin1.get(f'/api/projects/?client={client_obj.id}')
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_filter.data), 1)

    # 6. Deletion Protection with existing projects
    def test_client_deletion_protection(self):
        client_obj = Client.objects.create(organization=self.org1, name='Protective Inc')
        Project.objects.create(name='Active Project', organization=self.org1, created_by=self.admin1, client=client_obj)

        res_del = self.client_admin1.delete(f'/api/clients/{client_obj.id}/')
        self.assertEqual(res_del.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot delete the client", res_del.data['detail'])

    # 7. Brand Asset Upload & Security Validation
    def test_brand_asset_upload_and_validation(self):
        client_obj = Client.objects.create(organization=self.org1, name='Asset Client')

        # 1. Valid SVG Logo Upload
        logo_file = SimpleUploadedFile("logo.svg", b"<svg></svg>", content_type="image/svg+xml")
        res_up = self.client_admin1.post(f'/api/clients/{client_obj.id}/brand_assets/', {
            'name': 'Main Logo',
            'asset_type': 'LOGO',
            'file': logo_file
        }, format='multipart')
        self.assertEqual(res_up.status_code, status.HTTP_201_CREATED)
        asset_id = res_up.data['id']

        # 2. Forbidden script file upload
        script_file = SimpleUploadedFile("hack.py", b"import os; os.system('ls')", content_type="text/x-python")
        res_invalid = self.client_admin1.post(f'/api/clients/{client_obj.id}/brand_assets/', {
            'name': 'Malicious Code',
            'file': script_file
        }, format='multipart')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not allowed for security reasons", res_invalid.data['detail'])

        # 3. Org B Admin trying to access asset
        res_org2_asset = self.client_admin2.get(f'/api/client-brand-assets/{asset_id}/')
        self.assertEqual(res_org2_asset.status_code, status.HTTP_404_NOT_FOUND)
