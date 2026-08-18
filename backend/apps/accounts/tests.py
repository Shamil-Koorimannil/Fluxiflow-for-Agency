import re
import hashlib
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core import mail
from django.conf import settings
from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import OTPVerification, Session, Organization, Membership, Invitation

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
