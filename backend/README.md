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

Verification links open `/verify-email/{key}` on `FRONTEND_URL` and expire after one day. The page asks the user to confirm before submitting the key to `POST /api/v1/auth/registration/verify-email/`. It also offers a replacement link when a link has expired or has already been used. Sign-up shows a check-inbox screen with the recipient address and a resend action.

`POST /api/v1/auth/registration/resend-email/` accepts an `email` and returns the same message whether the account is unknown, verified, or awaiting verification. Resend requests are limited to one per minute per normalized email address; registration and resend also share a limit of ten requests per minute per IP. These limits use Django's configured cache; use a shared cache when running multiple workers.

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

For emails opened on another computer or phone, `FRONTEND_URL` must be the site's reachable origin, normally its public HTTPS URL. A localhost link only works on the computer running the frontend.

For local previews, explicitly set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`. Emails then appear in the backend terminal or redirected server log and are **not delivered to an inbox**. With no explicit email backend or SMTP host configured, debug mode also defaults to this console backend. Automated email tests use Django's in-memory backend and do not send real emails.
