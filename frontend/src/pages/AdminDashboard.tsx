import { useEffect, useState } from 'react';
import { Users, Building2, BriefcaseBusiness, FileText, LayoutDashboard, Search, ArrowUpRight, LogOut, RefreshCw, CheckCircle2, Trash2, X } from 'lucide-react';
import { ApiError, dashboardRequest, ensureCsrf, type Page } from '../services/api';
import './admin.css';
import LogoMark from '../components/LogoMark';
import ThemeToggle from '../components/ThemeToggle';

type Section = 'overview' | 'users' | 'companies' | 'jobs' | 'applications';
type RecordData = { id: string; [key: string]: string | number | boolean | string[] | null };
type Overview = { users: number; companies: number; jobs: number; applications: number; unverified_users: number; pending_recruiters: number; pending_companies: number; application_statuses: Record<string, number> };
const sections = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'users', label: 'Users', icon: Users }, { id: 'companies', label: 'Companies', icon: Building2 }, { id: 'jobs', label: 'Jobs', icon: BriefcaseBusiness }, { id: 'applications', label: 'Applications', icon: FileText }] as const;
const columns: Record<Exclude<Section, 'overview'>, string[]> = { users: ['name', 'email', 'role', 'email_verified', 'approval'], companies: ['name', 'email', 'location', 'approval'], jobs: ['title', 'company', 'type', 'compensation'], applications: ['student', 'job', 'company', 'status'] };
const label = (text: string) => text.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const display = (value: RecordData[string]) => value === null || value === '' ? '—' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : Array.isArray(value) ? value.join(', ') || '—' : String(value);

