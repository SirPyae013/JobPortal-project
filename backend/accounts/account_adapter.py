import logging
from smtplib import SMTPException

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings

from .email_delivery import EmailDeliveryUnavailable

logger = logging.getLogger(__name__)


class AccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url(self, request, emailconfirmation):
        return f"{settings.FRONTEND_URL.rstrip('/')}/verify-email/{emailconfirmation.key}"

    def send_mail(self, template_prefix, email, context):
        context = {**context, "verification_expiry_days": settings.ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS}
        try:
            return super().send_mail(template_prefix, email, context)
        except (SMTPException, OSError) as error:
            # Provider errors can contain recipients or credentials; log only their type.
            logger.warning("Account email delivery failed (%s).", type(error).__name__)
            raise EmailDeliveryUnavailable() from error
