"""Interactively create an administrator in the deployed Supabase database."""

import argparse
import getpass
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit


def database_url(value):
    value = value.strip()
    if value.startswith("DATABASE_URL="):
        value = value.partition("=")[2].strip()
    if value.startswith("psql "):
        value = value[5:].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'`":
        value = value[1:-1].strip()
    if not value:
        raise ValueError("Nothing was pasted. Press Enter at the URL prompt to use guided setup.")
    try:
        parsed = urlsplit(value)
        hostname, port = parsed.hostname, parsed.port
    except ValueError:
        raise ValueError(
            "The URL could not be parsed. Press Enter for guided setup; it safely encodes the password."
        ) from None
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("The database URL must start with postgresql:// or postgres://, not https://.")
    if not hostname or not hostname.endswith((".supabase.com", ".supabase.co")):
        raise ValueError("Use the database hostname from Supabase Connect, not the dashboard or project website URL.")
    if port not in {None, 5432}:
        raise ValueError("Select Session pooler (port 5432) in Supabase Connect, not Transaction pooler (6543).")
    if not parsed.username or not parsed.password:
        raise ValueError("The connection string is missing its database username or password. Try guided setup.")
    if unquote(parsed.password).upper() in {"[YOUR-PASSWORD]", "[YOUR_PASSWORD]", "YOUR_PASSWORD", "YOUR-PASSWORD"}:
        raise ValueError("The URL still contains a password placeholder. Try guided setup with your database password.")
    if parsed.path in {"", "/"} or parsed.fragment:
        raise ValueError("The database name is missing or a password character broke the URL. Try guided setup.")
    query = dict(parse_qsl(parsed.query))
    query["sslmode"] = "require"
    query.setdefault("connect_timeout", "15")
    return urlunsplit(parsed._replace(query=urlencode(query)))


def prompt_database_url():
    while True:
        value = getpass.getpass("Supabase DATABASE_URL (or press Enter for guided setup): ")
        if not value.strip():
            print("In Supabase Connect, select Session pooler and copy these fields.")
            hostname = input("Database host: ").strip()
            username = input("Database user (usually postgres.PROJECT_ID): ").strip()
            name = input("Database name [postgres]: ").strip() or "postgres"
            password = getpass.getpass("Database password (hidden): ")
            value = f"postgresql://{quote(username, safe='')}:{quote(password, safe='')}@{hostname}:5432/{quote(name, safe='')}"
        try:
            return database_url(value)
        except ValueError as error:
            print(str(error))
            print("Try again below, or press Ctrl+C to cancel.")


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    if not sys.stdin.isatty():
        raise SystemExit("Run this command in your own interactive terminal.")
    print("Copy DATABASE_URL from Render. Input will be hidden and will not be saved.")
    url = prompt_database_url()
    child_env = os.environ.copy()
    child_env["DATABASE_URL"] = url
    child_env["DJANGO_SETTINGS_MODULE"] = "config.settings"
    # This management-only process starts no web server. Avoid requiring the
    # deployment's unrelated email/OAuth/storage secrets for account creation.
    # Render's settings and the local .env file are not changed.
    child_env["DJANGO_DEBUG"] = "true"
    backend = Path(__file__).resolve().parent
    print("Applying pending migrations to the supplied Supabase database...")
    migration = subprocess.run(
        [sys.executable, str(backend / "manage.py"), "migrate", "--noinput"],
        cwd=backend.parent,
        env=child_env,
        check=False,
    )
    if migration.returncode != 0:
        print("Migration failed. Administrator creation was not attempted.")
        return migration.returncode
    print("Creating the administrator in the supplied Supabase database...")
    result = subprocess.run(
        [sys.executable, str(backend / "manage.py"), "createsuperuser"],
        cwd=backend.parent,
        env=child_env,
        check=False,
    )
    if result.returncode == 0:
        print("Sign in at https://jobportal-frontend.shinzo0864.workers.dev/dashboard")
    return result.returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        sys.exit("\nCancelled.")
