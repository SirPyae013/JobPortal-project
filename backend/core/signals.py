from django.db.models.signals import post_delete
from django.dispatch import receiver

from accounts.models import StudentProfile
from companies.models import Company


@receiver(post_delete, sender=StudentProfile)
def delete_student_files(sender, instance, **kwargs):
    for field in (instance.photo, instance.resume):
        if field:
            field.delete(save=False)


@receiver(post_delete, sender=Company)
def delete_company_logo(sender, instance, **kwargs):
    if instance.logo:
        instance.logo.delete(save=False)
