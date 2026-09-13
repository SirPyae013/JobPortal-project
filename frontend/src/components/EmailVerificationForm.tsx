import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, resendVerificationEmail, verifyEmail } from '../services/api';

export default function EmailVerificationForm({ initialEmail = '', initialCooldown = 0, onVerified }: { initialEmail?: string; initialCooldown?: number; onVerified: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [action, setAction] = useState<'verify' | 'resend' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = action !== null;
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage(''); setAction('verify');
    try { await verifyEmail(email.trim(), code); onVerified(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to verify the code. Please try again.'); }
    finally { setAction(null); }
  }
  async function resend() {
    if (busy || cooldown > 0) return;
    setError(''); setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address first.'); return; }
    setAction('resend');
    try { const result = await resendVerificationEmail(email.trim()); setMessage(result.detail); setCode(''); setCooldown(60); }
    catch (err) {
      if (err instanceof ApiError && err.status === 429) setCooldown(Math.max(1, err.retryAfter || 60));
      setError(err instanceof Error ? err.message : 'Unable to send a code. Please try again.');
    } finally { setAction(null); }
  }
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-slate-600">Enter the six-digit code from your email. Codes expire after 10 minutes. Check your spam folder if the email has not arrived.</p>
    <form onSubmit={submit} className="space-y-4">
      <div><label htmlFor="otp-email" className="mb-2 block text-sm font-semibold text-[#001142]">Email address</label><input id="otp-email" type="email" autoComplete="email" required readOnly={Boolean(initialEmail)} disabled={busy} value={email} onChange={e => { setEmail(e.target.value); setCode(''); setError(''); setMessage(''); }} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm outline-none focus:border-[#016a61]" /></div>
      <div><label htmlFor="email-otp" className="mb-2 block text-sm font-semibold text-[#001142]">Verification code</label><input id="email-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="000000" aria-describedby="otp-hint" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center text-3xl font-semibold tracking-[0.4em] text-[#016a61] outline-none focus:border-[#016a61]" /><p id="otp-hint" className="mt-2 text-xs text-slate-500">Use the latest code. After five incorrect attempts, request a new one.</p></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      <button disabled={busy || code.length !== 6} className="w-full rounded-lg bg-[#016a61] py-3 text-sm font-semibold text-white hover:bg-[#005049] disabled:opacity-60">{action === 'verify' ? 'Verifying…' : 'Verify email'}</button>
    </form>
    <button type="button" onClick={resend} disabled={busy || cooldown > 0} className="w-full rounded-lg border border-teal-200 py-3 text-sm font-semibold text-[#016a61] hover:bg-teal-50 disabled:opacity-60">{action === 'resend' ? 'Sending code…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Send a new code'}</button>
  </div>;
}
