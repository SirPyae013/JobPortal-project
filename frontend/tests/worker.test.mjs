import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import worker from '../worker/index.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const frontend = 'https://jobportal-frontend.shinzo0864.workers.dev';
const backend = 'https://jobportal-project-didk.onrender.com';
const env = { BACKEND_ORIGIN: backend, ASSETS: { fetch: async () => new Response('SPA') } };

test('keeps frontend routes and lookalike API paths on static assets', async () => {
  globalThis.fetch = () => { throw new Error('Must not contact backend'); };
  for (const path of ['/', '/dashboard', '/login', '/apiary', '/assets/app.js']) {
    assert.equal(await (await worker.fetch(new Request(frontend + path), env)).text(), 'SPA');
  }
});

test('forwards upload bytes, cookies and original CSRF context to the fixed backend', async () => {
  const form = new FormData();
  form.set('resume', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'resume.pdf');
  const request = new Request(frontend + '/api/v1/student-profile/me/?next=https://untrusted.example', {
    method: 'PATCH', body: form,
    headers: { Origin: frontend, Referer: frontend + '/profile', Cookie: 'jobportal_access=test; csrftoken=abc', 'X-CSRFToken': 'abc', 'X-Forwarded-Host': 'untrusted.example' },
  });
  globalThis.fetch = async (upstream, options) => {
    assert.equal(upstream.url, backend + '/api/v1/student-profile/me/?next=https://untrusted.example');
    assert.equal(upstream.method, 'PATCH');
    assert.equal(upstream.headers.get('Origin'), frontend);
    assert.equal(upstream.headers.get('Referer'), frontend + '/profile');
    assert.equal(upstream.headers.get('X-CSRFToken'), 'abc');
    assert.equal(upstream.headers.get('Cookie'), 'jobportal_access=test; csrftoken=abc');
    assert.equal(upstream.headers.get('X-Forwarded-Host'), null);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.equal(await (await upstream.formData()).get('resume').text(), '%PDF-1.4 test');
    return Response.json({ saved: true });
  };
  assert.deepEqual(await (await worker.fetch(request, env)).json(), { saved: true });
});

test('preserves separate login cookies, refresh paths, logout expiry and PDF bytes', async () => {
  const cookies = [
    'jobportal_access=test; Path=/; HttpOnly; Secure; SameSite=Lax',
    'jobportal_refresh=test; Path=/api/v1/auth/token/refresh/; HttpOnly; Secure; SameSite=Lax',
    'csrftoken=deleted; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  globalThis.fetch = async () => {
    const headers = new Headers({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=resume.pdf' });
    cookies.forEach(cookie => headers.append('Set-Cookie', cookie));
    return new Response(new Uint8Array([37, 80, 68, 70, 0, 255]), { headers });
  };
  const response = await worker.fetch(new Request(frontend + '/api/v1/students/id/resume/'), env);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename=resume.pdf');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([37, 80, 68, 70, 0, 255]));
});

test('keeps backend redirects on frontend but preserves external OAuth redirects', async () => {
  for (const [location, expected] of [
    [backend + '/admin/login/?next=/admin/', frontend + '/admin/login/?next=/admin/'],
    ['/api/v1/jobs/', frontend + '/api/v1/jobs/'],
    ['https://accounts.google.com/o/oauth2/auth', 'https://accounts.google.com/o/oauth2/auth'],
  ]) {
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: location } });
    const response = await worker.fetch(new Request(frontend + '/accounts/google/login/'), env);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), expected);
  }
});

test('preserves rejected origins and backend authentication failures', async () => {
  globalThis.fetch = async (upstream) => {
    assert.equal(upstream.headers.get('Origin'), 'https://untrusted.example');
    return Response.json({ detail: 'CSRF Failed' }, { status: 403 });
  };
  const response = await worker.fetch(new Request(frontend + '/api/v1/auth/logout/', {
    method: 'POST', headers: { Origin: 'https://untrusted.example' },
  }), env);
  assert.equal(response.status, 403);
});

test('returns a useful uncached JSON error when the backend is unreachable', async () => {
  globalThis.fetch = async () => { throw new Error('connection failed'); };
  const response = await worker.fetch(new Request(frontend + '/api/v1/health/'), env);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match((await response.json()).detail, /temporarily unavailable/);
});