export default function AdminDashboard() {
  const [admin, setAdmin] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [section, setSection] = useState<Section>('overview');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [records, setRecords] = useState<Page<RecordData> | null>(null);
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [action, setAction] = useState<'verify' | 'approve' | 'delete' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    ensureCsrf().then(() => dashboardRequest<{ email: string }>('/session/')).then(user => setAdmin(user.email)).catch(err => {
      if (!(err instanceof ApiError) || err.status !== 403) setError('Unable to connect. Please try signing in again.');
    }).finally(() => setChecking(false));
  }, []);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setRecords(null);
    const params = new URLSearchParams({ search: query, status: filter, page: String(page) });
    Promise.all([
      dashboardRequest<Overview>('/overview/', { signal: controller.signal }),
      section === 'overview' ? Promise.resolve(null) : dashboardRequest<Page<RecordData>>(`/${section}/?${params}`, { signal: controller.signal }),
    ]).then(([stats, data]) => { setOverview(stats); setRecords(data); }).catch(err => {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && err.status === 403) { setAdmin(null); setSelected(null); }
      setError(err.message || 'Unable to load dashboard.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, section, query, filter, page, revision]);
  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { setSelected(null); setAction(null); }
      if (event.key === 'Tab') {
        const elements = document.querySelectorAll<HTMLElement>('.admin-dialog button:not(:disabled), .admin-dialog input');
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previousFocus?.focus(); };
  }, [selected, busy]);

  function navigate(next: Section, status = '') { setSection(next); setFilter(status); setSearch(''); setQuery(''); setPage(1); setSelected(null); setAction(null); setNotice(''); }
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await ensureCsrf(); const user = await dashboardRequest<{ email: string }>('/login/', { method: 'POST', body: JSON.stringify({ email, password }) }); setAdmin(user.email); setPassword(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  async function performAction() {
    if (!selected || !action) return;
    setBusy(true); setError('');
    try {
      await dashboardRequest(`/${section}/${selected.id}/${action === 'delete' ? '' : `${action}/`}`, { method: action === 'delete' ? 'DELETE' : 'POST', body: JSON.stringify(action === 'delete' ? { confirm_email: confirmation } : {}) });
      setNotice(action === 'delete' ? 'User and linked records deleted.' : action === 'verify' ? 'Email marked as verified.' : 'Approval saved.');
      setSelected(null); setAction(null); setConfirmation(''); setPage(1); setRevision(r => r + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Action failed.'); }
    finally { setBusy(false); }
  }

  if (checking) return <div className="admin-app admin-login"><p role="status">Opening administration…</p></div>;
  if (!admin) return <div className="admin-app admin-login"><ThemeToggle /><form onSubmit={signIn} className="admin-login-card"><span className="admin-logo"><LogoMark size={40} /></span><p className="admin-eyebrow">CAMPUSJOB / ADMINISTRATION</p><h1>A clear view of your campus.</h1><p>Sign in with your administrator account to review activity and manage verification.</p><label>Admin login or email<input type="text" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to dashboard'}<ArrowUpRight size={18} /></button><a href="/jobs">Return to CampusJob</a></form></div>;

  return <div className="admin-app admin-layout">
    <aside className="admin-sidebar"><a className="admin-brand" href="/dashboard"><span className="admin-logo"><LogoMark size={40} /></span><span>CampusJob</span></a><p className="admin-nav-label">WORKSPACE</p><nav aria-label="Administration">{sections.map(item => <button key={item.id} aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}</button>)}</nav><div className="admin-sidebar-footer"><button disabled={busy} onClick={async () => { setBusy(true); try { await dashboardRequest('/session/', { method: 'DELETE' }); setAdmin(null); setSelected(null); setOverview(null); setRecords(null); } catch { setError('Sign-out failed. Please try again.'); } finally { setBusy(false); } }}><LogOut size={16} />Sign out</button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><span>Workspace / {label(section)}</span><div className="admin-theme-actions"><ThemeToggle /></div></header><div className="admin-content"><div className="admin-heading"><div><p className="admin-eyebrow">CAMPUS OPERATIONS</p><h1>{section === 'overview' ? 'Your platform, at a glance.' : label(section)}</h1><p>{section === 'overview' ? 'Monitor activity and keep your community moving.' : `Browse ${section}, inspect details${section === 'users' ? ', and manage account verification.' : '.'}`}</p></div><button className="admin-secondary" disabled={loading} onClick={() => setRevision(r => r + 1)}><RefreshCw size={16} />Refresh</button></div>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      {section === 'overview' && overview && <><div className="admin-stats">{sections.slice(1).map(item => <button key={item.id} onClick={() => navigate(item.id)}><span>{item.label}<item.icon size={19} /></span><strong>{overview[item.id].toLocaleString()}</strong><small>View all {item.label.toLowerCase()} <ArrowUpRight size={14} /></small></button>)}</div><div className="admin-panels"><section className="admin-panel"><p className="admin-eyebrow">NEXT UP</p><h2>Needs your attention</h2><p>Review each account before granting approval.</p>{[{ title: 'Unverified emails', total: overview.unverified_users, section: 'users' as const, filter: 'unverified' }, { title: 'Recruiters awaiting approval', total: overview.pending_recruiters, section: 'users' as const, filter: 'pending' }, { title: 'Companies awaiting approval', total: overview.pending_companies, section: 'companies' as const, filter: 'pending' }].map(item => <button className="admin-queue" key={item.title} onClick={() => navigate(item.section, item.filter)}><span>{item.title}</span><b>{item.total}</b><ArrowUpRight size={17} /></button>)}</section><section className="admin-panel"><p className="admin-eyebrow">RECRUITMENT</p><h2>Application activity</h2><p>A breakdown of current application statuses.</p>{['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn'].map(status => <div className="admin-bar-row" key={status}><div><span>{label(status)}</span><b>{overview.application_statuses[status] || 0}</b></div><div className="admin-bar"><span style={{ width: `${overview.applications ? (overview.application_statuses[status] || 0) / overview.applications * 100 : 0}%` }} /></div></div>)}</section></div></>}
      {section !== 'overview' && <section className="admin-table-panel"><div className="admin-toolbar"><label className="admin-search"><Search size={18} /><input aria-label={`Search ${section}`} placeholder={`Search ${section}…`} value={search} onChange={e => setSearch(e.target.value)} /></label>{section !== 'jobs' && <select aria-label="Filter records" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All records</option>{(section === 'users' ? ['unverified', 'student', 'recruiter', 'pending'] : section === 'companies' ? ['pending', 'approved', 'rejected'] : ['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn']).map(item => <option key={item} value={item}>{label(item)}</option>)}</select>}</div><div className="admin-table-scroll"><table><thead><tr>{columns[section].map(key => <th key={key}>{label(key)}</th>)}<th>Details</th></tr></thead><tbody>{!loading && records?.results.map(record => <tr key={record.id}>{columns[section].map(key => <td key={key}>{['approval', 'status', 'role', 'email_verified'].includes(key) ? <span className={`admin-badge ${record[key] === true || record[key] === 'approved' || record[key] === 'accepted' ? 'good' : ''}`}>{key === 'email_verified' ? record[key] ? 'Verified' : 'Unverified' : display(record[key])}</span> : display(record[key])}</td>)}<td><button className="admin-text-button" onClick={() => { setSelected(record); setAction(null); setConfirmation(''); }}>View<span className="sr-only"> {display(record.email || record.title || record.name || record.student)}</span><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{loading ? <p className="admin-empty" role="status">Loading records…</p> : records?.count === 0 ? <div className="admin-empty"><Search size={28} /><h3>No records found</h3><p>Try a different search or filter.</p></div> : null}</div><footer className="admin-pagination"><span>{records ? `${records.count} records · Page ${page} of ${Math.max(1, Math.ceil(records.count / 20))}` : '—'}</span><div><button disabled={loading || !records?.previous} onClick={() => setPage(p => p - 1)}>Previous</button><button disabled={loading || !records?.next} onClick={() => setPage(p => p + 1)}>Next</button></div></footer></section>}
      {section === 'overview' && loading && <p role="status">Updating overview…</p>}
    </div></main>
    {selected && <div className="admin-modal-backdrop"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title"><header><div><p className="admin-eyebrow">{label(section)} / DETAILS</p><h2 id="admin-detail-title">{display(selected.name || selected.title || selected.student || selected.email)}</h2></div><button autoFocus aria-label="Close details" disabled={busy} onClick={() => { setSelected(null); setAction(null); }}><X size={22} /></button></header><div className="admin-detail-body"><dl>{Object.entries(selected).filter(([key]) => key !== 'protected').map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{display(value)}</dd></div>)}</dl>
      {action && <div className="admin-confirm"><h3>{action === 'delete' ? 'Permanently delete this user?' : action === 'verify' ? 'Mark this email as verified?' : `Approve this ${section === 'companies' ? 'company' : 'recruiter'}?`}</h3><p>{action === 'delete' ? 'This permanently removes the account, profile, and linked records. For recruiters this also removes their company, jobs, and applications to those jobs. This cannot be undone. Enter the exact email to confirm.' : action === 'verify' ? 'Confirm that you have checked this user’s identity and email. This bypasses email confirmation for this account.' : 'Confirm that you have reviewed the details. Recruiters need both account and company approval, plus email verification, to manage jobs.'}</p>{action === 'delete' && <label>Confirm email<input value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label>}<div className="admin-actions"><button className={action === 'delete' ? 'admin-danger' : 'admin-primary'} disabled={busy || (action === 'delete' && confirmation !== selected.email)} onClick={performAction}>{busy ? 'Saving…' : 'Confirm'}</button><button className="admin-secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</button></div></div>}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>{!action && <footer className="admin-actions">{section === 'users' && !selected.protected && <>{!selected.email_verified && <button className="admin-primary" onClick={() => setAction('verify')}><CheckCircle2 size={16} />Verify email</button>}{selected.approval && selected.approval !== 'approved' && <button className="admin-secondary" onClick={() => setAction('approve')}>Approve recruiter</button>}<button className="admin-danger" onClick={() => setAction('delete')}><Trash2 size={16} />Delete user</button></>}{section === 'companies' && selected.approval !== 'approved' && <button className="admin-primary" onClick={() => setAction('approve')}>Approve company</button>}</footer>}</section></div>}
  </div>;
}
