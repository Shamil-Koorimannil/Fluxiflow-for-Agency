import io
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import Organization
from apps.keep.models import (
    KeepItem, KeepPermission, KeepShareLink, KeepVersionHistory,
    KeepAuditLog, KeepUserPin, KeepRecentItem
)
from apps.keep.sanitizer import sanitize_html

User = get_user_model()

class KeepBackendTestSuite(TestCase):
    def setUp(self):
        # Setup test organization and users
        self.org1 = Organization.objects.create(name="Acme Corp")
        self.org2 = Organization.objects.create(name="Globex Corp")

        self.user1 = User.objects.create_user(
            email='user1@acme.com', password='Password123!', name='User One', role='ADMIN'
        )
        self.user1.memberships.create(organization=self.org1)

        self.user2 = User.objects.create_user(
            email='user2@acme.com', password='Password123!', name='User Two', role='MEMBER'
        )
        self.user2.memberships.create(organization=self.org1)

        self.user3 = User.objects.create_user(
            email='user3@globex.com', password='Password123!', name='User Three', role='ADMIN'
        )
        self.user3.memberships.create(organization=self.org2)

        self.client1 = APIClient()
        self.client1.force_authenticate(user=self.user1)

        self.client2 = APIClient()
        self.client2.force_authenticate(user=self.user2)

        self.client3 = APIClient()
        self.client3.force_authenticate(user=self.user3)

    # 1. User can create Keep item
    def test_01_create_keep_item(self):
        res = self.client1.post('/api/keep/items/', {
            'item_type': 'DOCUMENT',
            'name': 'Project Plan',
            'document_content': '<p>Draft</p>'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Project Plan')
        self.assertEqual(res.data['version'], 1)

    # 2. User can retrieve own item
    def test_02_retrieve_own_item(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='My Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        res = self.client1.get(f'/api/keep/items/{item.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['name'], 'My Doc')

    # 3. Unauthorized user cannot retrieve private item
    def test_03_unauthorized_retrieve_private_item(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Private Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        res = self.client3.get(f'/api/keep/items/{item.id}/')
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    # 4 & 5. VIEW and EDIT permission checks
    def test_04_05_view_and_edit_permissions(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Shared Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        KeepPermission.objects.create(item=item, user=self.user2, access_level='SPECIFIC', role='VIEW')

        # VIEW user can read
        res_get = self.client2.get(f'/api/keep/items/{item.id}/')
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)

        # Viewer cannot edit
        res_put = self.client2.put(f'/api/keep/items/{item.id}/', {'name': 'Hacked', 'version': 1}, format='json')
        self.assertEqual(res_put.status_code, status.HTTP_403_FORBIDDEN)

        # Upgrade to EDIT
        KeepPermission.objects.filter(item=item, user=self.user2).update(role='EDIT')
        res_put2 = self.client2.patch(f'/api/keep/items/{item.id}/', {'name': 'Updated Name', 'version': 1}, format='json')
        self.assertEqual(res_put2.status_code, status.HTTP_200_OK)

    # 6 & 7. Viewer cannot delete
    def test_06_07_viewer_cannot_delete(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        KeepPermission.objects.create(item=item, user=self.user2, access_level='SPECIFIC', role='VIEW')
        res = self.client2.delete(f'/api/keep/items/{item.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 8 & 9. Owner can share and revoke
    def test_08_09_share_and_revoke(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        res_share = self.client1.post(f'/api/keep/items/{item.id}/permissions/', {
            'email': self.user2.email,
            'access_level': 'SPECIFIC',
            'role': 'VIEW'
        }, format='json')
        self.assertEqual(res_share.status_code, status.HTTP_200_OK)

        perm_id = res_share.data['id']
        res_revoke = self.client1.delete(f'/api/keep/items/{item.id}/revoke_permission/?permission_id={perm_id}')
        self.assertEqual(res_revoke.status_code, status.HTTP_204_NO_CONTENT)

    # 11 & 22. Organization isolation prevents cross-organization access
    def test_11_22_org_isolation(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Org1 Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        # Attempt share with Org2 user
        res_share = self.client1.post(f'/api/keep/items/{item.id}/permissions/', {
            'email': self.user3.email,
            'access_level': 'SPECIFIC',
            'role': 'VIEW'
        }, format='json')
        self.assertEqual(res_share.status_code, status.HTTP_400_BAD_REQUEST)

    # 12, 13 & 14. Share links
    def test_12_13_14_share_links(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Link Doc', owner=self.user1, created_by=self.user1, organization=self.org1
        )
        res_link = self.client1.post(f'/api/keep/items/{item.id}/share_link/', {'permission': 'VIEW'}, format='json')
        self.assertEqual(res_link.status_code, status.HTTP_201_CREATED)
        token = res_link.data['token']

        # Access via token
        res_access = self.client1.get(f'/api/keep/share/{token}/')
        self.assertEqual(res_access.status_code, status.HTTP_200_OK)

        # Revoke link
        self.client1.delete(f'/api/keep/items/{item.id}/share_link/')
        res_access_revoked = self.client1.get(f'/api/keep/share/{token}/')
        self.assertEqual(res_access_revoked.status_code, status.HTTP_404_NOT_FOUND)

    # 19 & 20. Circular folder movement rejection
    def test_19_20_folder_circular_movement(self):
        f1 = KeepItem.objects.create(item_type='FOLDER', name='F1', owner=self.user1, created_by=self.user1, organization=self.org1)
        f2 = KeepItem.objects.create(item_type='FOLDER', name='F2', owner=self.user1, created_by=self.user1, organization=self.org1, parent_folder=f1)

        # Move F1 into F2 (its descendant) -> must fail
        res = self.client1.post(f'/api/keep/items/{f1.id}/move/', {'parent_folder': str(f2.id)}, format='json')
        self.assertIn(res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR])

    # 28, 29 & 30. Soft delete, restore and permanent delete
    def test_28_29_30_delete_restore_permanent(self):
        item = KeepItem.objects.create(item_type='DOCUMENT', name='To Delete', owner=self.user1, created_by=self.user1, organization=self.org1)
        
        # Soft delete
        self.client1.delete(f'/api/keep/items/{item.id}/')
        item.refresh_from_db()
        self.assertTrue(item.is_deleted)

        # Restore
        self.client1.post(f'/api/keep/items/{item.id}/restore/')
        item.refresh_from_db()
        self.assertFalse(item.is_deleted)

        # Permanent delete
        self.client1.delete(f'/api/keep/items/{item.id}/permanent_delete/')
        self.assertFalse(KeepItem.objects.filter(id=item.id).exists())

    # 60 & 61. Optimistic concurrency
    def test_60_61_optimistic_concurrency(self):
        item = KeepItem.objects.create(
            item_type='DOCUMENT', name='Version Doc', version=1, owner=self.user1, created_by=self.user1, organization=self.org1
        )
        # Matching version succeeds
        res_ok = self.client1.patch(f'/api/keep/items/{item.id}/', {'name': 'Updated', 'version': 1}, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data['version'], 2)

        # Stale version fails with 409
        res_conflict = self.client1.patch(f'/api/keep/items/{item.id}/', {'name': 'Stale Edit', 'version': 1}, format='json')
        self.assertEqual(res_conflict.status_code, status.HTTP_409_CONFLICT)

    # 62. HTML sanitization
    def test_62_html_sanitization(self):
        dirty_html = '<p>Hello <script>alert("hack")</script><a href="javascript:alert(1)">Link</a></p>'
        clean = sanitize_html(dirty_html)
        self.assertNotIn('<script>', clean)
        self.assertNotIn('javascript:', clean)
        self.assertTrue(clean.startswith('<p>Hello'))

    # 63. Search permission awareness
    def test_63_permission_aware_search(self):
        KeepItem.objects.create(item_type='DOCUMENT', name='Secret Alpha', owner=self.user1, created_by=self.user1, organization=self.org1)
        res = self.client3.get('/api/keep/search/?q=Secret')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    # 33 & 48. CSV import & export
    def test_33_48_csv_import_export(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv_content = b"Name,Age\nAlice,30\nBob,25"
        file = SimpleUploadedFile("users.csv", csv_content, content_type="text/csv")

        res_upload = self.client1.post('/api/keep/items/upload_spreadsheet/', {'file': file}, format='multipart')
        self.assertEqual(res_upload.status_code, status.HTTP_201_CREATED)
        item_id = res_upload.data['id']

        # Export CSV
        res_export = self.client1.get(f'/api/keep/items/{item_id}/export/?export_format=csv')
        self.assertEqual(res_export.status_code, status.HTTP_200_OK)
        self.assertIn(b"Alice", res_export.content)

    # 34. .XLS import, export and direct sharing synchronization
    def test_34_xls_import_export_and_shared_section(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        import xlwt
        wb = xlwt.Workbook()
        ws1 = wb.add_sheet('SheetOne')
        ws1.write(0, 0, 'Header1')
        ws1.write(0, 1, 'Header2')
        ws1.write(1, 0, 'Data1')
        ws1.write(1, 1, 100)

        ws2 = wb.add_sheet('SheetTwo')
        ws2.write(0, 0, 'Info')

        out = io.BytesIO()
        wb.save(out)
        xls_bytes = out.getvalue()

        file_obj = SimpleUploadedFile("data.xls", xls_bytes, content_type="application/vnd.ms-excel")

        # 1. Upload .xls
        res_upload = self.client1.post('/api/keep/items/upload_spreadsheet/', {'file': file_obj}, format='multipart')
        self.assertEqual(res_upload.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_upload.data['name'], 'data')
        item_id = res_upload.data['id']

        # 2. Verify imported sheets & cell values
        sp_data = res_upload.data['spreadsheet_data']
        self.assertEqual(len(sp_data['sheets']), 2)
        sheet1_cells = sp_data['sheets'][0]['cells']
        self.assertEqual(sheet1_cells['A1']['value'], 'Header1')
        self.assertEqual(sheet1_cells['B2']['value'], '100')

        # 3. Export .xls converted spreadsheet as XLSX
        res_export_xlsx = self.client1.get(f'/api/keep/items/{item_id}/export/?export_format=xlsx')
        self.assertEqual(res_export_xlsx.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_export_xlsx.content) > 0)

        # 4. Direct Share with user2
        res_share = self.client1.post(f'/api/keep/items/{item_id}/permissions/', {
            'email': self.user2.email,
            'role': 'VIEW'
        }, format='json')
        self.assertEqual(res_share.status_code, status.HTTP_200_OK)

        # 5. User2 sees item under section=shared
        res_shared_qs = self.client2.get('/api/keep/items/?section=shared')
        self.assertEqual(res_shared_qs.status_code, status.HTTP_200_OK)
        shared_ids = [i['id'] for i in res_shared_qs.data]
        self.assertIn(item_id, shared_ids)

        # 6. Revoke access -> disappears from section=shared
        perm_id = res_share.data['id']
        self.client1.delete(f'/api/keep/items/{item_id}/revoke_permission/?permission_id={perm_id}')
        res_shared_after = self.client2.get('/api/keep/items/?section=shared')
        shared_ids_after = [i['id'] for i in res_shared_after.data]
        self.assertNotIn(item_id, shared_ids_after)
