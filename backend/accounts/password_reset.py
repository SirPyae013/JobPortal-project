from allauth.account.utils import user_pk_to_url_str
from django.conf import settings
from dj_rest_auth.serializers import PasswordResetSerializer as BasePasswordResetSerializer


def frontend_password_reset_url(request, user, token):
    """Send users to the SPA, using allauth's matching UUID/UID encoding."""
    path = settings.PASSWORD_RESET_CONFIRM_URL.format(
        uid=user_pk_to_url_str(user), token=token
    )
    return f"{settings.FRONTEND_URL.rstrip('/')}/{path.lstrip('/')}"


class PasswordResetSerializer(BasePasswordResetSerializer):
    def get_email_options(self):
        return {"url_generator": frontend_password_reset_url}
