from django.contrib import admin
from .models import Job


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "job_type", "industry", "compensation_min", "created_at")
    list_filter = ("job_type", "industry")
    search_fields = ("title", "company__name", "skills__name")
