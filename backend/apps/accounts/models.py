import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = models.Manager()

    def __str__(self):
        return self.name

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        extra_fields.setdefault('role', 'MEMBER')
        extra_fields.setdefault('status', 'INVITED')
        # Use email as username since username is not utilized
        username = email
        user = self.model(email=email, username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('status', 'ACTIVE')
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin/Manager'),
        ('MEMBER', 'Member'),
    )
    STATUS_CHOICES = (
        ('INVITED', 'Invited'),
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)  # type: ignore
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='MEMBER')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INVITED')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)

    objects = CustomUserManager()  # type: ignore

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def __str__(self):
        return f"{self.name} ({self.email} - {self.role} - {self.status})"

class Membership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='memberships')
    created_at = models.DateTimeField(auto_now_add=True)

    objects = models.Manager()

    class Meta:
        unique_together = ('organization', 'user')

    def __str__(self):
        return f"{self.user.email} in {self.organization.name}"

class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
    objects = models.Manager()
    
    def __str__(self):
        return f"Profile of {self.user.name}"

class Invitation(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('EXPIRED', 'Expired'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=CustomUser.ROLE_CHOICES, default='MEMBER')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    invited_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_invitations')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    objects = models.Manager()

    class Meta:
        unique_together = ('organization', 'email')

    def __str__(self):
        return f"Invite for {self.email} to {self.organization.name} ({self.status})"

class OTPVerification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    purpose = models.CharField(max_length=50, default='LOGIN')
    hashed_otp = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    attempt_count = models.IntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = models.Manager()

    def __str__(self):
        return f"OTP for {self.email} ({self.purpose})"

class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sessions')
    refresh_token_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(auto_now=True)

    objects = models.Manager()

    def __str__(self):
        status_str = "Revoked" if self.revoked_at else "Active"
        return f"Session for {self.user.email} ({status_str})"