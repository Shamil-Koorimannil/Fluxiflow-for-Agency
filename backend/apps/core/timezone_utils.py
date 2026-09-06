import zoneinfo
import datetime
from django.utils import timezone
from django.conf import settings

def resolve_business_tz(request=None, organization=None, user=None, default_tz='UTC'):
    """
    Determines the canonical business timezone based on priority:
    1. Request 'X-Timezone' header (if valid IANA timezone string)
    2. User profile timezone (user.profile.timezone if set and valid)
    3. Active organization timezone (organization.timezone if set and valid)
    4. Explicit fallback (settings.TIME_ZONE or default_tz)
    """
    tz_str = None

    # 1. Request header priority
    if request:
        header_tz = request.headers.get('X-Timezone') or request.headers.get('x-timezone')
        if header_tz and isinstance(header_tz, str):
            tz_str = header_tz.strip()

    # 2. User profile timezone
    if not tz_str and user and hasattr(user, 'profile'):
        profile_tz = getattr(user.profile, 'timezone', None)
        if profile_tz and isinstance(profile_tz, str) and profile_tz.strip():
            tz_str = profile_tz.strip()

    # 3. Active Organization timezone
    if not tz_str and organization:
        org_tz = getattr(organization, 'timezone', None)
        if org_tz and isinstance(org_tz, str) and org_tz.strip():
            tz_str = org_tz.strip()

    # If user provided but org wasn't, check user's active_organization
    if not tz_str and user and hasattr(user, 'active_organization') and user.active_organization:
        org_tz = getattr(user.active_organization, 'timezone', None)
        if org_tz and isinstance(org_tz, str) and org_tz.strip():
            tz_str = org_tz.strip()

    # Attempt to load zoneinfo
    if tz_str:
        try:
            return zoneinfo.ZoneInfo(tz_str)
        except Exception:
            pass

    # 4. Fallback to settings.TIME_ZONE or default_tz
    fallback = getattr(settings, 'TIME_ZONE', default_tz) or default_tz
    try:
        return zoneinfo.ZoneInfo(fallback)
    except Exception:
        return zoneinfo.ZoneInfo('UTC')

def get_business_now(request=None, organization=None, user=None, tz=None):
    """
    Returns current aware datetime in the effective business timezone.
    """
    if tz is None:
        tz = resolve_business_tz(request=request, organization=organization, user=user)
    return timezone.now().astimezone(tz)

def get_business_today(request=None, organization=None, user=None, tz=None):
    """
    Returns current local date in the effective business timezone.
    """
    return get_business_now(request=request, organization=organization, user=user, tz=tz).date()

def get_business_tomorrow(request=None, organization=None, user=None, tz=None):
    """
    Returns tomorrow's local date in the effective business timezone.
    """
    return get_business_today(request=request, organization=organization, user=user, tz=tz) + datetime.timedelta(days=1)

def get_task_due_datetime_in_tz(due_date, due_time=None, tz=None, request=None, organization=None, user=None):
    """
    Constructs an aware datetime for when a task is due in the given timezone.
    If due_time is None (date-only task), it is due at end of day (23:59:59.999999) in the given business timezone.
    """
    if not due_date:
        return None

    if tz is None:
        tz = resolve_business_tz(request=request, organization=organization, user=user)

    if due_time:
        naive_dt = datetime.datetime.combine(due_date, due_time)
    else:
        naive_dt = datetime.datetime.combine(due_date, datetime.time.max)

    if timezone.is_naive(naive_dt):
        try:
            return timezone.make_aware(naive_dt, tz)
        except Exception:
            return naive_dt.replace(tzinfo=tz)
    return naive_dt.astimezone(tz)
