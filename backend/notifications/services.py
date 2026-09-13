from .models import Notification


def notify(recipient, kind, title, message, job=None, application=None):
    return Notification.objects.create(
        recipient=recipient,
        kind=kind,
        title=title,
        message=message,
        job=job,
        application=application,
    )
