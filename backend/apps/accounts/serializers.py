from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Profile

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['email'] = user.email
        token['name'] = user.name
        token['role'] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        if user is not None:
            data['user'] = {  # type: ignore
                'id': str(user.id),
                'email': getattr(user, 'email', ''),
                'name': getattr(user, 'name', ''),
                'role': getattr(user, 'role', ''),
            }
        return data

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:  # type: ignore
        model = Profile
        fields = ['id', 'avatar', 'timezone']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:  # type: ignore
        model = User
        fields = ['id', 'email', 'name', 'role', 'status', 'profile', 'avatar_url', 'is_active', 'deactivated_at', 'created_at', 'updated_at', 'has_password']
        read_only_fields = ['id', 'role', 'status', 'is_active', 'deactivated_at', 'created_at', 'updated_at']

    def get_has_password(self, obj):
        return obj.has_usable_password()

    def get_avatar_url(self, obj):
        try:
            if obj.profile and obj.profile.avatar:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.profile.avatar.url)
                return obj.profile.avatar.url
        except Profile.DoesNotExist:
            pass
        return None

# Custom Token Refresh Serializer with session verification and rotation mapping
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken
import hashlib
from django.utils import timezone
from .models import Session

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh_token = attrs['refresh']
        token_hash = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()

        try:
            session_obj = Session.objects.get(refresh_token_hash=token_hash)
            if session_obj.revoked_at is not None:
                raise InvalidToken("Session has been revoked.")
            if session_obj.expires_at < timezone.now():
                raise InvalidToken("Session has expired.")
            # Verify user status is not inactive
            if session_obj.user.status == 'INACTIVE':
                raise InvalidToken("User account is inactive.")
        except Session.DoesNotExist:
            raise InvalidToken("Invalid session or token.")

        data = super().validate(attrs)

        # Handle refresh token rotation if generated
        if 'refresh' in data:
            new_refresh = data['refresh']
            new_hash = hashlib.sha256(new_refresh.encode('utf-8')).hexdigest()

            # Revoke previous session
            session_obj.revoked_at = timezone.now()
            session_obj.save()

            # Create new session
            new_refresh_obj = RefreshToken(new_refresh)  # type: ignore
            expires_at = timezone.now() + new_refresh_obj.lifetime  # type: ignore
            Session.objects.create(
                user=session_obj.user,
                refresh_token_hash=new_hash,
                expires_at=expires_at
            )
        return data


from .models import Organization, Membership, Invitation

class OrganizationSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    effective_name = serializers.CharField(read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'display_name', 'effective_name', 'slug', 'logo', 'logo_url', 'description', 'enable_task_types', 'weekly_capacity_hours', 'timezone', 'is_active', 'created_at', 'role']
        read_only_fields = ['id', 'created_at', 'slug', 'effective_name']

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None

    def get_role(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            membership = obj.memberships.filter(user=request.user, is_active=True).first()
            if membership:
                return membership.role
        return None


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'role', 'is_active', 'joined_at', 'created_at']
        read_only_fields = ['id', 'joined_at', 'created_at']



class ProfileUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.name', required=False)
    email = serializers.EmailField(source='user.email', required=False)

    class Meta:  # type: ignore
        model = Profile
        fields = ['id', 'avatar', 'name', 'email', 'timezone']

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user
        
        # Update User fields if provided
        if 'name' in user_data:
            user.name = user_data['name']
        if 'email' in user_data and user_data['email'] != user.email:
            raise serializers.ValidationError({"email": "Email changes require OTP verification."})
            
        user.save()
        
        # Update Profile avatar/timezone if provided
        if 'avatar' in validated_data:
            instance.avatar = validated_data['avatar']
        if 'timezone' in validated_data:
            instance.timezone = validated_data['timezone']
            
        instance.save()
        return instance
