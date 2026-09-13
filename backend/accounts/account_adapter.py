import logging
from smtplib import SMTPException

from allauth.account.adapter import DefaultAccountAdapter

from .email_delivery import EmailDeliveryUnavailable

logger = logging.getLogger(__name__)


class AccountAdapter(DefaultAccountAdapter):
    def send_confirmation_mail(self, request, emailconfirmation, signup):
        from .verification import send_verification_code
        send_verification_code(request, emailconfirmation.email_address)

    def send_mail(self, template_prefix, email, context):
        try:
            return super().send_mail(template_prefix, email, context)
        except (SMTPException, OSError) as error:
            # Provider errors can contain recipients or credentials; log only their type.
            logger.warning("Account email delivery failed (%s).", type(error).__name__)
            raise EmailDeliveryUnavailable() from error
