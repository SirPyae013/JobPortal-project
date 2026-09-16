# OTP email on Render Free

Render Free blocks SMTP ports 25, 465 and 587, including Gmail SMTP.
Use the Resend HTTPS backend for account verification and password reset emails.

1. Create a Resend account and add a domain you own under **Domains**.
2. Add Resend's DNS records at your domain provider and wait for the domain to
   show **Verified**.
3. Create an API key under **API Keys**.
4. Set these variables on the Render **JobPortal-project** web service:

| Key | Value |
| --- | --- |
| `EMAIL_BACKEND` | `accounts.resend_backend.EmailBackend` |
| `RESEND_API_KEY` | Your private Resend API key (starts with `re_`) |
| `DEFAULT_FROM_EMAIL` | `Job Portal <verify@your-verified-domain.com>` |

Save and redeploy, then request a fresh OTP. Check Resend's email logs
for delivery status. An API acceptance does not guarantee inbox delivery.
Never commit API keys or paste them into chat. Existing Gmail/Brevo variables
are unused while the Resend backend is selected; they can be removed later.

`onboarding@resend.dev` is only for testing and can send only to the email
address associated with the Resend account. A verified domain is required to
send verification codes to real users.

References: https://render.com/docs/free and
https://resend.com/docs/api-reference/emails/send-email
