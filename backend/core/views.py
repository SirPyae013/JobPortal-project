import mimetypes
from pathlib import Path

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.db import connection
from django.http import FileResponse, Http404
from django.utils._os import safe_join
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator


class HealthView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name="HealthResponse",
            fields={"status": serializers.CharField(), "service": serializers.CharField()},
        )
    )
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"status": "ok", "service": "Job Portal API"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name="CsrfResponse",
            fields={"detail": serializers.CharField()},
        )
    )
    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


def public_image(request, path):
    """Serve local public imagery without exposing private resume folders."""
    if not any(path.startswith(f"{prefix}/") for prefix in ("student-photos", "company-logos")):
        raise Http404
    try:
        filename = safe_join(settings.MEDIA_ROOT, path)
    except SuspiciousFileOperation as exc:
        raise Http404 from exc
    if not Path(filename).is_file():
        raise Http404
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(open(filename, "rb"), content_type=content_type)
