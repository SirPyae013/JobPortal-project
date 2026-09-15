# OTP email on Render Free

Render Free blocks SMTP ports 25, 465 and 587, including Gmail SMTP.
Use the Brevo HTTPS backend for account verification and password reset emails.

1. Create a Brevo account and verify a sender in its Senders settings.
   Complete any required transactional email activation.
2. Create an **API key** under SMTP & API (not an SMTP key).
3. Set these variables on the Render **JobPortal-project** web service:

| Key | Value |
| --- | --- |
| `EMAIL_BACKEND` | `accounts.brevo_backend.EmailBackend` |
| `BREVO_API_KEY` | Your private Brevo API key |
| `DEFAULT_FROM_EMAIL` | `Job Portal <your-verified-sender@example.com>` using your actual verified address |

Save and redeploy, then request a fresh OTP. Check Brevo's transactional logs
for delivery status. An API acceptance does not guarantee inbox delivery.
Never commit API keys or paste them into chat. Existing Gmail SMTP variables
are unused while the Brevo backend is selected; local SMTP can remain unchanged.

References: https://render.com/docs/free and
https://developers.brevo.com/docs/send-a-transactional-email
