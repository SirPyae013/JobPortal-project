from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Application


@receiver(post_delete, sender=Application)
def delete_application_resume(sender, instance, **kwargs):
    if instance.resume:
        instance.resume.delete(save=False)
