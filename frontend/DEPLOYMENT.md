# Cloudflare frontend and Render API

The `jobportal-frontend` Worker serves the Vite build and forwards `/api/`,
`/accounts/`, `/admin/`, `/static/` and `/media/` to
`https://jobportal-project-didk.onrender.com`. Requests stay on the frontend
domain in the browser, so Django's cookies and CSRF token continue to work.
The `/dashboard` route remains the React administration interface.

From this directory:

```sh
npm ci
npm run cf:types
npm run lint
npm run test:worker
npm run deploy
```

Wrangler builds the frontend before deploying. Cloudflare Workers Builds can
also deploy this repository with `npx wrangler deploy` as the deploy command.
An existing deploy command with `--assets ./dist` still reads `wrangler.jsonc`.
The Worker name must remain `jobportal-frontend` to update the existing site.
Direct CLI deployment requires Cloudflare login; Git-triggered builds use the
existing Cloudflare connection.

On Render, `FRONTEND_URL` should be
`https://jobportal-frontend.shinzo0864.workers.dev`. Django defaults to this URL
when Render provides its service hostname, and adds it to trusted CSRF origins.
If Render already has a `FRONTEND_URL` variable, its value takes precedence.
No wildcard hosts or cross-site cookie settings are needed.

After both deployments, check the frontend URL with `/api/v1/health/` and
`/api/v1/jobs/`, then sign in and reload the page. `/api/` responses must be
JSON, and `/dashboard` must show the React app. Render's free service can take
time to wake from inactivity.

This connection does not provision a persistent database, uploaded-file
storage, or email delivery. Those must be configured separately before relying
on registrations and uploads across Render redeployments.
