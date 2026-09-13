import secrets
from datetime import timedelta

from allauth.account.adapter import get_adapter
from allauth.account.models import EmailAddress
from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.utils import timezone

from .models import EmailVerificationCode, User

CODE_LIFETIME = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5


@transaction.atomic
def send_verification_code(request, address):
    # Lock the account even when its first challenge has not yet been created.
    User.objects.select_for_update().get(pk=address.user_id)
    address = EmailAddress.objects.select_for_update().get(pk=address.pk)
    if address.verified or not address.user.is_active:
        return
    challenge = EmailVerificationCode.objects.filter(email_address=address).first()
    now = timezone.now()
    if challenge and challenge.sent_at + RESEND_COOLDOWN > now:
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    while challenge and check_password(code, challenge.code_hash):
        code = f"{secrets.randbelow(1_000_000):06d}"
    EmailVerificationCode.objects.update_or_create(email_address=address, defaults={
        "code_hash": make_password(code), "sent_at": now,
        "expires_at": now + CODE_LIFETIME, "attempts": 0,
    })
    # Delivery errors roll back both the new challenge and registration, if any.
    get_adapter(request).send_mail("account/email/verification_code", address.email, {
        "user": address.user, "code": code,
    })


@transaction.atomic
def verify_code(email, code):
    user = User.objects.select_for_update().filter(email__iexact=email, is_active=True).first()
    if not user:
        return False
    address = EmailAddress.objects.select_for_update().filter(user=user, email__iexact=email, verified=False).first()
    if not address:
        return False
    challenge = EmailVerificationCode.objects.select_for_update().filter(email_address=address).first()
    if not challenge or challenge.expires_at <= timezone.now() or challenge.attempts >= MAX_ATTEMPTS:
        return False
    challenge.attempts += 1
    challenge.save(update_fields=["attempts"])
    if not check_password(code, challenge.code_hash):
        return False
    address.verified = True
    address.save(update_fields=["verified"])
    challenge.delete()
    return True
