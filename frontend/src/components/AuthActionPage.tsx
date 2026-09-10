import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { ApiError, confirmPasswordReset, resendVerificationEmail, verifyEmail } from "../services/api";

export default function AuthActionPage({ path, onDone }: { path: string; onDone: () => void }) {
  const verifyMatch = path.match(/^\/verify-email\/([^/?#]+)\/?$/);
  const resetMatch = path.match(/^\/password\/reset\/confirm\/([^/?#]+)\/([^/?#]+)\/?$/);
  const isVerification = path.startsWith("/verify-email/");
  const [verified, setVerified] = useState(false);
  const [invalidVerification, setInvalidVerification] = useState(isVerification && !verifyMatch);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [action, setAction] = useState<"verify" | "reset" | "resend" | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const complete = verified || passwordUpdated;
  const busy = action !== null;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const confirmEmail = async () => {
    if (busy || !verifyMatch) return;
    setError("");
    setMessage("");
    setAction("verify");
    try {
      await verifyEmail(verifyMatch[1]);
      setVerified(true);
    } catch (actionError: unknown) {
      if (actionError instanceof ApiError && [400, 404].includes(actionError.status)) {
        setInvalidVerification(true);
        setError("This verification link is invalid or has expired. If you already verified your email, sign in. Otherwise, request a new link below.");
      } else {
        setError(actionError instanceof Error ? actionError.message : "Unable to verify your email. Please try again.");
      }
    } finally {
      setAction(null);
    }
  };

  const resend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || resendCooldown > 0) return;
    setError("");
    setMessage("");
    setAction("resend");
    try {
      const result = await resendVerificationEmail(email.trim());
      setMessage(`${result.detail} Check your inbox and spam folder, and use the newest email.`);
      setResendCooldown(60);
    } catch (actionError: unknown) {
      if (actionError instanceof ApiError && actionError.status === 429) {
        setResendCooldown(Math.max(60, actionError.retryAfter));
      }
      setError(actionError instanceof Error ? actionError.message : "Unable to send a verification email. Please try again.");
    } finally {
      setAction(null);
    }
  };

  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !resetMatch) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    setError("");
    if (password !== form.get("confirmPassword")) {
      setError("The passwords do not match. Please enter them again.");
      return;
    }
    setAction("reset");
    try {
      await confirmPasswordReset(resetMatch[1], resetMatch[2], password);
      setPasswordUpdated(true);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update your password. Please try again.");
    } finally {
      setAction(null);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <section aria-labelledby="auth-action-title" className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#016a61]">
          {complete ? <CheckCircle2 aria-hidden="true" className="h-7 w-7" /> : isVerification ? <Mail aria-hidden="true" className="h-7 w-7" /> : <ShieldCheck aria-hidden="true" className="h-7 w-7" />}
        </div>
        <h1 id="auth-action-title" className="text-2xl font-bold text-[#001142]">
          {verified ? "Your email is verified" : passwordUpdated ? "Password updated" : isVerification ? invalidVerification ? "Request a new verification link" : "Verify your email" : resetMatch ? "Choose a new password" : "This reset link is incomplete"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {verified ? "Your account is ready. Sign in to continue to Job Portal." : passwordUpdated ? "You can now sign in with your new password." : isVerification ? invalidVerification ? "Enter the email you used to register and we'll help you finish activating your account." : "Confirm your email address to activate your Job Portal account." : resetMatch ? "Use at least 10 characters, including a letter and a number." : "Return to sign in and use Forgot password to request a fresh link."}
        </p>

        {isVerification && !complete && !invalidVerification && (
          <button type="button" onClick={confirmEmail} disabled={busy} className="mt-6 w-full rounded-lg bg-[#016a61] py-3 text-sm font-bold text-white hover:bg-[#005049] disabled:cursor-wait disabled:opacity-60">
            {action === "verify" ? "Verifying your email..." : "Verify email"}
          </button>
        )}

        {resetMatch && !complete && (
          <form onSubmit={reset} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-[#001142]">New password</label>
              <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} required disabled={busy} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 outline-none focus:border-[#016a61]" />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-semibold text-[#001142]">Confirm new password</label>
              <input id="confirm-new-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required disabled={busy} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 outline-none focus:border-[#016a61]" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#016a61] py-3 text-sm font-bold text-white hover:bg-[#005049] disabled:cursor-wait disabled:opacity-60">
              {action === "reset" ? "Updating password..." : "Update password"}
            </button>
          </form>
        )}

        {error && <div role="alert" className="mt-5 rounded-lg border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-600">{error}</div>}
        {message && <div role="status" className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">{message}</div>}

        {isVerification && !complete && (
          <form onSubmit={resend} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            <h2 className="text-sm font-semibold text-[#001142]">Need another verification email?</h2>
            <label htmlFor="verification-email" className="block text-sm text-slate-600">Email address</label>
            <input id="verification-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} placeholder="you@example.com" className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm outline-none focus:border-[#016a61]" />
            <button type="submit" disabled={busy || resendCooldown > 0} className="w-full rounded-lg border border-teal-200 py-3 text-sm font-semibold text-[#016a61] hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60">
              {action === "resend" ? "Sending verification email..." : resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend verification email"}
            </button>
          </form>
        )}

        <button type="button" onClick={onDone} disabled={busy} className={`mt-6 text-sm font-bold disabled:opacity-60 ${complete ? "w-full rounded-lg bg-[#016a61] py-3 text-white hover:bg-[#005049]" : "text-[#016a61] hover:text-[#005049]"}`}>
          Return to sign in
        </button>
      </section>
    </main>
  );
}
