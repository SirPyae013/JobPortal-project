# Free deployment guide for Campus Job

Prepared for this React/Vite + Django project on 10 September 2026. These are instructions to apply; this guide does not mean the site has already been deployed or the configuration edits below have been made.

## 1. Use one free hosting service for the frontend and backend

Deploy the React build and Django together on **one Render Free web service**. Use **Supabase Free** for PostgreSQL and private uploaded files, and **Brevo Free** for verification/reset emails through its HTTPS API.

| Part | Service | Result |
| --- | --- | --- |
| React frontend | Render, served by Django/WhiteNoise | Website pages and compiled CSS/JavaScript |
| Django backend | The same Render service | API, login, admin and file authorization |
| Database | Supabase Free PostgreSQL | Persistent users, jobs, companies and applications |
| Uploaded files | Supabase Free Storage | Persistent private resumes, photos and logos |
| Email delivery | Brevo Free HTTPS API | Verification and password-reset emails |

Your public address will resemble `https://campusjob-demo.onrender.com`. This is an example: use the exact hostname Render assigns. A purchased domain is not needed for the website. The frontend and API share that address, matching the project's relative `/api/v1` requests and cookie authentication.

The hosting cost can remain $0 within the free allowances. Free services have operational limits:

- Render Free sleeps after 15 idle minutes, and waking it can take about a minute. Its local filesystem is temporary. The workspace gets 750 free instance hours each month. Render's free PostgreSQL expires after 30 days, so this guide uses Supabase instead. Free services also have bandwidth/build allowances; review your dashboard and avoid paid upgrades or billable overages. [Render Free limits](https://render.com/docs/free)
- Supabase Free includes a 500 MB database and 1 GB file storage; inactive projects may pause after a week. Keep independent backups. [Supabase Free plan](https://supabase.com/pricing)
- Brevo Free currently includes 300 email sends per day. [Brevo Free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)

This suits a demonstration or small pilot. It does not provide guaranteed uninterrupted service for a busy recruitment platform.

## 2. Confirm you can create the accounts

Create accounts at [GitHub](https://github.com/), [Render](https://render.com/), [Supabase](https://supabase.com/), and [Brevo](https://www.brevo.com/), choosing their free options.

Because you are in Myanmar, confirm account access and any verification requirements first. I could not confirm from official documentation that every provider accepts new Myanmar accounts. A free plan does not guarantee account approval or that no verification step will appear.

For email, confirm that Brevo accepts your account and sender before relying on public registration. Google App Passwords are not used in this deployment.

If you do not own an email domain, Brevo documents a temporary replacement of free-address senders with its own compliant address. This can support a trial if your account is accepted, but it is not a permanent delivery guarantee. Use an authenticated domain for a lasting sender identity. The free `onrender.com` website address does not give you an email mailbox or control of Render's DNS. [Brevo sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)

## 3. Create the persistent database and file bucket

In Supabase, create a Free project named `campusjob`. Select a region near your users and Render service, such as Singapore if available, and save the database password privately.

Use the project's **Connect** dialog and select **Session pooler**, normally port **5432**. Copy its complete PostgreSQL connection string. Replace its password placeholder, percent-encoding reserved password characters, and add `?sslmode=require` if the URL has no query string. If it already has query parameters, add `&sslmode=require` instead. Copy the actual hostname and username from the dashboard.

The shape is:

```text
postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
```

Session pooling supports this persistent Django service and IPv4 connectivity. Do not substitute the transaction-pooler URL on port 6543 without changing the database configuration. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)

In the Data API integration settings, turn **Enable Data API** off. This project accesses PostgreSQL through Django, and its tables are not configured for direct browser access through Supabase's database REST API. Storage still uses its separate S3 interface. [Supabase Data API controls](https://supabase.com/docs/guides/api/securing-your-api)

In **Storage**, create a bucket called `campusjob-media` with **Public bucket disabled**. Set its upload allowance to at least 5 MiB so it accommodates the app's resume limit.

In the Storage S3 configuration, generate an **S3 access key pair** and copy its **endpoint** and **region**. These are different from Supabase's publishable/anon keys. S3 credentials grant broad storage access and belong only on the backend. [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)

Keep these five values for Render:

```dotenv
AWS_STORAGE_BUCKET_NAME=campusjob-media
AWS_ACCESS_KEY_ID=YOUR_S3_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_S3_SECRET_ACCESS_KEY
AWS_S3_ENDPOINT_URL=YOUR_COMPLETE_DASHBOARD_S3_ENDPOINT
AWS_S3_REGION_NAME=YOUR_DASHBOARD_REGION
```

The endpoint includes `/storage/v1/s3`; copy it exactly. It is not the PostgreSQL hostname. The bucket stays private; the existing Django resume endpoints check user permissions before opening a file.

## 4. Prepare email delivery through HTTPS

Render Free blocks outbound ports 25, 465 and 587, so the current Gmail SMTP configuration cannot be used there. This guide uses Brevo's HTTPS API instead. [Render SMTP restriction](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)

In Brevo:

1. Complete account activation and any transactional-email approval.
2. Add a sender under the sender settings and complete its verification. If you own a domain, authenticate it using the DNS records Brevo supplies.
3. Open **SMTP & API**, then **API Keys**, and create a v3 API key for Campus Job. For this guide use an **API key**, not an SMTP key.
4. Save the key privately and record the exact approved sender address.

The Django integration below uses Anymail's Brevo backend. Check the provider's delivery logs if a message is accepted by the API but does not arrive. [Anymail Brevo integration](https://anymail.dev/en/stable/esps/brevo/)

## 5. Apply the required project changes locally

These are deployment prerequisites found while inspecting your current code. Apply them before pushing the deployment version.

### Python and email dependency

Create `.python-version` in the project root containing:

```text
3.13
```

Render accepts the minor version in this file and selects its latest available patch. [Render Python versions](https://render.com/docs/python-version)

Add this line to `backend/requirements.txt`:

```text
django-anymail[brevo]>=15.2,<16
```

Install the updated requirements from the project root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

In `backend/config/settings.py`, add `"anymail",` inside `INSTALLED_APPS`, and add the following after the email settings:

```python
ANYMAIL = {
    "BREVO_API_KEY": os.getenv("BREVO_API_KEY", ""),
    "REQUESTS_TIMEOUT": 15,
}
SERVER_EMAIL = DEFAULT_FROM_EMAIL
```

Keep the existing environment-based `EMAIL_BACKEND` setting; Render will supply its value. [Anymail installation](https://anymail.dev/en/stable/installation/)

In `backend/accounts/account_adapter.py`, add this import:

```python
from anymail.exceptions import AnymailError
```

Change the existing exception clause in `send_mail` to:

```python
except (SMTPException, OSError, AnymailError) as error:
```

Keep the existing body of that exception handler. This preserves the friendly delivery-error response and registration rollback when the API rejects a message. [Anymail exceptions](https://anymail.dev/en/stable/sending/exceptions/)

### Production settings validation

The current `if not DEBUG:` block requires Gmail-style SMTP credentials and Google OAuth credentials even when unused. Replace the **first** `if not DEBUG:` block near the top of `backend/config/settings.py` with:

```python
if not DEBUG:
    required = [
        "DJANGO_SECRET_KEY", "DATABASE_URL", "DJANGO_ALLOWED_HOSTS",
        "CSRF_TRUSTED_ORIGINS", "FRONTEND_URL", "DEFAULT_FROM_EMAIL",
        "AWS_STORAGE_BUCKET_NAME", "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY", "AWS_S3_ENDPOINT_URL", "AWS_S3_REGION_NAME",
    ]
    deployment_email_backend = os.getenv(
        "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
    )
    if deployment_email_backend == "anymail.backends.brevo.EmailBackend":
        required.append("BREVO_API_KEY")
    elif deployment_email_backend == "django.core.mail.backends.smtp.EmailBackend":
        required.extend(["EMAIL_HOST", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD"])
    else:
        raise ImproperlyConfigured("Configure a real production email backend.")

    google_settings = (
        "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "VITE_GOOGLE_CLIENT_ID"
    )
    if any(os.getenv(name) for name in google_settings):
        required.extend(google_settings)

    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise ImproperlyConfigured(
            f"Missing production settings: {', '.join(missing)}"
        )
    if SECRET_KEY in {DEV_SECRET_KEY, "replace-this-in-production"}:
        raise ImproperlyConfigured("Set a new random DJANGO_SECRET_KEY.")
```

Google sign-in can then remain unconfigured for the initial launch. The frontend already hides its Google button when `VITE_GOOGLE_CLIENT_ID` is absent. Password registration and email verification are separate features.

### Persistent private file storage

The current file enables S3 when a bucket environment variable exists, but does not assign the bucket name to Django's storage setting. Replace the existing `if os.getenv("AWS_STORAGE_BUCKET_NAME"):` storage block in `backend/config/settings.py` with:

```python
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
if AWS_STORAGE_BUCKET_NAME:
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL") or None
    AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME") or None
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_S3_ADDRESSING_STYLE = "path"
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600
    AWS_S3_FILE_OVERWRITE = False
```

Keep `MEDIA_ROOT`, `MEDIA_URL`, the existing WhiteNoise middleware and static-asset directory settings. This configuration uses signed storage URLs for images and keeps persistent uploads outside the Render filesystem. [Django S3 storage settings](https://django-storages.readthedocs.io/en/latest/backends/amazon-S3.html)

### Health endpoint

In `backend/core/views.py`, add these two attributes to `HealthView`, immediately under its existing `permission_classes`:

```python
authentication_classes = []
throttle_classes = []
```

Indent them like `permission_classes`. This stops regular hosting health probes from exhausting the API's anonymous request limit. Keep the existing database check.

### Build script

Create `build.sh` in the project root, saving with **LF** line endings:

```bash
#!/usr/bin/env bash
set -o errexit
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
python backend/manage.py collectstatic --noinput
```

Render's native Python runtime includes Node and npm, so this script can build both parts. The dashboard will invoke `bash build.sh`, so an executable file permission is not required. [Render runtime tools](https://render.com/docs/native-runtimes)

Keep the current Vite production base `/static/`. Django already serves the React HTML and handles direct links to the verification and password-reset pages. This deployment does not run Vite's development server.

## 6. Check the local changes and put the code on GitHub

From `C:\Users\Lenovo\Desktop\V-Projects\campusjob`, run:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
node --test frontend\tests\design.test.mjs
.\.venv\Scripts\python.exe backend\manage.py check
```

For backend tests, explicitly select in-memory email so the tests do not contact an email provider:

```powershell
$previousTestEmailBackend = $env:EMAIL_BACKEND
try {
    $env:EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
    .\.venv\Scripts\python.exe backend\manage.py test accounts.test_email_verification accounts.test_password_reset core --noinput
} finally {
    $env:EMAIL_BACKEND = $previousTestEmailBackend
}
```

If using a shell configured with production database settings, open a normal local development shell for tests. Do not run test commands against your live database credentials.

Create an empty **private** GitHub repository named `campusjob`; do not initialize it with another README.

This workspace currently resolves Git operations to an unrelated repository at `C:\`. Create a repository inside `campusjob` first if it has no `.git` directory. Do not add `C:\` as a Git safe directory or stage files from the drive root.

```powershell
Set-Location 'C:\Users\Lenovo\Desktop\V-Projects\campusjob'
git init -b main
git add .
git diff --cached --name-only
```

Review the staged filenames. `.env`, `.env.production.local`, `.venv`, `node_modules`, logs, `backend/db.sqlite3`, `backend/media`, and built output must be absent. Your `.gitignore` already excludes these. Review any design backup ZIP before publishing it; it is not required to run the deployed site.

Then commit and push, substituting your GitHub username:

```powershell
git commit -m "Prepare Campus Job for deployment"
git remote add origin https://github.com/YOUR_USERNAME/campusjob.git
git push -u origin main
```

If a project-local repository or `origin` already exists by the time you follow the guide, use it rather than reinitializing or replacing its remote.

## 7. Create the Render service and environment

In Render, choose **New > Web Service**, connect your GitHub repository, and use these settings:

| Setting | Value |
| --- | --- |
| Name | A unique name, for example `campusjob-demo` |
| Language/runtime | Python 3 |
| Branch | `main` |
| Root Directory | Leave empty: the repository root |
| Region | Near the Supabase project |
| Instance type | **Free** |
| Build Command | `bash build.sh` |
| Health Check Path | `/api/v1/health/` |

Set **Start Command** to this single line:

```bash
python backend/manage.py migrate --noinput && gunicorn --chdir backend config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60
```

The migration step creates/updates the database schema before serving requests. The single worker also keeps the current in-memory email throttle in one process. Use a shared cache before adding workers. These commands are specific to this repository's layout; Render's generic Django tutorial uses a different project name. [Render Django deployment](https://render.com/docs/deploy-django)

Add these environment variables in Render. Replace every placeholder, and replace the example hostname everywhere with your actual Render hostname:

```dotenv
NODE_VERSION=22
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=GENERATE_A_NEW_RANDOM_SECRET_IN_RENDER
DJANGO_ALLOWED_HOSTS=campusjob-demo.onrender.com
CSRF_TRUSTED_ORIGINS=https://campusjob-demo.onrender.com
CORS_ALLOWED_ORIGINS=https://campusjob-demo.onrender.com
FRONTEND_URL=https://campusjob-demo.onrender.com

DATABASE_URL=YOUR_SUPABASE_SESSION_POOLER_URL_WITH_SSL

AWS_STORAGE_BUCKET_NAME=campusjob-media
AWS_ACCESS_KEY_ID=YOUR_SUPABASE_S3_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_SUPABASE_S3_SECRET_ACCESS_KEY
AWS_S3_ENDPOINT_URL=YOUR_COMPLETE_SUPABASE_S3_ENDPOINT
AWS_S3_REGION_NAME=YOUR_SUPABASE_S3_REGION

EMAIL_BACKEND=anymail.backends.brevo.EmailBackend
BREVO_API_KEY=YOUR_BREVO_V3_API_KEY
DEFAULT_FROM_EMAIL=Job Portal <YOUR_APPROVED_SENDER_ADDRESS>
EMAIL_VERIFICATION_ENABLED=true
```

Use Render's secret generator for `DJANGO_SECRET_KEY`, not the literal placeholder above. Keep it stable on later deployments. Enter values directly in the dashboard without surrounding quotation marks.

Leave `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `VITE_GOOGLE_CLIENT_ID` absent for the initial deployment. Do not supply fake OAuth values. Gmail's `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` are not needed for the Brevo API backend.

`DJANGO_ALLOWED_HOSTS` contains hostnames without `https://`; the three origin settings include `https://`. Keep credentials out of every `VITE_` variable: Vite variables can be included in browser JavaScript.

If the final service hostname is assigned after creation, update these four hostname/origin values immediately and redeploy. Once the environment is complete, create/deploy the service and watch the build log.

## 8. Create the administrator from your computer

Render Free has no interactive service shell, so create the admin using your local Django installation connected to the new database. [Render Free limitations](https://render.com/docs/free)

Create an ignored file named `.env.production.local` in the project root. Put the same production Django, database, storage and email settings from Render in it, using the real values. Keep your normal `.env` for local development.

For the initial launch without Google sign-in, also put these explicit empty values in that local production file. They prevent credentials in the normal local `.env` from being picked up:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
VITE_GOOGLE_CLIENT_ID=
```

Open your own PowerShell terminal in the project directory and run:

```powershell
$adminSetupScript = @'
import os
import subprocess
import sys
from pathlib import Path
from dotenv import dotenv_values

config_path = Path('.env.production.local')
if not config_path.is_file():
    raise SystemExit('Create .env.production.local in the project root first.')
production_config = dotenv_values(config_path)
database_url = production_config.get('DATABASE_URL') or ''
if production_config.get('DJANGO_DEBUG') != 'false' or not database_url.startswith(('postgres://', 'postgresql://')):
    raise SystemExit('The production file must contain DJANGO_DEBUG=false and a PostgreSQL DATABASE_URL.')
for name in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'VITE_GOOGLE_CLIENT_ID'):
    production_config[name] = production_config.get(name) or ''
os.environ.update({key: value for key, value in production_config.items() if value is not None})
subprocess.run([sys.executable, 'backend/manage.py', 'createsuperuser'], check=True)
'@
.\.venv\Scripts\python.exe -c $adminSetupScript
```

This command prompts you for the administrator email and password and creates that account in Supabase. It does not change your normal `.env`. Use a unique administrator password.

Visit `https://YOUR_SERVICE.onrender.com/admin/` and sign in. In the Sites admin, update site ID 1 to your live hostname and `Campus Job`. Public sign-up still uses the normal verification flow.

The deployed database starts empty. Local users, jobs and uploaded files are not automatically moved. Keep the local database and files as a separate copy; importing existing records/files needs an explicit data migration. Do not run the demo seeder on this deployment.

## 9. Test the deployed website

Check these in order:

1. Open `https://YOUR_SERVICE.onrender.com/api/v1/health/`. Expect a successful response with `status: ok`.
2. Open the homepage and refresh a nested page. Styles, JavaScript and navigation should load.
3. Register using an email address you control. Confirm delivery in both your inbox and Brevo's logs.
4. Enter the six-digit verification code from the email in the app, then sign in. The code expires after 10 minutes.
5. Use Forgot Password, follow its email and confirm that the old password stops working.
6. Upload a profile photo and a small test PDF resume. Confirm they appear in the private storage bucket.
7. Try opening the resume's Django download URL while signed out: access should be denied. Do not make the bucket public to fix an authorization problem.
8. Register a test recruiter and confirm that email verification alone does not approve the company. Exercise the admin approval flow.
9. Redeploy once, then confirm that your test account and uploaded files remain available.

A successful deploy or a successful email API response is not proof of inbox delivery. Keep public sign-up closed to real users until the verification and reset checks succeed.

## 10. Troubleshoot common problems

| Symptom | What to check |
| --- | --- |
| Build says missing production settings | Apply step 5's validation change and supply every named setting in Render |
| `ModuleNotFoundError: anymail` | Commit the updated requirements and run a fresh build |
| `bash` script reports `\r` or bad interpreter | Save `build.sh` with LF line endings |
| `npm ci` fails | Keep `frontend/package-lock.json` committed and synchronized with package.json |
| PostgreSQL cannot connect | Project is running; correct session-pooler URL, username, encoded password and SSL option |
| HTTP 400 / invalid host | Exact Render hostname in `DJANGO_ALLOWED_HOSTS` |
| HTTP 403 CSRF | Exact HTTPS origin in `CSRF_TRUSTED_ORIGINS`; browse the configured live hostname |
| Blank page or missing assets | Repository root build; React build ran before collectstatic; Vite base is `/static/` |
| Upload fails / missing bucket name | Storage code change applied; private bucket exists; S3 key, endpoint and region match |
| Verification/reset returns 503 | Brevo API key, sender approval, quota, account activation and email logs |
| Verification link opens localhost | Change `FRONTEND_URL`, redeploy and request a fresh link |
| First page load is slow | Render Free may be waking from idle |
| Health check returns 429 | Add the health endpoint's throttle exemption from step 5 |

Use the service's Render logs for application errors and Brevo's delivery logs for email rejection details. Avoid posting secrets or full verification/reset links when sharing logs.

## 11. Update the site and keep it free

After a local change, run the relevant checks, review the diff, then commit and push to `main`. Render can automatically rebuild that branch. Static assets are regenerated; Supabase stores the persistent records and uploaded files.

Keep the service and project on Free plans, monitor usage, and avoid adding paid disks, databases, extra paid compute or a paid custom domain. Download regular database and file backups; these are separate and both are needed for recovery. Review the current free-plan terms before increasing traffic.

The previous code version can be redeployed if a code change fails. Reverting code does not automatically undo a database migration, so take a database backup before significant schema changes.

## 12. If you later want separate frontend hosting

Both frontend and backend are deployed by the guide above. A separate Vercel/Netlify frontend is possible, but the current app would also need production API proxy rules, frontend build-base changes and SPA fallback rules. Directly pointing the browser at another domain is insufficient because login relies on same-origin cookies and CSRF handling. Resume downloads and upload-size limits must be checked too.

For the first free deployment, keep the single public origin described here. It supports the existing frontend, backend, email verification, admin and file downloads with fewer configuration changes.
