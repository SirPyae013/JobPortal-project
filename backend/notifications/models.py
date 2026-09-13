import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=50)
    title = models.CharField(max_length=160)
    message = models.TextField()
    job = models.ForeignKey("jobs.Job", null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    application = models.ForeignKey("applications.Application", null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
