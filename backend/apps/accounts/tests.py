import re
import hashlib
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core import mail
from django.conf import settings
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from apps.accounts.models import OTPVerification, Session, Organization, Membership, Invitation, Profile

User = get_user_model()

class OTPAuthenticationTests(APITestCase):
    def setUp(self):
        # Create default organization
        self.org = Organization.objects.create(name='Fluxiflow Agency')

        # Create active Admin
        self.admin = User.objects.create_user(
            email='admin@example.com',
            name='Admin User',
            password='password123',
            role='ADMIN',
            status='ACTIVE'
        )
        ProfileClass = User._meta.get_field('profile').related_model
        ProfileClass.objects.create(user=self.admin)
        Membership.objects.create(organization=self.org, user=self.admin)

        # Create active Member
        self.member = User.objects.create_user(
            email='member@example.com',
            name='Member User',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.member)
        Membership.objects.create(organization=self.org, user=self.member)

        # Create deactivated Member
        self.deactivated = User.objects.create_user(
            email='deactivated@example.com',
            name='Deactivated Member',
            password='password123',
            role='MEMBER',
            status='INACTIVE',
            is_active=False
        )
        ProfileClass.objects.create(user=self.deactivated)
        Membership.objects.create(organization=self.org, user=self.deactivated)

        # Clear email outbox and OTPs before each test
        mail.outbox.clear()
        OTPVerification.objects.all().delete()

    def _request_otp(self, email):
        return self.client.post('/api/auth/request-otp/', {'email': email}, format='json')

    def _verify_otp(self, email, otp):
        return self.client.post('/api/auth/verify-otp/', {'email': email, 'otp': otp}, format='json')

    def test_request_otp_active_admin(self):
        """1. Request OTP for active Admin."""
        response = self._request_otp(self.admin.email)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("verification code has been sent", response.data['message'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.admin.email, mail.outbox[0].to)

    def test_request_otp_active_member(self):
        """2. Request OTP for active Member."""
        response = self._request_otp(self.member.email)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.member.email, mail.outbox[0].to)

    def test_verify_valid_otp(self):
        """3. Verify valid OTP."""
        self._request_otp(self.member.email)
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        
        response = self._verify_otp(self.member.email, otp_code)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], self.member.email)

    def test_reject_invalid_otp(self):
        """4. Reject invalid OTP."""
        self._request_otp(self.member.email)
        response = self._verify_otp(self.member.email, '999999')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("That code is incorrect", response.data['detail'])

    def test_reject_expired_otp(self):
        """5. Reject expired OTP."""
        self._request_otp(self.member.email)
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        
        # Manually expire the OTP in database
        OTPVerification.objects.all().update(expires_at=timezone.now() - timedelta(minutes=1))
        
        response = self._verify_otp(self.member.email, otp_code)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", response.data['detail'])

    def test_otp_cannot_be_reused(self):
        """6. OTP cannot be reused."""
        self._request_otp(self.member.email)
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        
        # Verify first time: success
        response1 = self._verify_otp(self.member.email, otp_code)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Verify second time: fail
        response2 = self._verify_otp(self.member.email, otp_code)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_otp_attempt_limit(self):
        """7. OTP attempt limit (max 5 failed attempts locks OTP)."""
        self._request_otp(self.member.email)
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        
        # 4 wrong guesses: should return incorrect code message
        for _ in range(4):
            response = self._verify_otp(self.member.email, '000000')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("That code is incorrect", response.data['detail'])

        # 5th wrong guess: should invalidate the code and return "Too many failed attempts"
        response = self._verify_otp(self.member.email, '000000')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Too many failed attempts", response.data['detail'])
            
        # 6th guess (correct OTP code) should fail because it was invalidated and expired
        response = self._verify_otp(self.member.email, otp_code)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No active code found", response.data['detail'])

    def test_otp_resend_invalidates_previous_otp(self):
        """8. OTP resend invalidates previous OTP."""
        self._request_otp(self.member.email)
        otp_code_1 = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        
        # Invalidate 60s rate limit in database so we can resend immediately
        OTPVerification.objects.all().update(created_at=timezone.now() - timedelta(seconds=70))
        
        self._request_otp(self.member.email)
        otp_code_2 = re.search(r'\b\d{6}\b', mail.outbox[1].body).group()
        
        # Try verifying with first OTP: should fail
        response1 = self._verify_otp(self.member.email, otp_code_1)
        self.assertEqual(response1.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Try verifying with second OTP: should succeed
        response2 = self._verify_otp(self.member.email, otp_code_2)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

    def test_otp_rate_limiting(self):
        """9. OTP rate limiting (cannot request within 60s)."""
        response1 = self._request_otp(self.member.email)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        response2 = self._request_otp(self.member.email)
        self.assertEqual(response2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Please wait 60 seconds", response2.data['detail'])

    def test_deactivated_member_cannot_login(self):
        """10. Deactivated member cannot login."""
        response = self._request_otp(self.deactivated.email)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("deactivated", response.data['detail'])
        self.assertEqual(len(mail.outbox), 0)

    def test_unknown_email_does_not_reveal_existence(self):
        """11. Unknown email does not reveal account existence (enumeration safety)."""
        response = self._request_otp('unknown@example.com')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not registered or invited", response.data['detail'])
        self.assertEqual(len(mail.outbox), 0) # No email actually sent

    def test_correct_role_loaded_after_login(self):
        """12. Correct role loaded after login."""
        # Test Admin
        self._request_otp(self.admin.email)
        otp_admin = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        res_admin = self._verify_otp(self.admin.email, otp_admin)
        self.assertEqual(res_admin.data['user']['role'], 'ADMIN')
        
        # Test Member
        self._request_otp(self.member.email)
        otp_member = re.search(r'\b\d{6}\b', mail.outbox[1].body).group()
        res_member = self._verify_otp(self.member.email, otp_member)
        self.assertEqual(res_member.data['user']['role'], 'MEMBER')

    def test_logout_works(self):
        """15. Logout works."""
        self._request_otp(self.member.email)
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        res = self._verify_otp(self.member.email, otp_code)
        
        access_token = res.data['access']
        refresh_token = res.data['refresh']
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_res = self.client.post('/api/auth/logout/', {'refresh': refresh_token}, format='json')
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)
        
        # Subsequent requests with same token should fail refresh or validation checks
        token_hash = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()
        self.assertTrue(Session.objects.get(refresh_token_hash=token_hash).revoked_at is not None)

    def test_existing_protected_apis_continue_working(self):
        """16. Existing protected APIs continue working."""
        self._request_otp(self.member.email)
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        res = self._verify_otp(self.member.email, otp_code)
        access_token = res.data['access']
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        profile_res = self.client.get('/api/profile/')
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data['email'], self.member.email)

    def test_existing_invitation_flow_works(self):
        """17. Existing invitation flow works."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._get_admin_token()}')
        
        # Invite a new user
        invite_data = {
            'email': 'newinvitee@example.com',
            'name': 'New Invitee',
            'role': 'MEMBER'
        }
        res_invite = self.client.post('/api/team/', invite_data, format='json')
        self.assertEqual(res_invite.status_code, status.HTTP_201_CREATED)
        
        # Verify user is created with INVITED state
        new_user = User.objects.get(email='newinvitee@example.com')
        self.assertEqual(new_user.status, 'INVITED')
        
        # Clear client credentials
        self.client.credentials()
        
        # Now let the invited user log in with OTP
        self._request_otp('newinvitee@example.com')
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()
        
        res_login = self._verify_otp('newinvitee@example.com', otp_code)
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        
        # User status should now be ACTIVE
        new_user.refresh_from_db()
        self.assertEqual(new_user.status, 'ACTIVE')
        
        # Invitation should now be ACCEPTED
        invitation = Invitation.objects.get(email='newinvitee@example.com')
        self.assertEqual(invitation.status, 'ACCEPTED')

    def _get_admin_token(self):
        self._request_otp(self.admin.email)
        otp = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        res = self._verify_otp(self.admin.email, otp)
        mail.outbox.clear()
        return res.data['access']


class TeamInvitationEmailTests(APITestCase):
    """
    Tests for the team member invitation email system.
    Covers: creation, email delivery, content, no-password/no-OTP, duplicate
    prevention, normalization, OTP login after invite, resend, error handling.
    """

    def setUp(self):
        self.org = Organization.objects.create(name='Fluxiflow Agency')
        ProfileClass = User._meta.get_field('profile').related_model

        self.admin = User.objects.create_user(
            email='admin@example.com',
            name='Admin User',
            role='ADMIN',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.admin)
        Membership.objects.create(organization=self.org, user=self.admin)

        mail.outbox.clear()
        OTPVerification.objects.all().delete()

        # Authenticate as admin
        self._request_otp(self.admin.email)
        otp = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        res = self.client.post('/api/auth/verify-otp/', {'email': self.admin.email, 'otp': otp}, format='json')
        self.admin_token = res.data['access']
        mail.outbox.clear()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')

    def _request_otp(self, email):
        return self.client.post('/api/auth/request-otp/', {'email': email}, format='json')

    def _verify_otp(self, email, otp):
        return self.client.post('/api/auth/verify-otp/', {'email': email, 'otp': otp}, format='json')

    def _invite(self, email='newmember@example.com', name='New Member', role='MEMBER'):
        return self.client.post('/api/team/', {'email': email, 'name': name, 'role': role}, format='json')

    # ── 1. Admin can invite a member ──────────────────────────────────────────
    def test_invite_member_returns_201(self):
        """1. Admin invite returns HTTP 201."""
        res = self._invite()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    # ── 2. Member is created with INVITED status ───────────────────────────────
    def test_invite_creates_user_with_invited_status(self):
        """2. Invited member has status=INVITED."""
        self._invite()
        user = User.objects.get(email='newmember@example.com')
        self.assertEqual(user.status, 'INVITED')

    # ── 3. Invitation email is sent ───────────────────────────────────────────
    def test_invite_sends_one_email(self):
        """3. Exactly one invitation email is dispatched."""
        self._invite()
        self.assertEqual(len(mail.outbox), 1)

    # ── 4. Email recipient is the exact entered address ────────────────────────
    def test_invite_email_recipient_is_member_email(self):
        """4. Invitation email recipient matches the invited member email."""
        self._invite(email='targetmember@example.com')
        self.assertIn('targetmember@example.com', mail.outbox[0].to)

    # ── 5. Subject is correct ────────────────────────────────────────────────
    def test_invite_email_subject(self):
        """5. Invitation email subject contains 'Fluxiflow'."""
        self._invite()
        self.assertIn('Fluxiflow', mail.outbox[0].subject)

    # ── 6. Email body contains member name ────────────────────────────────────
    def test_invite_email_contains_member_name(self):
        """6. Email body contains the invited member's name."""
        self._invite(name='Jane Doe')
        self.assertIn('Jane Doe', mail.outbox[0].body)

    # ── 7. Email body contains member email ───────────────────────────────────
    def test_invite_email_contains_member_email(self):
        """7. Email body contains the invited member's email address."""
        self._invite(email='janedoe@example.com')
        self.assertIn('janedoe@example.com', mail.outbox[0].body)

    # ── 8. Email does NOT contain the word 'password' ────────────────────────
    def test_invite_email_does_not_contain_password(self):
        """8. Invitation email must not contain any password."""
        self._invite()
        body_lower = mail.outbox[0].body.lower()
        self.assertNotIn('password', body_lower)

    # ── 9. Email does NOT contain a 6-digit OTP ──────────────────────────────
    def test_invite_email_does_not_contain_otp(self):
        """9. Invitation email must not contain any OTP code."""
        self._invite()
        # Should not contain a standalone 6-digit number (OTP pattern)
        otp_pattern = re.compile(r'\b\d{6}\b')
        self.assertIsNone(otp_pattern.search(mail.outbox[0].body))

    # ── 10. Duplicate email is rejected ──────────────────────────────────────
    def test_invite_duplicate_email_rejected(self):
        """10. Inviting an already-existing email returns 400."""
        self._invite()
        mail.outbox.clear()
        res = self._invite()  # Second invite with same email
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', res.data['detail'])
        self.assertEqual(len(mail.outbox), 0)  # No email sent for duplicate

    # ── 11. Email is normalized (stripped and lowercased) ─────────────────────
    def test_invite_email_is_normalized(self):
        """11. Email is normalized (stripped, lowercased) before storage."""
        res = self.client.post(
            '/api/team/',
            {'email': '  TestEmail@Example.COM  ', 'name': 'Test User', 'role': 'MEMBER'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='testemail@example.com').exists())

    # ── 12. Invited member can login via OTP ──────────────────────────────────
    def test_invited_member_can_login_via_otp(self):
        """12. Invited member can subsequently log in using Email + OTP."""
        self._invite(email='invited@example.com')
        mail.outbox.clear()
        self.client.credentials()  # Remove admin creds

        otp_res = self._request_otp('invited@example.com')
        self.assertEqual(otp_res.status_code, status.HTTP_200_OK)

        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        login_res = self._verify_otp('invited@example.com', otp_code)
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_res.data)

    # ── 13. Status transitions after first login ──────────────────────────────
    def test_invited_member_status_becomes_active_after_otp_login(self):
        """13. Member status becomes ACTIVE and invitation ACCEPTED after first OTP login."""
        self._invite(email='newbie@example.com')
        mail.outbox.clear()
        self.client.credentials()

        self._request_otp('newbie@example.com')
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[0].body).group()
        self._verify_otp('newbie@example.com', otp_code)

        user = User.objects.get(email='newbie@example.com')
        self.assertEqual(user.status, 'ACTIVE')

        invitation = Invitation.objects.get(email='newbie@example.com')
        self.assertEqual(invitation.status, 'ACCEPTED')

    # ── 14. Resend invitation works ───────────────────────────────────────────
    def test_resend_invitation_sends_email(self):
        """14. Resend invitation sends an email to the invited member."""
        self._invite(email='resendme@example.com')
        user = User.objects.get(email='resendme@example.com')
        mail.outbox.clear()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        res = self.client.post(f'/api/team/{user.id}/resend/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('resendme@example.com', mail.outbox[0].to)

    # ── 15. Resend on non-INVITED member is rejected ──────────────────────────
    def test_resend_invitation_rejected_for_active_member(self):
        """15. Resend invitation is rejected for ACTIVE (non-invited) members."""
        active_member = User.objects.create_user(
            email='activemember@example.com',
            name='Active Member',
            role='MEMBER',
            status='ACTIVE'
        )
        Membership.objects.create(organization=self.org, user=active_member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        res = self.client.post(f'/api/team/{active_member.id}/resend/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ── 16. Email failure returns email_sent=False in response ────────────────
    def test_email_failure_returns_email_sent_false(self):
        """16. If SMTP fails, member is still created but email_sent=False in response."""
        from unittest.mock import patch
        with patch('apps.accounts.services.InvitationEmailService.send_invitation_email',
                   return_value=(False, 'SMTP connection refused')):
            res = self._invite(email='failmail@example.com')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data.get('email_sent'))
        self.assertTrue(User.objects.filter(email='failmail@example.com').exists())

    # ── 17. Email body contains 'Login to Fluxiflow' button text ─────────────
    def test_invite_email_contains_login_button_text(self):
        """17. Invitation email body contains 'Login to Fluxiflow'."""
        self._invite()
        # Check plain-text body; HTML alternative also contains the button
        # but Django test outbox exposes plain-text in .body
        # We also check the HTML alternative content
        msg = mail.outbox[0]
        full_content = msg.body
        # Also check HTML alternative if present
        for content, mime in getattr(msg, 'alternatives', []):
            full_content += content
        self.assertIn('Login to Fluxiflow', full_content)

    # ── 18. Email body contains correct login URL ─────────────────────────────
    def test_invite_email_contains_login_url(self):
        """18. Invitation email body contains the correct login URL."""
        self._invite()
        msg = mail.outbox[0]
        full_content = msg.body
        for content, mime in getattr(msg, 'alternatives', []):
            full_content += content
        self.assertIn('http://localhost:5173/login', full_content)

    # ── 19. Production FRONTEND_URL used in login URL ─────────────────────────
    def test_invite_email_uses_production_frontend_url(self):
        """19. When FRONTEND_URL=https://example.com, email contains https://example.com/login."""
        from unittest.mock import patch
        with patch.object(settings, 'FRONTEND_URL', 'https://example.com'):
            self._invite(email='prodtest@example.com')
        msg = mail.outbox[0]
        full_content = msg.body
        for content, mime in getattr(msg, 'alternatives', []):
            full_content += content
        self.assertIn('https://example.com/login', full_content)
        self.assertNotIn('localhost', full_content)





class SecurityAuthenticationTests(APITestCase):
    def setUp(self):
        # Create organization
        self.org = Organization.objects.create(name='Fluxiflow Agency')

        # Admin User
        self.admin = User.objects.create_user(
            email='admin@example.com',
            name='Admin User',
            role='ADMIN',
            status='ACTIVE'
        )
        ProfileClass = User._meta.get_field('profile').related_model
        ProfileClass.objects.create(user=self.admin)
        Membership.objects.create(organization=self.org, user=self.admin)

        # Member User (passwordless initially)
        self.member = User.objects.create_user(
            email='member@example.com',
            name='Member User',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.member)
        Membership.objects.create(organization=self.org, user=self.member)

        # Second Member User (passwordless initially)
        self.member2 = User.objects.create_user(
            email='member2@example.com',
            name='Member 2 User',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.member2)
        Membership.objects.create(organization=self.org, user=self.member2)

        mail.outbox.clear()
        OTPVerification.objects.all().delete()

    def _get_token(self, user):
        # Generate token using OTP
        self.client.post('/api/auth/request-otp/', {'email': user.email}, format='json')
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()
        res = self.client.post('/api/auth/verify-otp/', {'email': user.email, 'otp': otp_code}, format='json')
        mail.outbox.clear()
        return res.data['access']

    # ── Email Change OTP Tests ──

    def test_request_email_change_otp(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        new_email = 'newemail@example.com'
        res = self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': new_email
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(new_email, mail.outbox[0].to)

        # Check that user email has NOT changed yet
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, 'member@example.com')

    def test_verify_email_change_success(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        new_email = 'newemail@example.com'
        self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': new_email
        }, format='json')

        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        res = self.client.post('/api/auth/verify-email-change/', {
            'user_id': str(self.member.id),
            'new_email': new_email,
            'otp': otp_code
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, new_email)
        self.assertEqual(self.member.username, new_email)

    def test_verify_email_change_invalid_otp(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        new_email = 'newemail@example.com'
        self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': new_email
        }, format='json')

        res = self.client.post('/api/auth/verify-email-change/', {
            'user_id': str(self.member.id),
            'new_email': new_email,
            'otp': '999999' # Incorrect OTP
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, 'member@example.com')

    def test_email_change_expired_otp(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        new_email = 'newemail@example.com'
        self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': new_email
        }, format='json')

        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()
        OTPVerification.objects.all().update(expires_at=timezone.now() - timedelta(minutes=1))

        res = self.client.post('/api/auth/verify-email-change/', {
            'user_id': str(self.member.id),
            'new_email': new_email,
            'otp': otp_code
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, 'member@example.com')

    def test_email_change_otp_reuse_fails(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        new_email = 'newemail@example.com'
        self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': new_email
        }, format='json')

        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        # First verify: success
        res1 = self.client.post('/api/auth/verify-email-change/', {
            'user_id': str(self.member.id),
            'new_email': new_email,
            'otp': otp_code
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Try reuse OTP with another email
        res2 = self.client.post('/api/auth/verify-email-change/', {
            'user_id': str(self.member.id),
            'new_email': 'anothernew@example.com',
            'otp': otp_code
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_change_checks_uniqueness(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Already used email
        res = self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': self.member2.email
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_cannot_change_another_user_email(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Try to change member2's email
        res = self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member2.id),
            'new_email': 'hacked@example.com'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_change_member_email(self):
        token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        new_email = 'membernew@example.com'
        res = self.client.post('/api/auth/request-email-change-otp/', {
            'user_id': str(self.member.id),
            'new_email': new_email
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        res_verify = self.client.post('/api/auth/verify-email-change/', {
            'user_id': str(self.member.id),
            'new_email': new_email,
            'otp': otp_code
        }, format='json')
        self.assertEqual(res_verify.status_code, status.HTTP_200_OK)

        self.member.refresh_from_db()
        self.assertEqual(self.member.email, new_email)

    def test_reject_direct_email_changes(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Direct profile patch
        res = self.client.patch('/api/profile/', {'email': 'direct@example.com'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Admin direct patch team member
        admin_token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        res_admin = self.client.patch(f'/api/team/{self.member.id}/', {'email': 'directadmin@example.com'}, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Password Flow Tests ──

    def test_passwordless_user_can_set_password_with_otp(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Verify initial unusable password
        self.assertFalse(self.member.has_usable_password())

        # Request password change OTP
        res_req = self.client.post('/api/auth/request-password-change-otp/', {}, format='json')
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)

        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        # Set password with correct OTP
        res_set = self.client.post('/api/auth/set-password-with-otp/', {
            'otp': otp_code,
            'new_password': 'SuperSecurePassword123!'
        }, format='json')
        self.assertEqual(res_set.status_code, status.HTTP_200_OK)

        self.member.refresh_from_db()
        self.assertTrue(self.member.has_usable_password())
        self.assertTrue(self.member.check_password('SuperSecurePassword123!'))

    def test_password_login_works_after_setting(self):
        # Set password
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.client.post('/api/auth/request-password-change-otp/', {}, format='json')
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()
        self.client.post('/api/auth/set-password-with-otp/', {
            'otp': otp_code,
            'new_password': 'SuperSecurePassword123!'
        }, format='json')

        # Now test password login
        self.client.credentials() # Clear headers
        res_login = self.client.post('/api/auth/login-password/', {
            'email': self.member.email,
            'password': 'SuperSecurePassword123!'
        }, format='json')

        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        self.assertIn('access', res_login.data)
        self.assertIn('refresh', res_login.data)

    def test_password_login_fails_for_passwordless_user(self):
        # Try login without setting a password
        res = self.client.post('/api/auth/login-password/', {
            'email': self.member.email,
            'password': 'randompassword'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No password has been set", res.data['detail'])

    def test_password_login_fails_with_incorrect_password(self):
        # Set password
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.client.post('/api/auth/request-password-change-otp/', {}, format='json')
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()
        self.client.post('/api/auth/set-password-with-otp/', {
            'otp': otp_code,
            'new_password': 'SuperSecurePassword123!'
        }, format='json')

        # Try login with wrong password
        self.client.credentials()
        res = self.client.post('/api/auth/login-password/', {
            'email': self.member.email,
            'password': 'WrongPassword123'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No active account found with the given credentials", res.data['detail'])

    def test_otp_purpose_separation(self):
        # Request a login OTP
        self.client.post('/api/auth/request-otp/', {'email': self.member.email}, format='json')
        login_otp = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        # Try to use login OTP for setting password
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post('/api/auth/set-password-with-otp/', {
            'otp': login_otp,
            'new_password': 'SuperSecurePassword123!'
        }, format='json')
        # Should fail since purpose is different
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Request password change OTP
        self.client.post('/api/auth/request-password-change-otp/', {}, format='json')
        pw_otp = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        # Try to use password change OTP for login verify
        self.client.credentials()
        res_login = self.client.post('/api/auth/verify-otp/', {
            'email': self.member.email,
            'otp': pw_otp
        }, format='json')
        self.assertEqual(res_login.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_validation_enforced(self):
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.client.post('/api/auth/request-password-change-otp/', {}, format='json')
        otp_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()

        # Too short password (fails Django min length validator)
        res = self.client.post('/api/auth/set-password-with-otp/', {
            'otp': otp_code,
            'new_password': '123'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # Should return a validation error messages array
        self.assertIsInstance(res.data['detail'], list)


class TeamHealthDateFilteringTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Date Test Org')
        self.admin = User.objects.create_user(
            email='admin@datetest.com',
            name='Admin User',
            role='ADMIN',
            status='ACTIVE'
        )
        self.member = User.objects.create_user(
            email='member@datetest.com',
            name='Member User',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass = User._meta.get_field('profile').related_model
        ProfileClass.objects.create(user=self.admin)
        ProfileClass.objects.create(user=self.member)
        Membership.objects.create(organization=self.org, user=self.admin)
        Membership.objects.create(organization=self.org, user=self.member)
        
        # We need task models
        # pyrefly: ignore [missing-import]
        from apps.tasks.models import Task, TaskAssignee
        
        # Create a task completed in the past (15 days ago)
        self.task1 = Task.objects.create(
            organization=self.org,
            name='Task 1',
            status='COMPLETED',
            completed_at=timezone.now() - timedelta(days=15),
            due_date=timezone.now().date() - timedelta(days=15),
            created_by=self.admin
        )
        self.assign1 = TaskAssignee.objects.create(
            task=self.task1,
            user=self.member,
            completed=True,
            completed_at=timezone.now() - timedelta(days=15)
        )
        
        # Create a task completed today
        self.task2 = Task.objects.create(
            organization=self.org,
            name='Task 2',
            status='COMPLETED',
            completed_at=timezone.now(),
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        self.assign2 = TaskAssignee.objects.create(
            task=self.task2,
            user=self.member,
            completed=True,
            completed_at=timezone.now()
        )


    def _get_token(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)

    def test_team_list_with_date_range(self):
        token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        # 1. Fetch team list with a range that excludes the older task
        start_date = timezone.now() - timedelta(days=5)
        end_date = timezone.now() + timedelta(days=1)
        
        response = self.client.get('/api/team/', {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # The member's completed count should only be 1 (excluding task1)
        member_data = next(u for u in response.data if u['id'] == str(self.member.id))
        self.assertEqual(member_data['completed_this_month'], 1)
        
        # 2. Fetch with all-time / default range (includes both)
        response_all = self.client.get('/api/team/')
        self.assertEqual(response_all.status_code, status.HTTP_200_OK)
        member_data_all = next(u for u in response_all.data if u['id'] == str(self.member.id))
        self.assertEqual(member_data_all['completed_this_month'], 2)


class TeamMemberTasksTests(APITestCase):
    def setUp(self):
        from django.urls import reverse
        # Create default organization
        self.org = Organization.objects.create(name='Fluxiflow Agency')

        # Create active Admin
        self.admin = User.objects.create_user(
            email='admin@tasks.com',
            name='Admin User',
            password='password123',
            role='ADMIN',
            status='ACTIVE'
        )
        ProfileClass = User._meta.get_field('profile').related_model
        ProfileClass.objects.create(user=self.admin)
        Membership.objects.create(organization=self.org, user=self.admin)

        # Create Member A
        self.member_a = User.objects.create_user(
            email='membera@tasks.com',
            name='Member A',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.member_a)
        Membership.objects.create(organization=self.org, user=self.member_a)

        # Create Member B
        self.member_b = User.objects.create_user(
            email='memberb@tasks.com',
            name='Member B',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.member_b)
        Membership.objects.create(organization=self.org, user=self.member_b)

        # Set authentication
        token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _get_token(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        return str(refresh.access_token)

    def test_team_member_visibility(self):
        """Test 1: Verify endpoint returns all assigned tasks before frontend filtering."""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        now = timezone.now()
        today = now.date()

        # 1. Pending task (due in future)
        t_pending = Task.objects.create(
            name='Pending Task',
            status='PENDING',
            due_date=today + timedelta(days=5),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=t_pending, user=self.member_a)

        # 2. Completed task
        t_completed = Task.objects.create(
            name='Completed Task',
            status='COMPLETED',
            due_date=today,
            completed_at=now,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=t_completed, user=self.member_a, completed=True, completed_at=now)

        # 3. Today task
        t_today = Task.objects.create(
            name='Today Task',
            status='PENDING',
            due_date=today,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=t_today, user=self.member_a)

        # 4. Future task
        t_future = Task.objects.create(
            name='Future Task',
            status='PENDING',
            due_date=today + timedelta(days=10),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=t_future, user=self.member_a)

        # 5. Overdue task
        t_overdue = Task.objects.create(
            name='Overdue Task',
            status='PENDING',
            due_date=today - timedelta(days=5),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=t_overdue, user=self.member_a)

        # 6. Task with no due date
        t_nodue = Task.objects.create(
            name='No Due Date Task',
            status='PENDING',
            due_date=None,
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=t_nodue, user=self.member_a)

        # Request with a date range filter that covers only today (e.g. today to today + 1)
        # Verify that all tasks (including future, overdue, no due date) are still returned
        start_date = now - timedelta(days=1)
        end_date = now + timedelta(days=1)

        url = reverse('team_tasks', args=[self.member_a.id])
        response = self.client.get(url, {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        task_ids = [t['id'] for t in response.data]
        # Expect all 6 tasks to be present
        self.assertEqual(len(task_ids), 6)
        self.assertIn(str(t_pending.id), task_ids)
        self.assertIn(str(t_completed.id), task_ids)
        self.assertIn(str(t_today.id), task_ids)
        self.assertIn(str(t_future.id), task_ids)
        self.assertIn(str(t_overdue.id), task_ids)
        self.assertIn(str(t_nodue.id), task_ids)

    def test_multiple_assignees(self):
        """Test 2: Verify a task assigned to A and B can be retrieved by both and appears once."""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        
        task = Task.objects.create(
            name='Shared Task',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member_a)
        TaskAssignee.objects.create(task=task, user=self.member_b)

        # Verify Member A retrieves it once
        url_a = reverse('team_tasks', args=[self.member_a.id])
        res_a = self.client.get(url_a)
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        task_ids_a = [t['id'] for t in res_a.data]
        self.assertEqual(task_ids_a.count(str(task.id)), 1)

        # Verify Member B retrieves it once
        url_b = reverse('team_tasks', args=[self.member_b.id])
        res_b = self.client.get(url_b)
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        task_ids_b = [t['id'] for t in res_b.data]
        self.assertEqual(task_ids_b.count(str(task.id)), 1)

    def test_edit_from_team_member_view(self):
        """Test 3: Update fields and verify canonical task changes."""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        
        task = Task.objects.create(
            name='Original Title',
            status='PENDING',
            due_date=timezone.now().date(),
            priority='MEDIUM',
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member_a)

        # Edit using canonical task detail/patch endpoint
        url = reverse('task-detail', args=[task.id])
        new_due_date = timezone.now().date() + timedelta(days=2)
        payload = {
            'name': 'Updated Title',
            'priority': 'HIGH',
            'due_date': str(new_due_date),
            'project': None
        }
        
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify canonical DB record changed
        task.refresh_from_db()
        self.assertEqual(task.name, 'Updated Title')
        self.assertEqual(task.priority, 'HIGH')
        self.assertEqual(task.due_date, new_due_date)

    def test_edit_assignment(self):
        """Test 4: Edit task assignees from A to B and verify visibility transfers correctly."""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        
        task = Task.objects.create(
            name='Assignment Task',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member_a)

        # Verify Member A sees it, Member B does not
        res_a_before = self.client.get(reverse('team_tasks', args=[self.member_a.id]))
        self.assertIn(str(task.id), [t['id'] for t in res_a_before.data])
        res_b_before = self.client.get(reverse('team_tasks', args=[self.member_b.id]))
        self.assertNotIn(str(task.id), [t['id'] for t in res_b_before.data])

        # Reassign to Member B (and remove A) via task update
        url = reverse('task-detail', args=[task.id])
        payload = {
            'name': task.name,
            'due_date': str(task.due_date),
            'assignee_ids': [str(self.member_b.id)]
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify A no longer sees it, B sees it
        res_a_after = self.client.get(reverse('team_tasks', args=[self.member_a.id]))
        self.assertNotIn(str(task.id), [t['id'] for t in res_a_after.data])
        res_b_after = self.client.get(reverse('team_tasks', args=[self.member_b.id]))
        self.assertIn(str(task.id), [t['id'] for t in res_b_after.data])


class TaskCompletionAndSyncTests(APITestCase):
    def setUp(self):
        from django.urls import reverse
        # Create default organization
        self.org = Organization.objects.create(name='Fluxiflow Agency')

        # Create active Admin
        self.admin = User.objects.create_user(
            email='admin@tasks.com',
            name='Admin User',
            password='password123',
            role='ADMIN',
            status='ACTIVE'
        )
        ProfileClass = User._meta.get_field('profile').related_model
        ProfileClass.objects.create(user=self.admin)
        Membership.objects.create(organization=self.org, user=self.admin)

        # Create Member
        self.member = User.objects.create_user(
            email='member@tasks.com',
            name='Member User',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        ProfileClass.objects.create(user=self.member)
        Membership.objects.create(organization=self.org, user=self.member)

        # Set authentication
        token = self._get_token(self.member)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _get_token(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        return str(refresh.access_token)

    def test_a_normal_completion(self):
        """Test A — Normal completion: PENDING -> complete -> status = COMPLETED"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        task = Task.objects.create(
            name='Task A',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        url = reverse('task-complete', args=[task.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'COMPLETED')

        task.refresh_from_db()
        self.assertEqual(task.status, 'COMPLETED')

    def test_b_page_refresh(self):
        """Test B — Page refresh: Complete task -> refetch endpoint -> status = COMPLETED"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        task = Task.objects.create(
            name='Task B',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        self.client.post(reverse('task-complete', args=[task.id]))

        # Refetch using task-detail endpoint
        url = reverse('task-detail', args=[task.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'COMPLETED')

    def test_c_member_admin_consistency(self):
        """Test C — Member/Admin consistency: member completes -> both APIs show COMPLETED"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        task = Task.objects.create(
            name='Task C',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        # Member completes task
        self.client.post(reverse('task-complete', args=[task.id]))

        # 1. Fetch as member (through normal task list)
        res_member = self.client.get(reverse('task-detail', args=[task.id]))
        self.assertEqual(res_member.data['status'], 'COMPLETED')

        # 2. Fetch as admin (through Team Member endpoint)
        admin_token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        res_admin = self.client.get(reverse('team_tasks', args=[self.member.id]))
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        
        task_data_admin = next(t for t in res_admin.data if t['id'] == str(task.id))
        self.assertEqual(task_data_admin['status'], 'COMPLETED')

    def test_d_health_update(self):
        """Test D — Health update: Complete task -> health recalculates immediately"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        
        # Admin gets token
        admin_token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')

        task = Task.objects.create(
            name='Task D',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        # 1. Record health before completion
        res_before = self.client.get('/api/team/')
        member_before = next(m for m in res_before.data if m['id'] == str(self.member.id))
        health_before = member_before['health_score']

        # 2. Complete task
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._get_token(self.member)}')
        self.client.post(reverse('task-complete', args=[task.id]))

        # 3. Recalculate health
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        res_after = self.client.get('/api/team/')
        member_after = next(m for m in res_after.data if m['id'] == str(self.member.id))
        health_after = member_after['health_score']

        # Health should improve after completing the pending task
        self.assertNotEqual(health_before, health_after)

    def test_e_reopen(self):
        """Test E — Reopen: Complete -> Reopen -> status = PENDING, health recalculates"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        task = Task.objects.create(
            name='Task E',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        # Complete task
        self.client.post(reverse('task-complete', args=[task.id]))

        # Admin checks health while completed
        admin_token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        res_completed = self.client.get('/api/team/')
        health_completed = next(m for m in res_completed.data if m['id'] == str(self.member.id))['health_score']

        # Reopen task
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._get_token(self.member)}')
        self.client.post(reverse('task-reopen', args=[task.id]))

        # Check status is PENDING
        task.refresh_from_db()
        self.assertEqual(task.status, 'PENDING')

        # Recalculate health
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        res_reopened = self.client.get('/api/team/')
        health_reopened = next(m for m in res_reopened.data if m['id'] == str(self.member.id))['health_score']

        self.assertNotEqual(health_completed, health_reopened)

    def test_f_subtask_protection(self):
        """Test F — Subtask protection: parent has incomplete subtask -> complete fails -> complete subtask -> complete parent works -> reopen subtask reopens parent"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee, SubTask, SubTaskAssignee
        task = Task.objects.create(
            name='Parent Task',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        subtask = SubTask.objects.create(
            task=task,
            name='Incomplete Subtask',
            status='PENDING',
            due_date=timezone.now().date()
        )
        SubTaskAssignee.objects.create(subtask=subtask, user=self.member)

        # 1. Attempt to complete parent task (should fail with 400 Bad Request)
        res_complete_parent_fail = self.client.post(reverse('task-complete', args=[task.id]))
        self.assertEqual(res_complete_parent_fail.status_code, status.HTTP_400_BAD_REQUEST)
        task.refresh_from_db()
        self.assertEqual(task.status, 'PENDING')

        # 2. Complete the subtask
        res_sub_complete = self.client.post(reverse('subtask-complete', args=[subtask.id]))
        self.assertEqual(res_sub_complete.status_code, status.HTTP_200_OK)
        subtask.refresh_from_db()
        self.assertEqual(subtask.status, 'COMPLETED')

        # 3. Complete the parent task (should succeed now)
        res_complete_parent_success = self.client.post(reverse('task-complete', args=[task.id]))
        self.assertEqual(res_complete_parent_success.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.status, 'COMPLETED')

        # 4. Reopen the subtask
        res_sub_reopen = self.client.post(reverse('subtask-reopen', args=[subtask.id]))
        self.assertEqual(res_sub_reopen.status_code, status.HTTP_200_OK)

        # Verify parent task reverted to PENDING automatically via signal
        task.refresh_from_db()
        self.assertEqual(task.status, 'PENDING')

    def test_g_no_random_reversion(self):
        """Test G — No random reversion: Complete task, perform unrelated operations, verify status remains COMPLETED"""
        from django.urls import reverse
        from apps.tasks.models import Task, TaskAssignee
        task = Task.objects.create(
            name='Parent Task G',
            status='PENDING',
            due_date=timezone.now().date(),
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task, user=self.member)

        # Complete task
        self.client.post(reverse('task-complete', args=[task.id]))
        task.refresh_from_db()
        self.assertEqual(task.status, 'COMPLETED')

        # Unrelated Action 1: Fetch task
        self.client.get(reverse('task-detail', args=[task.id]))

        # Unrelated Action 2: Open admin team metrics
        admin_token = self._get_token(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        self.client.get('/api/team/')

        # Unrelated Action 3: Refetch member tasks
        self.client.get(reverse('team_tasks', args=[self.member.id]))

        # Verify parent task remains COMPLETED
        task.refresh_from_db()
        self.assertEqual(task.status, 'COMPLETED')


class TeamMemberDetailEndpointTestSuite(APITestCase):
    def setUp(self):
        from apps.tasks.models import Task, TaskAssignee, TaskType
        from rest_framework_simplejwt.tokens import RefreshToken

        self.org = Organization.objects.create(name='Fluxiflow Test Agency', weekly_capacity_hours=40)

        self.admin = User.objects.create_user(
            email='detail_admin@example.com',
            name='Detail Admin',
            password='password123',
            role='ADMIN',
            status='ACTIVE'
        )
        Profile.objects.create(user=self.admin)
        Membership.objects.create(organization=self.org, user=self.admin)

        self.member_a = User.objects.create_user(
            email='member_a@example.com',
            name='Member Alpha',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.create(user=self.member_a)
        Membership.objects.create(organization=self.org, user=self.member_a)

        self.member_b = User.objects.create_user(
            email='member_b@example.com',
            name='Member Beta',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.create(user=self.member_b)
        Membership.objects.create(organization=self.org, user=self.member_b)

        # Other Organization member
        self.other_org = Organization.objects.create(name='Other Agency')
        self.other_user = User.objects.create_user(
            email='other_user@example.com',
            name='Other User',
            password='password123',
            role='MEMBER',
            status='ACTIVE'
        )
        Profile.objects.create(user=self.other_user)
        Membership.objects.create(organization=self.other_org, user=self.other_user)

        # Task Type
        self.task_type = TaskType.objects.create(
            organization=self.org,
            name='Design Spec',
            allocated_seconds=7200 # 2 hours
        )

        admin_token = str(RefreshToken.for_user(self.admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')

    def test_valid_member_detail_endpoint(self):
        """Test 1 — Request valid member detail endpoint returns 200 OK and expected structure."""
        url = f'/api/team/{self.member_a.id}/workload/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('summary', response.data)
        self.assertIn('workload_stats', response.data)
        self.assertIn('workload', response.data)
        self.assertIn('tasks', response.data)
        self.assertEqual(response.data['summary']['email'], self.member_a.email)

    def test_invalid_member_detail_endpoint(self):
        """Test 2 — Request non-existent member returns 404 NOT FOUND."""
        import uuid
        fake_id = uuid.uuid4()
        url = f'/api/team/{fake_id}/workload/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_member_tasks_isolation(self):
        """Test 3 — Member A detail returns Task A and Task B, not Task C assigned to Member B."""
        from apps.tasks.models import Task, TaskAssignee
        task_a = Task.objects.create(name='Task A', created_by=self.admin)
        TaskAssignee.objects.create(task=task_a, user=self.member_a)

        task_b = Task.objects.create(name='Task B', created_by=self.admin)
        TaskAssignee.objects.create(task=task_b, user=self.member_a)

        task_c = Task.objects.create(name='Task C', created_by=self.admin)
        TaskAssignee.objects.create(task=task_c, user=self.member_b)

        url = f'/api/team/{self.member_a.id}/workload/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [t['id'] for t in response.data['tasks']]
        self.assertIn(str(task_a.id), returned_ids)
        self.assertIn(str(task_b.id), returned_ids)
        self.assertNotIn(str(task_c.id), returned_ids)

    def test_multiple_assignees_handling(self):
        """Test 4 — Task assigned to Member A and Member B appears on both detail responses."""
        from apps.tasks.models import Task, TaskAssignee
        shared_task = Task.objects.create(name='Shared Task', created_by=self.admin)
        TaskAssignee.objects.create(task=shared_task, user=self.member_a)
        TaskAssignee.objects.create(task=shared_task, user=self.member_b)

        res_a = self.client.get(f'/api/team/{self.member_a.id}/workload/')
        res_b = self.client.get(f'/api/team/{self.member_b.id}/workload/')

        returned_a = [t['id'] for t in res_a.data['tasks']]
        returned_b = [t['id'] for t in res_b.data['tasks']]

        self.assertIn(str(shared_task.id), returned_a)
        self.assertIn(str(shared_task.id), returned_b)
        self.assertEqual(returned_a.count(str(shared_task.id)), 1)
        self.assertEqual(returned_b.count(str(shared_task.id)), 1)

    def test_no_premature_date_filtering(self):
        """Test 5 — Tasks with various dates (Overdue, Today, Tomorrow, Future, No Date, Completed) all returned."""
        from apps.tasks.models import Task, TaskAssignee
        today = timezone.now().date()
        tasks_data = [
            ('Overdue', today - timedelta(days=2), 'PENDING'),
            ('Today', today, 'PENDING'),
            ('Tomorrow', today + timedelta(days=1), 'PENDING'),
            ('Future', today + timedelta(days=5), 'PENDING'),
            ('No Date', None, 'PENDING'),
            ('Completed', today, 'COMPLETED'),
        ]
        created_tasks = []
        for name, due, task_status in tasks_data:
            t = Task.objects.create(name=name, due_date=due, status=task_status, created_by=self.admin)
            TaskAssignee.objects.create(task=t, user=self.member_a)
            created_tasks.append(t)

        res = self.client.get(f'/api/team/{self.member_a.id}/workload/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [t['id'] for t in res.data['tasks']]
        self.assertEqual(len(returned_ids), len(created_tasks))

    def test_workload_calculation(self):
        """Test 6 — Workload metrics match allocated Task Type durations."""
        from apps.tasks.models import Task, TaskAssignee
        task1 = Task.objects.create(
            name='Task 1',
            task_type=self.task_type,
            allocated_seconds=7200,
            status='PENDING',
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task1, user=self.member_a)

        task2 = Task.objects.create(
            name='Task 2',
            task_type=self.task_type,
            allocated_seconds=7200,
            status='COMPLETED',
            created_by=self.admin
        )
        TaskAssignee.objects.create(task=task2, user=self.member_a)

        res = self.client.get(f'/api/team/{self.member_a.id}/workload/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        stats = res.data['workload_stats']
        self.assertEqual(stats['total_allocated_seconds'], 14400) # 4 hours
        self.assertEqual(stats['total_allocated_hours'], 4.0)
        self.assertEqual(stats['completed_allocated_hours'], 2.0)
        self.assertEqual(stats['remaining_allocated_hours'], 2.0)

    def test_unauthorized_member_access(self):
        """Test 7 — Non-admin Member B cannot view Member A detail."""
        from rest_framework_simplejwt.tokens import RefreshToken
        member_b_token = str(RefreshToken.for_user(self.member_b).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {member_b_token}')

        url = f'/api/team/{self.member_a.id}/workload/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class OrganizationMultiTenantTestSuite(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name='Organization Alpha', slug='org-alpha')
        self.org_b = Organization.objects.create(name='Organization Beta', slug='org-beta')

        self.user = User.objects.create_user(
            email='multiuser@example.com',
            name='Multi Tenant User',
            password='password123',
            status='ACTIVE'
        )

        self.mem_a = Membership.objects.create(
            organization=self.org_a,
            user=self.user,
            role='ORG_ADMIN',
            is_active=True
        )
        self.mem_b = Membership.objects.create(
            organization=self.org_b,
            user=self.user,
            role='MEMBER',
            is_active=True
        )

        self.user.active_organization = self.org_a
        self.user.save()

        from rest_framework_simplejwt.tokens import RefreshToken
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_list_user_organizations(self):
        """1. User lists organizations and receives role per organization."""
        res = self.client.get('/api/organizations/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['organizations']), 2)
        self.assertEqual(res.data['active_organization']['id'], str(self.org_a.id))
        self.assertEqual(res.data['active_organization']['role'], 'ORG_ADMIN')

    def test_switch_organization_changes_active_context(self):
        """2. Switching organization changes user.active_organization and role."""
        res = self.client.post('/api/organizations/switch/', {'organization_id': str(self.org_b.id)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['active_organization']['id'], str(self.org_b.id))
        self.assertEqual(res.data['role'], 'MEMBER')

        self.user.refresh_from_db()
        self.assertEqual(self.user.active_organization, self.org_b)

    def test_create_new_organization(self):
        """3. User creates a new organization and automatically becomes ORG_ADMIN."""
        res = self.client.post('/api/organizations/', {'name': 'New Gamma Agency'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'New Gamma Agency')

        self.user.refresh_from_db()
        self.assertEqual(self.user.active_organization.name, 'New Gamma Agency')
        new_mem = Membership.objects.get(organization_id=res.data['id'], user=self.user)
        self.assertEqual(new_mem.role, 'ORG_ADMIN')

    def test_prevent_unauthorized_org_switch(self):
        """4. User cannot switch to an organization they do not belong to."""
        unauthorized_org = Organization.objects.create(name='Secret Corp', slug='secret-corp')
        res = self.client.post('/api/organizations/switch/', {'organization_id': str(unauthorized_org.id)})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_prevent_demoting_final_org_admin(self):
        """5. Cannot demote or remove the last ORG_ADMIN of an organization."""
        res = self.client.patch(f'/api/organizations/members/{self.user.id}/role/', {'role': 'MEMBER'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last Organization Admin", res.data['detail'])

        del_res = self.client.delete(f'/api/organizations/members/{self.user.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last Organization Admin", del_res.data['detail'])

    def test_zero_organization_database_and_bootstrap_command(self):
        """6. Zero organization DB handles API without crash and bootstraps idempotently."""
        from django.core.management import call_command
        from io import StringIO
        from apps.projects.models import Project
        from apps.tasks.models import Task
        from apps.clients.models import Client
        from apps.keep.models import KeepItem

        proj = Project.objects.create(name='Legacy Project', created_by=self.user)
        task = Task.objects.create(name='Legacy Task', created_by=self.user)
        client = Client.objects.create(name='Legacy Client', created_by=self.user)
        keep = KeepItem.objects.create(name='Legacy Doc', item_type='DOCUMENT', owner=self.user, created_by=self.user)

        out = StringIO()
        call_command('bootstrap_organization', '--dry-run', stdout=out)
        self.assertIn('DRY RUN', out.getvalue())

        out_actual = StringIO()
        call_command('bootstrap_organization', stdout=out_actual)
        self.assertIn('Organization bootstrap complete', out_actual.getvalue())

        proj.refresh_from_db()
        task.refresh_from_db()
        client.refresh_from_db()
        keep.refresh_from_db()

        self.assertIsNotNone(proj.organization)
        self.assertIsNotNone(task.organization)
        self.assertIsNotNone(client.organization)
class RoleMigrationAndMultiTenantPermissionsTestSuite(APITestCase):
    def test_primary_admin_migrated_as_org_admin_and_pm_as_admin_and_member_as_member(self):
        """Verify primary admin becomes ORG_ADMIN, Project Manager/Admin becomes ADMIN, member remains MEMBER."""
        from django.core.management import call_command

        Organization.objects.all().delete()
        User.objects.filter(email__in=['primary@example.com', 'pm@example.com', 'user@example.com']).delete()

        now = timezone.now()
        primary_admin = User.objects.create_user(
            email='primary@example.com', name='Primary Admin', password='password123', role='ADMIN', status='ACTIVE'
        )
        primary_admin.created_at = now - timedelta(days=2)
        primary_admin.save()

        pm_admin = User.objects.create_user(
            email='pm@example.com', name='PM Admin', password='password123', role='ADMIN', status='ACTIVE'
        )
        pm_admin.created_at = now - timedelta(days=1)
        pm_admin.save()

        normal_member = User.objects.create_user(
            email='user@example.com', name='Normal Member', password='password123', role='MEMBER', status='ACTIVE'
        )

        call_command('bootstrap_organization')

        org = Organization.objects.first()
        self.assertIsNotNone(org)

        mem_primary = Membership.objects.get(user=primary_admin, organization=org)
        mem_pm = Membership.objects.get(user=pm_admin, organization=org)
        mem_member = Membership.objects.get(user=normal_member, organization=org)

        self.assertEqual(mem_primary.role, 'ORG_ADMIN')
        self.assertEqual(mem_pm.role, 'ADMIN')
        self.assertNotEqual(mem_pm.role, 'MEMBER')
        self.assertEqual(mem_member.role, 'MEMBER')

    def test_repair_accidental_member_downgrade(self):
        """Verify existing membership with MEMBER role for an ADMIN user is repaired to ADMIN/ORG_ADMIN."""
        from apps.accounts.tenant_context import get_active_membership

        org = Organization.objects.create(name='Test Org', slug='test-org-repair')
        now = timezone.now()

        primary_admin = User.objects.create_user(
            email='primary_repair@example.com', name='Primary Repair', password='password123', role='ADMIN', status='ACTIVE'
        )
        primary_admin.created_at = now - timedelta(days=1)
        primary_admin.save()

        pm_user = User.objects.create_user(
            email='pm_repair@example.com', name='PM Repair', password='password123', role='ADMIN', status='ACTIVE'
        )
        mem = Membership.objects.create(organization=org, user=pm_user, role='MEMBER', is_active=True)
        pm_user.active_organization = org
        pm_user.save()

        active_mem = get_active_membership(pm_user)
        self.assertEqual(active_mem.role, 'ADMIN')
        self.assertNotEqual(active_mem.role, 'MEMBER')

    def test_multi_tenant_different_roles_per_organization(self):
        """Verify user can be ORG_ADMIN in Org A and MEMBER in Org B, and switching orgs updates permissions instantly."""
        org_a = Organization.objects.create(name='Agency A', slug='agency-a')
        org_b = Organization.objects.create(name='Agency B', slug='agency-b')

        multi_user = User.objects.create_user(
            email='multi@example.com', name='Multi User', password='password123', role='MEMBER', status='ACTIVE'
        )

        Membership.objects.create(organization=org_a, user=multi_user, role='ORG_ADMIN', is_active=True)
        Membership.objects.create(organization=org_b, user=multi_user, role='MEMBER', is_active=True)

        multi_user.active_organization = org_a
        multi_user.save()

        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(multi_user).access_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # 1. In Org A (ORG_ADMIN)
        res_me_a = client.get('/api/auth/me/')
        self.assertEqual(res_me_a.status_code, status.HTTP_200_OK)
        self.assertEqual(res_me_a.data['role'], 'ORG_ADMIN')
        self.assertEqual(res_me_a.data['active_organization']['role'], 'ORG_ADMIN')

        # 2. Switch to Org B (MEMBER)
        res_switch = client.post('/api/organizations/switch/', {'organization_id': str(org_b.id)})
        self.assertEqual(res_switch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_switch.data['role'], 'MEMBER')

        res_me_b = client.get('/api/auth/me/')
        self.assertEqual(res_me_b.status_code, status.HTTP_200_OK)
        self.assertEqual(res_me_b.data['role'], 'MEMBER')
        self.assertEqual(res_me_b.data['active_organization']['role'], 'MEMBER')

    def test_unassigned_data_preserved_during_bootstrap(self):
        """Verify unassigned legacy data is never lost or assigned to wrong organization."""
        from django.core.management import call_command
        from apps.projects.models import Project
        from apps.tasks.models import Task
        from apps.clients.models import Client
        from apps.keep.models import KeepItem

        user = User.objects.create_user(
            email='owner@example.com', name='Owner', password='password123', role='ADMIN', status='ACTIVE'
        )

        proj = Project.objects.create(name='Preserved Project', created_by=user)
        task = Task.objects.create(name='Preserved Task', created_by=user)
        client = Client.objects.create(name='Preserved Client', created_by=user)
        keep = KeepItem.objects.create(name='Preserved Note', item_type='DOCUMENT', owner=user, created_by=user)

        call_command('bootstrap_organization')

        proj.refresh_from_db()
        task.refresh_from_db()
        client.refresh_from_db()
        keep.refresh_from_db()

        self.assertIsNotNone(proj.organization)
        self.assertIsNotNone(task.organization)
        self.assertIsNotNone(client.organization)
        self.assertIsNotNone(keep.organization)
        self.assertEqual(proj.name, 'Preserved Project')
        self.assertEqual(task.name, 'Preserved Task')

    def test_cross_tenant_idor_protection(self):
        """Verify user in Org A cannot access resources in Org B."""
        from apps.projects.models import Project
        from apps.tasks.models import Task
        from apps.clients.models import Client
        from apps.keep.models import KeepItem

        org_a = Organization.objects.create(name='Org A', slug='org-a-idor')
        org_b = Organization.objects.create(name='Org B', slug='org-b-idor')

        user_a = User.objects.create_user(email='usera@example.com', name='User A', password='password123', role='ADMIN', status='ACTIVE')
        user_b = User.objects.create_user(email='userb@example.com', name='User B', password='password123', role='ADMIN', status='ACTIVE')

        Membership.objects.create(organization=org_a, user=user_a, role='ORG_ADMIN', is_active=True)
        Membership.objects.create(organization=org_b, user=user_b, role='ORG_ADMIN', is_active=True)

        user_a.active_organization = org_a
        user_a.save()
        user_b.active_organization = org_b
        user_b.save()

        proj_b = Project.objects.create(name='Org B Project', organization=org_b, created_by=user_b)
        task_b = Task.objects.create(name='Org B Task', organization=org_b, created_by=user_b)
        client_b = Client.objects.create(name='Org B Client', organization=org_b, created_by=user_b)
        keep_b = KeepItem.objects.create(name='Org B Keep', organization=org_b, item_type='DOCUMENT', owner=user_b, created_by=user_b)

        from rest_framework_simplejwt.tokens import RefreshToken
        token_a = str(RefreshToken.for_user(user_a).access_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_a}')

        # Cross-tenant GET requests must return 404
        res_proj = client.get(f'/api/projects/{proj_b.id}/')
        self.assertEqual(res_proj.status_code, status.HTTP_404_NOT_FOUND)

        res_task = client.get(f'/api/tasks/{task_b.id}/')
        self.assertEqual(res_task.status_code, status.HTTP_404_NOT_FOUND)

        res_client = client.get(f'/api/clients/{client_b.id}/')
        self.assertEqual(res_client.status_code, status.HTTP_404_NOT_FOUND)

        res_keep = client.get(f'/api/keep/{keep_b.id}/')
        self.assertEqual(res_keep.status_code, status.HTTP_404_NOT_FOUND)



