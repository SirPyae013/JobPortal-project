# Job Portal

Job Portal is a Myanmar-first campus recruitment platform for students, recruiters, and administrators. The React interface is backed by a Django REST API with verified accounts, recruiter/company approval, job applications, a searchable talent directory, and in-app notifications.

## Local setup

**Campus Modern** is the website's only active design. The original components and preview switch have been removed. A standalone archive is retained for recovery; see [design backups and restoration](design-backups/README.md).

Prerequisites: Node.js 20+ and Python 3.13.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm --prefix frontend install
.\.venv\Scripts\python.exe backend\manage.py migrate
```

Run the development servers in separate terminals:

```powershell
.\.venv\Scripts\python.exe backend\manage.py runserver 8000
npm --prefix frontend run dev
```

Open `http://localhost:3000`. Vite proxies `/api`, `/accounts`, and `/media` to Django.

New accounts require email verification. Configure an SMTP sender in the project-root `.env` for inbox delivery; see [email verification and password-reset setup](backend/README.md#email-verification-and-password-reset). The email flow also supports local console previews while provider credentials are being configured.

Create an administrator:

```powershell
.\.venv\Scripts\python.exe backend\manage.py createsuperuser
```

Optional development data requires an explicit password and only works with `DJANGO_DEBUG=true`:

```powershell
.\.venv\Scripts\python.exe backend\manage.py seed_demo_data --password "choose-a-local-password"
```

## Production

For a free demonstration deployment of both the frontend and backend, follow the [project-specific free deployment guide](FREE_DEPLOY_GUIDE.md). It includes the required configuration changes, persistent database and file storage, and email delivery setup.

Copy `.env.example` into your deployment secret configuration. Production requires a strong Django secret, PostgreSQL `DATABASE_URL`, allowed hosts, trusted origins, SMTP credentials, Google OAuth credentials, and S3-compatible private storage credentials.

Build React, collect assets, migrate, and start Django:

```powershell
npm --prefix frontend run build
.\.venv\Scripts\python.exe backend\manage.py collectstatic --noinput
.\.venv\Scripts\python.exe backend\manage.py migrate
gunicorn --chdir backend config.wsgi:application
```

The API is versioned under `/api/v1/`. OpenAPI is available at `/api/schema/` and Swagger UI at `/api/docs/`.

## Verification

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
.\.venv\Scripts\python.exe backend\manage.py test
.\.venv\Scripts\python.exe backend\manage.py check
```
