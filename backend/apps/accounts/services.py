import secrets
import hashlib
import logging
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
from .models import OTPVerification

logger = logging.getLogger(__name__)

class OTPService:
    @staticmethod
    def generate_otp(email: str, purpose: str = 'LOGIN') -> str:
        """
        Generates a secure random 6-digit OTP, invalidates previous active OTPs
        for this email/purpose, hashes it, and saves the record in database.
        Returns the raw OTP code so it can be transmitted.
        """
        normalized_email = email.strip().lower()
        
        # Invalidate any existing active OTPs for this email and purpose
        OTPVerification.objects.filter(
            email=normalized_email,
            purpose=purpose,
            verified_at__isnull=True,
            expires_at__gt=timezone.now()
        ).update(expires_at=timezone.now())
        
        # Generate a cryptographically secure 6-digit OTP
        digits = "0123456789"
        otp_code = "".join(secrets.choice(digits) for _ in range(6))
        
        # Store secure hash of OTP
        hashed_otp = hashlib.sha256(otp_code.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(minutes=5)
        
        # Save verification record
        OTPVerification.objects.create(
            email=normalized_email,
            purpose=purpose,
            hashed_otp=hashed_otp,
            expires_at=expires_at,
            attempt_count=0
        )
        
        return otp_code

    @staticmethod
    def verify_otp(email: str, otp_code: str, purpose: str = 'LOGIN') -> tuple[bool, str]:
        """
        Verifies the given OTP code against the active record in the database.
        Checks for expiration, brute force limit, and immediately invalidates
        the OTP upon successful match.
        """
        normalized_email = email.strip().lower()
        
        # Query active, unverified, unexpired OTP records
        otp_record = OTPVerification.objects.filter(
            email=normalized_email,
            purpose=purpose,
            verified_at__isnull=True,
            expires_at__gt=timezone.now()
        ).first()
        
        if not otp_record:
            return False, "No active code found or it has expired."
            
        # Increment attempt counter (brute force protection)
        otp_record.attempt_count += 1
        otp_record.save()
        
        if otp_record.attempt_count > 5:
            # Invalidate record due to brute-forcing
            otp_record.expires_at = timezone.now()
            otp_record.save()
            return False, "Too many failed attempts. Please request a new code."
            
        # Compare OTP hash securely
        input_hash = hashlib.sha256(otp_code.encode('utf-8')).hexdigest()
        
        if secrets.compare_digest(input_hash, otp_record.hashed_otp):
            # Invalidate OTP on successful verification so it cannot be reused
            otp_record.verified_at = timezone.now()
            otp_record.save()
            return True, "Verification successful."
        else:
            if otp_record.attempt_count >= 5:
                # Invalidate record immediately on the 5th attempt failure
                otp_record.expires_at = timezone.now()
                otp_record.save()
                return False, "Too many failed attempts. Please request a new code."
                
            return False, "That code is incorrect. Please try again."

    @staticmethod
    def send_otp_email(user_name: str, email: str, otp_code: str) -> None:
        """
        Sends the OTP verification code to the user's email address.
        Outputs to the console in debug mode.
        """
        subject = "Your Fluxiflow verification code"
        message_body = (
            f"Hi {user_name},\n\n"
            f"Your Fluxiflow verification code is:\n\n"
            f"{otp_code}\n\n"
            f"This code expires in 5 minutes.\n\n"
            f"If you did not request this code, you can safely ignore this email.\n\n"
            f"Fluxiflow for Agency"
        )
        
        try:
            send_mail(
                subject=subject,
                message=message_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )
        except Exception as e:
            logger.error("OTP email delivery failed for %s: %s", email, str(e))

    @staticmethod
    def send_email_change_otp_email(user_name: str, email: str, otp_code: str) -> None:
        """
        Sends the OTP verification code to confirm a user's new email address.
        """
        subject = "Confirm your new email - Fluxiflow"
        message_body = (
            f"Hi {user_name},\n\n"
            f"Please use the verification code below to verify your new email address:\n\n"
            f"{otp_code}\n\n"
            f"This code expires in 5 minutes.\n\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"Fluxiflow for Agency"
        )
        try:
            send_mail(
                subject=subject,
                message=message_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )
        except Exception as e:
            logger.error("Email change OTP delivery failed for %s: %s", email, str(e))

    @staticmethod
    def send_password_change_otp_email(user_name: str, email: str, otp_code: str) -> None:
        """
        Sends the OTP verification code to confirm a password creation/change.
        """
        subject = "Confirm password reset - Fluxiflow"
        message_body = (
            f"Hi {user_name},\n\n"
            f"Please use the verification code below to set or change your password:\n\n"
            f"{otp_code}\n\n"
            f"This code expires in 5 minutes.\n\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"Fluxiflow for Agency"
        )
        try:
            send_mail(
                subject=subject,
                message=message_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )
        except Exception as e:
            logger.error("Password change OTP delivery failed for %s: %s", email, str(e))


class InvitationEmailService:
    """
    Centralised invitation email service for team member onboarding.
    Reuses the existing Django email backend (SMTP via settings).
    Never sends passwords or OTPs — members log in via the OTP flow.
    """

    @staticmethod
    def _build_invitation_html(member_name: str, member_email: str, invited_by_name: str, frontend_url: str) -> str:
        login_url = f"{frontend_url.rstrip('/')}/login"
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to Fluxiflow</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:#000000;padding:32px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">FLUXIFLOW</span><br/>
              <span style="color:#a1a1aa;font-size:12px;letter-spacing:2px;text-transform:uppercase;">for Agency</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">You're invited to Fluxiflow</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#52525b;">Hello <strong>{member_name}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;color:#52525b;line-height:1.6;">
                You have been invited to join <strong>Fluxiflow for Agency</strong> by <strong>{invited_by_name}</strong>.
                Your account has been created and is ready to use.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:8px;margin:24px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your email address</p>
                    <p style="margin:0;font-size:15px;color:#09090b;font-weight:600;">{member_email}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:15px;color:#52525b;font-weight:600;">To access your account:</p>
              <ol style="margin:0 0 28px;padding-left:20px;color:#52525b;font-size:15px;line-height:2;">
                <li>Open Fluxiflow using the button below.</li>
                <li>Enter <strong>{member_email}</strong> as your email address.</li>
                <li>Click <strong>Send Verification Code</strong>.</li>
                <li>Enter the OTP code sent to your inbox.</li>
              </ol>
              <p style="margin:0 0 28px;font-size:13px;color:#71717a;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;padding:12px 16px;">
                No password required. Fluxiflow uses secure one-time codes for sign-in.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#000000;border-radius:8px;">
                    <a href="{login_url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Login to Fluxiflow</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">
                Or copy this link: <a href="{login_url}" style="color:#52525b;">{login_url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Fluxiflow for Agency &mdash; If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    @staticmethod
    def _build_resend_html(member_name: str, member_email: str, invited_by_name: str, frontend_url: str) -> str:
        login_url = f"{frontend_url.rstrip('/')}/login"
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reminder: Your Fluxiflow Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:#000000;padding:32px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">FLUXIFLOW</span><br/>
              <span style="color:#a1a1aa;font-size:12px;letter-spacing:2px;text-transform:uppercase;">for Agency</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">Reminder: Your Invitation</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#52525b;">Hello <strong>{member_name}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
                This is a reminder that <strong>{invited_by_name}</strong> has invited you to join <strong>Fluxiflow for Agency</strong>.
                Your account is ready — just sign in using the button below.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your email address</p>
                    <p style="margin:0;font-size:15px;color:#09090b;font-weight:600;">{member_email}</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#000000;border-radius:8px;">
                    <a href="{login_url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Login to Fluxiflow</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#71717a;">No password required — sign in with your email and a one-time verification code.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">Fluxiflow for Agency &mdash; If you were not expecting this, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    @staticmethod
    def send_invitation_email(
        member_name: str,
        member_email: str,
        invited_by_name: str,
        frontend_url: str,
    ) -> tuple[bool, str | None]:
        """
        Sends a branded invitation email to a new team member.
        Returns (True, None) on success, (False, error_message) on failure.
        Does NOT include any password or OTP in the email.
        """
        subject = "You're invited to Fluxiflow for Agency"
        plain_body = (
            f"Hello {member_name},\n\n"
            f"You have been invited to join Fluxiflow for Agency by {invited_by_name}.\n\n"
            f"Your account has been created.\n\n"
            f"Email: {member_email}\n\n"
            f"To access your account:\n"
            f"1. Open Fluxiflow: {frontend_url.rstrip('/')}/login\n"
            f"2. Enter this email address.\n"
            f"3. Request a verification code.\n"
            f"4. Enter the OTP sent to your email.\n\n"
            f"Sign in using your email and a one-time verification code — no credentials needed.\n\n"
            f"Regards,\nFluxiflow for Agency"
        )
        html_body = InvitationEmailService._build_invitation_html(
            member_name, member_email, invited_by_name, frontend_url
        )
        try:
            from django.core.mail import EmailMultiAlternatives
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[member_email],
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
            return True, None
        except Exception as e:
            error = str(e)
            logger.error("Invitation email delivery failed for %s: %s", member_email, error)
            return False, error

    @staticmethod
    def send_resend_invitation_email(
        member_name: str,
        member_email: str,
        invited_by_name: str,
        frontend_url: str,
    ) -> tuple[bool, str | None]:
        """
        Sends a branded invitation reminder email to an existing INVITED member.
        Returns (True, None) on success, (False, error_message) on failure.
        """
        subject = "Reminder: Your invitation to Fluxiflow for Agency"
        plain_body = (
            f"Hello {member_name},\n\n"
            f"This is a reminder that {invited_by_name} has invited you to join Fluxiflow for Agency.\n\n"
            f"Email: {member_email}\n\n"
            f"Sign in at: {frontend_url.rstrip('/')}/login\n\n"
            f"No password required — use your email and a one-time verification code.\n\n"
            f"Regards,\nFluxiflow for Agency"
        )
        html_body = InvitationEmailService._build_resend_html(
            member_name, member_email, invited_by_name, frontend_url
        )
        try:
            from django.core.mail import EmailMultiAlternatives
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[member_email],
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
            return True, None
        except Exception as e:
            error = str(e)
            logger.error("Resend invitation email delivery failed for %s: %s", member_email, error)
            return False, error

