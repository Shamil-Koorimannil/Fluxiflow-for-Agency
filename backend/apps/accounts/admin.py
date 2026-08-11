from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Organization, Membership, Profile, Invitation, OTPVerification, Session

# ── Django Admin site branding ───────────────────────────────────────────────
admin.site.site_header = "Fluxiflow"
admin.site.site_title = "Fluxiflow Admin"
admin.site.index_title = "Fluxiflow Administration"


# ── CustomUser ───────────────────────────────────────────────────────────────
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Admin for the Fluxiflow CustomUser model.
    Inherits from UserAdmin for password-hashing safety.
    Adds Fluxiflow-specific fields (role, status, deactivated_at).
    Sensitive fields (password hash) are handled by UserAdmin — not shown in list.
    """
    list_display = ('email', 'name', 'role', 'status', 'is_staff', 'is_superuser', 'created_at')
    list_filter = ('role', 'status', 'is_staff', 'is_superuser')
    search_fields = ('email', 'name')
    ordering = ('email',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'deactivated_at', 'last_login', 'date_joined')

    # Fieldsets shown when editing a user
    fieldsets = (
        (None, {'fields': ('id', 'email', 'username')}),
        ('Personal Info', {'fields': ('name',)}),
        ('Fluxiflow Role & Status', {'fields': ('role', 'status', 'deactivated_at')}),
        ('Django Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    # Fieldsets shown when adding a new user via Admin
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'role', 'status', 'password1', 'password2'),
        }),
    )


# ── Organization ─────────────────────────────────────────────────────────────
@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'created_at')
    search_fields = ('name',)
    ordering = ('name',)
    readonly_fields = ('id', 'created_at')


# ── Membership ───────────────────────────────────────────────────────────────
@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'created_at')
    list_filter = ('organization',)
    search_fields = ('user__email', 'user__name', 'organization__name')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at')


# ── Profile ──────────────────────────────────────────────────────────────────
@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'id')
    search_fields = ('user__email', 'user__name')
    readonly_fields = ('id',)


# ── Invitation ───────────────────────────────────────────────────────────────
@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'organization', 'role', 'status', 'invited_by', 'created_at', 'expires_at')
    list_filter = ('status', 'role', 'organization')
    search_fields = ('email', 'name', 'invited_by__email')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'accepted_at')


# ── OTPVerification ──────────────────────────────────────────────────────────
@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    """
    OTP records are shown for debugging purposes only.
    hashed_otp is EXCLUDED from list_display — it stores a one-way hash, not
    the raw OTP, but we hide it anyway as a security best practice.
    """
    list_display = ('email', 'purpose', 'attempt_count', 'expires_at', 'verified_at', 'created_at')
    list_filter = ('purpose',)
    search_fields = ('email',)
    ordering = ('-created_at',)
    readonly_fields = ('id', 'email', 'purpose', 'hashed_otp', 'expires_at',
                       'attempt_count', 'verified_at', 'created_at')
    # Make the entire record read-only — OTP records are audit data
    def has_change_permission(self, request, obj=None):
        return False


# ── Session ──────────────────────────────────────────────────────────────────
@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    """
    Fluxiflow session tokens — refresh_token_hash is a one-way hash.
    It is excluded from list_display as a security best practice.
    """
    list_display = ('user', 'created_at', 'expires_at', 'last_used_at', 'is_active')
    list_filter = ('user',)
    search_fields = ('user__email', 'user__name')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'user', 'refresh_token_hash', 'created_at',
                       'expires_at', 'revoked_at', 'last_used_at')

    @admin.display(boolean=True, description='Active')
    def is_active(self, obj):
        return obj.revoked_at is None

    def has_change_permission(self, request, obj=None):
        return False
