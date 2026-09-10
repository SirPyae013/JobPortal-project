from django.contrib import admin
from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("student", "job", "status", "submitted_at")
    list_filter = ("status", "job__company")
    search_fields = ("student__email", "student__student_profile__name", "job__title")
