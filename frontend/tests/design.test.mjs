import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Use the project's existing TypeScript compiler; no extra test dependency.
async function loadTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { selectJobs } = await loadTypeScript('../src/designs/modern/jobs.ts');
const api = await loadTypeScript('../src/services/api.ts');

const jobs = [
  { id: '2', title: 'Frontend Intern', company: 'Campus Co', jobType: 'Internship', industry: 'Computer Science', skills: ['React'], compensation: '100,000–900,000 MMK/month', compensationMin: '100000.00', createdAt: '2026-06-01T08:00:00Z' },
  { id: 'not-a-number', title: 'Analyst', company: 'Future Co', jobType: 'Full-Time', industry: 'Business', skills: ['Excel'], compensation: '300,000 MMK/month', compensationMin: 300000, createdAt: '2026-09-01T08:00:00Z' },
  { id: '99', title: 'Web Assistant', company: 'Campus Co', jobType: 'Part-Time', industry: 'Computer Science', skills: ['React', 'CSS'], compensation: '200,000 MMK/month', createdAt: '2026-07-01T08:00:00Z' },
];

test('newest uses dates, works with nonnumeric IDs and leaves source records untouched', () => {
  assert.deepEqual(selectJobs(jobs, '', [], '', 'newest').map((job) => job.id), ['not-a-number', '99', '2']);
  assert.deepEqual(jobs.map((job) => job.id), ['2', 'not-a-number', '99']);
});

test('compensation sorts by the numeric minimum, not concatenated range digits', () => {
  assert.deepEqual(selectJobs(jobs, '', [], '', 'salary').map((job) => job.id), ['not-a-number', '99', '2']);
});

test('skill search and multiple job types combine with industry filters', () => {
  const found = selectJobs(jobs, '  rEaCt ', ['Internship', 'Part-Time'], 'Computer Science', 'title');
  assert.deepEqual(found.map((job) => job.id), ['2', '99']);
  assert.equal(selectJobs(jobs, 'React', ['Full-Time'], '', 'newest').length, 0);
  assert.equal(selectJobs(jobs, '', [], 'Business', 'title').length, 1);
});

test('modern application history includes later pages and withdrawn applications', async (context) => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: 'http://localhost:3000' } };
  context.after(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
  const urls = [];
  context.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(url);
    const pageTwo = url.endsWith('?page=2');
    return new Response(JSON.stringify({ count: 2, previous: null, next: pageTwo ? null : 'http://localhost:8000/api/v1/applications/?page=2', results: [{ id: pageTwo ? 'older' : 'recent', status: pageTwo ? 'withdrawn' : 'submitted', job_details: { id: pageTwo ? '99' : '2' } }] }), { status: 200 });
  });
  const results = await api.fetchStudentApplications(undefined, true);
  assert.deepEqual(results.map((item) => item.status), ['submitted', 'withdrawn']);
  assert.deepEqual(urls, ['/api/v1/applications/', '/api/v1/applications/?page=2']);
});

test('paginated API callers retain their first-page behavior by default', async (context) => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify({ count: 2, previous: null, next: 'http://localhost:8000/api/v1/applications/?page=2', results: [{ id: 'first' }] }), { status: 200 });
  });
  assert.equal((await api.fetchStudentApplications()).length, 1);
  assert.equal(calls, 1);
});

test('pagination fails safely if the server repeats a page', async (context) => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: 'http://localhost:3000' } };
  context.after(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ results: [], next: 'http://localhost:8000/api/v1/applications/' }), { status: 200 }));
  await assert.rejects(api.fetchStudentApplications(undefined, true), /next page/);
});
