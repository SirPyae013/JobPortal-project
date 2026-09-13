import uuid
from pathlib import Path

from django.core.exceptions import ValidationError


PDF_LIMIT = 5 * 1024 * 1024
IMAGE_LIMIT = 2 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def validate_pdf(upload):
    if upload.size > PDF_LIMIT:
        raise ValidationError("Resume files must be 5 MB or smaller.")
    if Path(upload.name).suffix.lower() != ".pdf":
        raise ValidationError("Resume files must be PDF documents.")

    # Browser/OS MIME detection is inconsistent and valid PDFs are sometimes
    # sent as application/octet-stream. Verify the file itself instead.
    position = upload.tell() if hasattr(upload, "tell") else None
    try:
        upload.seek(0)
        signature = upload.read(5)
    finally:
        if position is not None:
            upload.seek(position)
    if signature != b"%PDF-":
        raise ValidationError("Resume files must be PDF documents.")


def validate_image(upload):
    if upload.size > IMAGE_LIMIT:
        raise ValidationError("Images must be 2 MB or smaller.")
    if getattr(upload, "content_type", "") not in IMAGE_TYPES:
        raise ValidationError("Images must be JPEG, PNG, or WebP.")


def randomized_upload_path(prefix, filename):
    return f"{prefix}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"
