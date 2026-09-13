from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from accounts.models import RecruiterProfile, Skill, StudentProfile, User
from allauth.account.models import EmailAddress
from applications.models import Application
from companies.models import Company
from jobs.models import Job
from notifications.services import notify


class Command(BaseCommand):
    help = "Create development-only Job Portal demonstration records."

    def add_arguments(self, parser):
        parser.add_argument("--password", required=True)

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Demo data is disabled when DJANGO_DEBUG is false.")
        password = options["password"]
        student, _ = User.objects.get_or_create(email="student@example.com", defaults={"role": User.Role.STUDENT})
        student.set_password(password)
        student.save()
        EmailAddress.objects.update_or_create(user=student, email=student.email, defaults={"verified": True, "primary": True})
        profile, _ = StudentProfile.objects.get_or_create(user=student, defaults={"name": "Mya Student", "university": "University of Yangon", "graduation_year": 2027, "bio": "Computer science student seeking practical experience."})
        if not profile.resume:
            profile.resume.save("demo-resume.pdf", ContentFile(b"%PDF-1.4\n% demo resume\n"))
        skills = {
            name: Skill.objects.get_or_create(name=name)[0]
            for name in ["python", "django", "javascript", "figma", "excel"]
        }
        profile.skills.add(skills["python"])

        recruiter_user, _ = User.objects.get_or_create(email="recruiter@example.com", defaults={"role": User.Role.RECRUITER})
        recruiter_user.set_password(password)
        recruiter_user.save()
        EmailAddress.objects.update_or_create(user=recruiter_user, email=recruiter_user.email, defaults={"verified": True, "primary": True})
        recruiter, _ = RecruiterProfile.objects.get_or_create(user=recruiter_user, defaults={"name": "Aung Recruiter", "approval_status": "approved"})
        recruiter.approval_status = "approved"
        recruiter.save()
        company, _ = Company.objects.get_or_create(recruiter=recruiter, defaults={"name": "Yangon Tech", "website": "https://example.com", "description": "Myanmar technology company.", "industry": "Technology", "location": "Yangon", "contact_email": recruiter_user.email, "approval_status": "approved"})
        company.approval_status = "approved"
        company.save()
        demo_jobs = [
            {
                "title": "Backend Intern",
                "job_type": "Internship",
                "industry": "Computer Science",
                "description": "Build reliable Django APIs with our engineering team.",
                "compensation_min": 400000,
                "compensation_max": 600000,
                "skills": ["python", "django"],
            },
            {
                "title": "Frontend Developer",
                "job_type": "Part-Time",
                "industry": "Computer Science",
                "description": "Create accessible React interfaces for students and employers.",
                "compensation_min": 350000,
                "compensation_max": 550000,
                "skills": ["javascript"],
            },
            {
                "title": "Product Design Assistant",
                "job_type": "Part-Time",
                "industry": "Computer Science",
                "description": "Support user research, wireframes, and polished product flows.",
                "compensation_min": 300000,
                "compensation_max": 450000,
                "skills": ["figma"],
            },
            {
                "title": "Operations Analyst",
                "job_type": "Full-Time",
                "industry": "Computer Science",
                "description": "Turn marketplace data into practical recommendations for growth.",
                "compensation_min": 700000,
                "compensation_max": 1000000,
                "skills": ["excel"],
            },
            {
                "title": "Remote QA Engineer",
                "job_type": "Remote",
                "industry": "Computer Science",
                "description": "Help test dependable releases across web and mobile experiences.",
                "compensation_min": 600000,
                "compensation_max": 900000,
                "skills": ["python", "javascript"],
            },
        ]
        for job_data in demo_jobs:
            job_skills = job_data.pop("skills")
            job, _ = Job.objects.get_or_create(
                recruiter=recruiter,
                company=company,
                title=job_data["title"],
                defaults={**job_data, "resume_required": True},
            )
            if job.industry != "Computer Science":
                job.industry = "Computer Science"
                job.save(update_fields=["industry"])
            job.skills.set(skills[name] for name in job_skills)

        job = Job.objects.get(recruiter=recruiter, company=company, title="Backend Intern")
        application, _ = Application.objects.get_or_create(job=job, student=student, defaults={"resume_source": "profile", "status": "submitted"})
        if not application.resume:
            application.resume.save("demo-application-resume.pdf", ContentFile(b"%PDF-1.4\n% demo application resume\n"))
        if not student.notifications.filter(kind="welcome").exists():
            notify(student, "welcome", "Welcome to Job Portal", "Your development profile is ready.")
        self.stdout.write(self.style.SUCCESS("Development demo data created."))
