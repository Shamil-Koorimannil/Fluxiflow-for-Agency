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
        self.admin1.memberships.create(organization=self.org1, role='ADMIN')

        self.member1 = User.objects.create_user(
            email='member1@acme.com', password='Password123!', name='Member One', role='MEMBER'
        )
        self.member1.memberships.create(organization=self.org1, role='MEMBER')

        self.admin2 = User.objects.create_user(
            email='admin2@stark.com', password='Password123!', name='Admin Two', role='ADMIN'
        )
        self.admin2.memberships.create(organization=self.org2, role='ADMIN')

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

    # 8. Add Existing Projects to Client
    def test_add_existing_project_to_client(self):
        client_obj = Client.objects.create(organization=self.org1, name='Mouzy Corp')
        p1 = Project.objects.create(name='Unassigned P1', organization=self.org1, created_by=self.admin1)
        p2 = Project.objects.create(name='Unassigned P2', organization=self.org1, created_by=self.admin1)

        # GET unassigned projects
        res_unassigned = self.client_admin1.get(f'/api/clients/unassigned-projects/?client_id={client_obj.id}')
        self.assertEqual(res_unassigned.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_unassigned.data), 2)

        # Associate p1 and p2 with client_obj
        res_add = self.client_admin1.post(f'/api/clients/{client_obj.id}/projects/add-existing/', {
            'project_ids': [str(p1.id), str(p2.id)]
        }, format='json')
        self.assertEqual(res_add.status_code, status.HTTP_200_OK)
        
        # Verify p1.client is client_obj
        p1.refresh_from_db()
        self.assertEqual(p1.client, client_obj)

    # 9. Remove Project from Client
    def test_remove_project_from_client(self):
        client_obj = Client.objects.create(organization=self.org1, name='Mouzy Corp')
        p1 = Project.objects.create(name='Assigned P1', organization=self.org1, created_by=self.admin1, client=client_obj)

        res_rem = self.client_admin1.delete(f'/api/clients/{client_obj.id}/projects/{p1.id}/')
        self.assertEqual(res_rem.status_code, status.HTTP_200_OK)

        p1.refresh_from_db()
        self.assertIsNone(p1.client)
        # Project itself still exists!
        self.assertTrue(Project.objects.filter(id=p1.id).exists())

    # 10. Cross Organization Project Association Blocked
    def test_cross_organization_project_association_blocked(self):
        client_org1 = Client.objects.create(organization=self.org1, name='Org 1 Client')
        p_org2 = Project.objects.create(name='Org 2 Project', organization=self.org2, created_by=self.admin2)

        # Admin 1 trying to add Org 2 project to Org 1 Client
        res_cross = self.client_admin1.post(f'/api/clients/{client_org1.id}/projects/add-existing/', {
            'project_ids': [str(p_org2.id)]
        }, format='json')
        self.assertEqual(res_cross.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("do not belong to your organization", res_cross.data['detail'])

    # 11. Client Projects Status, Date Filtering & Sorting
    def test_client_projects_filtering_and_sorting(self):
        client_obj = Client.objects.create(organization=self.org1, name='Filter Client', created_by=self.admin1)
        p_ongoing = Project.objects.create(
            name='Ongoing Project', organization=self.org1, created_by=self.admin1, client=client_obj, project_date='2026-09-01'
        )
        p_completed = Project.objects.create(
            name='Completed Project', organization=self.org1, created_by=self.admin1, client=client_obj, project_date='2026-08-15'
        )
        from apps.tasks.models import Task
        Task.objects.create(project=p_completed, name='Task 1', status='COMPLETED', created_by=self.admin1, due_date='2026-08-15')

        # Filter status=ongoing
        res_ongoing = self.client_admin1.get(f'/api/clients/{client_obj.id}/projects/?status=ongoing')
        self.assertEqual(res_ongoing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_ongoing.data), 1)
        self.assertEqual(res_ongoing.data[0]['id'], str(p_ongoing.id))

        # Filter status=completed
        res_completed = self.client_admin1.get(f'/api/clients/{client_obj.id}/projects/?status=completed')
        self.assertEqual(res_completed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_completed.data), 1)
        self.assertEqual(res_completed.data[0]['id'], str(p_completed.id))

        # Date filter month & year (September 2026 = month 9)
        res_date = self.client_admin1.get(f'/api/clients/{client_obj.id}/projects/?month=9&year=2026')
        self.assertEqual(res_date.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_date.data), 1)
        self.assertEqual(res_date.data[0]['id'], str(p_ongoing.id))

        # Sorting project_date_asc vs project_date_desc
        res_sort_asc = self.client_admin1.get(f'/api/clients/{client_obj.id}/projects/?sort=project_date_asc')
        self.assertEqual(res_sort_asc.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sort_asc.data[0]['id'], str(p_completed.id))

    # 12. Brand Asset Folder Management, Validation & Safety
    def test_brand_asset_folder_lifecycle_and_validation(self):
        client_obj = Client.objects.create(organization=self.org1, name='Folder Client', created_by=self.admin1)

        # 1. Create valid folder
        res_f1 = self.client_admin1.post('/api/client-brand-asset-folders/', {
            'client': str(client_obj.id),
            'name': '  Logos  '
        }, format='json')
        self.assertEqual(res_f1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_f1.data['name'], 'Logos') # Trimmed!
        f1_id = res_f1.data['id']

        # 2. Reject empty/whitespace folder name
        res_empty = self.client_admin1.post('/api/client-brand-asset-folders/', {
            'client': str(client_obj.id),
            'name': '   '
        }, format='json')
        self.assertEqual(res_empty.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Reject duplicate folder name under same parent
        res_dup = self.client_admin1.post('/api/client-brand-asset-folders/', {
            'client': str(client_obj.id),
            'name': 'logos'
        }, format='json')
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Create subfolder
        res_sub = self.client_admin1.post('/api/client-brand-asset-folders/', {
            'client': str(client_obj.id),
            'parent': f1_id,
            'name': 'Primary'
        }, format='json')
        self.assertEqual(res_sub.status_code, status.HTTP_201_CREATED)
        sub_id = res_sub.data['id']

        # 5. Non-empty folder safe deletion rejection
        res_del_fail = self.client_admin1.delete(f'/api/client-brand-asset-folders/{f1_id}/')
        self.assertEqual(res_del_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not empty", res_del_fail.data['detail'])

        # 6. Upload file into subfolder
        png_file = SimpleUploadedFile("brand-logo.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
        res_up = self.client_admin1.post(f'/api/clients/{client_obj.id}/brand_assets/', {
            'name': 'Brand Logo',
            'folder_id': sub_id,
            'file': png_file
        }, format='multipart')
        self.assertEqual(res_up.status_code, status.HTTP_201_CREATED)
        asset_id = res_up.data['id']

        # 7. Move asset back to root (folder = null)
        res_move = self.client_admin1.post(f'/api/client-brand-assets/{asset_id}/move/', {
            'target_folder_id': None
        }, format='json')
        self.assertEqual(res_move.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_move.data['folder'])

        # 8. Rename asset preserving extension
        res_rename = self.client_admin1.post(f'/api/client-brand-assets/{asset_id}/rename/', {
            'name': 'Primary-Logo-2026'
        }, format='json')
        self.assertEqual(res_rename.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rename.data['name'], 'Primary-Logo-2026.png') # Preserved .png!

        # 9. Delete empty subfolder
        res_del_sub = self.client_admin1.delete(f'/api/client-brand-asset-folders/{sub_id}/')
        self.assertEqual(res_del_sub.status_code, status.HTTP_204_NO_CONTENT)

    # 13. Cross-Tenant Folder Access Blocked
    def test_cross_tenant_folder_access_blocked(self):
        client1 = Client.objects.create(organization=self.org1, name='Org1 Client', created_by=self.admin1)
        client2 = Client.objects.create(organization=self.org2, name='Org2 Client', created_by=self.admin2)

        res_f = self.client_admin1.post('/api/client-brand-asset-folders/', {
            'client': str(client1.id),
            'name': 'Private Folder'
        }, format='json')
        self.assertEqual(res_f.status_code, status.HTTP_201_CREATED)
        f_id = res_f.data['id']

        # Admin 2 (Org 2) attempts to access Org 1 folder
        res_cross = self.client_admin2.get(f'/api/client-brand-asset-folders/{f_id}/')
        self.assertEqual(res_cross.status_code, status.HTTP_404_NOT_FOUND)

        # Admin 2 attempts to create folder under Org 1 Client
        res_cross_create = self.client_admin2.post('/api/client-brand-asset-folders/', {
            'client': str(client1.id),
            'name': 'Hacked Folder'
        }, format='json')
        self.assertEqual(res_cross_create.status_code, status.HTTP_403_FORBIDDEN)

