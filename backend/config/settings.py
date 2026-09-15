import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


DEBUG = env_bool("DJANGO_DEBUG", True)
DEV_SECRET_KEY = "dev-only-change-me-use-env-in-production"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", DEV_SECRET_KEY)
ALLOWED_HOSTS = [item.strip() for item in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if item.strip()]
# Render supplies this exact hostname for the deployed web service.
render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)
DEPLOYED_FRONTEND_ORIGIN = "https://jobportal-frontend.shinzo0864.workers.dev"
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    DEPLOYED_FRONTEND_ORIGIN if render_hostname else "http://localhost:3000",
).rstrip("/")
CSRF_TRUSTED_ORIGINS = [item.strip() for item in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()]
# This application's deployed frontend remains trusted even when a stale
# FRONTEND_URL or CSRF_TRUSTED_ORIGINS value still points to local development.
if DEPLOYED_FRONTEND_ORIGIN not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(DEPLOYED_FRONTEND_ORIGIN)
if render_hostname and FRONTEND_URL not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)
CORS_ALLOWED_ORIGINS = [item.strip() for item in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()]
CORS_ALLOW_CREDENTIALS = True

if not DEBUG:
    required = ("DJANGO_SECRET_KEY", "DATABASE_URL", "DJANGO_ALLOWED_HOSTS", "CSRF_TRUSTED_ORIGINS", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AWS_STORAGE_BUCKET_NAME")
    if os.getenv("EMAIL_BACKEND") == "accounts.brevo_backend.EmailBackend":
        required += ("BREVO_API_KEY", "DEFAULT_FROM_EMAIL")
    else:
        required += ("EMAIL_HOST", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD")
    missing = [
        name for name in required
        if not os.getenv(name) and not (name == "DJANGO_ALLOWED_HOSTS" and render_hostname)
    ]
    if missing:
        raise ImproperlyConfigured(f"Missing production settings: {', '.join(missing)}")
    if SECRET_KEY == DEV_SECRET_KEY:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be changed in production.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "accounts",
    "companies",
    "jobs",
    "applications",
    "notifications",
    "core.apps.CoreConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [PROJECT_ROOT / "frontend" / "dist", BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
        "core.context_processors.admin_stats",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Yangon"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SITE_ID = 1

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
SPA_DIST = PROJECT_ROOT / "frontend" / "dist"
if (SPA_DIST / "assets").exists():
    STATICFILES_DIRS = [("assets", SPA_DIST / "assets")]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
if os.getenv("AWS_STORAGE_BUCKET_NAME"):
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL") or None

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "dj_rest_auth.jwt_auth.JWTCookieAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "120/hour", "user": "1200/hour", "auth": "10/minute"},
}

REST_AUTH = {
    "TOKEN_MODEL": None,
    "USE_JWT": True,
    "JWT_AUTH_COOKIE": "jobportal_access",
    "JWT_AUTH_REFRESH_COOKIE": "jobportal_refresh",
    "JWT_AUTH_REFRESH_COOKIE_PATH": "/api/v1/auth/token/refresh/",
    "JWT_AUTH_HTTPONLY": True,
    "JWT_AUTH_SECURE": not DEBUG,
    "JWT_AUTH_SAMESITE": "Lax",
    "JWT_AUTH_COOKIE_USE_CSRF": True,
    "JWT_AUTH_RETURN_EXPIRATION": True,
    "SESSION_LOGIN": False,
    "USER_DETAILS_SERIALIZER": "accounts.serializers.CurrentUserSerializer",
    "REGISTER_SERIALIZER": "accounts.serializers.RegisterSerializer",
    "PASSWORD_RESET_SERIALIZER": "accounts.password_reset.PasswordResetSerializer",
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
EMAIL_VERIFICATION_ENABLED = env_bool("EMAIL_VERIFICATION_ENABLED", True)
ACCOUNT_EMAIL_VERIFICATION = "mandatory" if EMAIL_VERIFICATION_ENABLED else "none"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_CONFIRM_EMAIL_ON_GET = False
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 1
ACCOUNT_EMAIL_SUBJECT_PREFIX = "[Job Portal] "
ACCOUNT_ADAPTER = "accounts.account_adapter.AccountAdapter"
PASSWORD_RESET_CONFIRM_URL = "password/reset/confirm/{uid}/{token}"
SOCIALACCOUNT_EMAIL_VERIFICATION = "none"
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
SOCIALACCOUNT_PROVIDERS = {
    "google": {"APP": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "key": "",
    }, "SCOPE": ["profile", "email"], "AUTH_PARAMS": {"access_type": "online"}}
}
SOCIALACCOUNT_ADAPTER = "accounts.social_adapter.SocialAccountAdapter"

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend" if os.getenv("EMAIL_HOST") or not DEBUG
    else "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
if EMAIL_HOST == "smtp.gmail.com":
    EMAIL_HOST_PASSWORD = EMAIL_HOST_PASSWORD.replace(" ", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Job Portal <no-reply@example.com>")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

SPECTACULAR_SETTINGS = {
    "TITLE": "Job Portal API",
    "DESCRIPTION": "Campus recruitment API for Myanmar students and employers.",
    "VERSION": "1.0.0",
}
