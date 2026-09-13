# Django backend

The backend uses Django 5.2 LTS, Django REST Framework, django-allauth, dj-rest-auth, and rotating SimpleJWT tokens.

Apps are separated by responsibility:

- `accounts`: users, student/recruiter profiles, authentication, talent directory
- `companies`: company onboarding and administrator approval
- `jobs`: public listings and recruiter-owned posting management
- `applications`: résumé snapshots, tracking, withdrawal, recruiter status updates
- `notifications`: private in-app event feed
- `core`: shared validation, pagination, health, admin statistics, and demo data

Production records are never seeded automatically. Uploaded résumés remain private and are returned only through permission-checked API views.

## Email verification and password reset

Email verification is required by default (`EMAIL_VERIFICATION_ENABLED=true`). New student and recruiter accounts receive a confirmation email and cannot sign in with a password until their email is verified. Existing verified accounts remain verified; confirming a recruiter's email does not approve their company.

Verification emails contain a six-digit OTP code, valid for 10 minutes. Sign-up opens a code-entry screen, and existing unverified users can select **Enter verification code** after attempting sign-in. The standalone `/verify-email` page also lets users request and enter codes. Submit `email` and `code` to `POST /api/v1/auth/registration/verify-email/`. Codes are stored as password hashes in the database, bound to the email address, limited to five incorrect attempts, and deleted after use. A successful resend replaces the previous code. Email verification does not depend on `FRONTEND_URL`, so users can read the email on their phone and enter its code in the localhost app. Old verification links open the code-entry page.

`POST /api/v1/auth/registration/resend-email/` accepts an `email` and returns the same message whether the account is unknown, verified, or awaiting verification. Resend requests are limited to one per minute per normalized email address; registration, resend, and verification also share a limit of ten requests per minute per IP. Request throttles use Django's configured cache; use a shared cache when running multiple workers. The code's attempt count, expiry, and send cooldown are also enforced in the database. Run `python backend/manage.py migrate` when upgrading to create the code table.

SMTP connection and authentication failures return a friendly HTTP 503 response. Failed delivery during registration rolls back the new account, allowing registration to be retried. Failed delivery does not verify an email or change a password.

`POST /api/v1/auth/password/reset/` sends a reset link to the configured `FRONTEND_URL`, using `/password/reset/confirm/{uid}/{token}`. The React page submits the new password to `/api/v1/auth/password/reset/confirm/`. Tokens and user identifiers are generated and validated by the installed allauth/dj-rest-auth integration.

### Configure actual delivery

Set these values in the project-root `.env` using credentials supplied by your email provider:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=your-provider-smtp-host
EMAIL_PORT=587
EMAIL_HOST_USER=your-smtp-login
EMAIL_HOST_PASSWORD=your-smtp-password-or-key
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
EMAIL_TIMEOUT=15
DEFAULT_FROM_EMAIL=Job Portal <your-verified-sender@example.com>
EMAIL_VERIFICATION_ENABLED=true
FRONTEND_URL=http://localhost:3000
```

The SMTP login and sender address may be different. Use a sender authorized by the provider. For port 465, set `EMAIL_USE_SSL=true` and `EMAIL_USE_TLS=false`; do not enable both. Restart Django after changing `.env`. Keep passwords and keys in local configuration or deployment secrets, outside source control and chat.

- **Gmail:** use `smtp.gmail.com` and the sending Google account as the login. The password must be a Google App Password from that same account. See [Google's App Password requirements](https://support.google.com/accounts/answer/185833?hl=en). If the feature is unavailable, another SMTP provider can be configured without changing application code.
- **Brevo (alternative):** use `smtp-relay.brevo.com`, the SMTP login shown in its dashboard, and an SMTP key (not an API key). Complete the provider's sender/domain setup first. Check account availability for your location before committing to this provider. See [Brevo's SMTP setup instructions](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

For password-reset links opened on another computer or phone, `FRONTEND_URL` must be the site's reachable origin, normally its public HTTPS URL. Email verification uses a code and has no such restriction.

For local previews, explicitly set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`. Emails then appear in the backend terminal or redirected server log and are **not delivered to an inbox**. With no explicit email backend or SMTP host configured, debug mode also defaults to this console backend. Automated email tests use Django's in-memory backend and do not send real emails.
