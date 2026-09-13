import { FormEvent, useState } from "react";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { confirmPasswordReset } from "../services/api";

import EmailVerificationForm from "./EmailVerificationForm";

export default function AuthActionPage({ path, onDone }: { path: string; onDone: () => void }) {
  const resetMatch = path.match(/^\/password\/reset\/confirm\/([^/?#]+)\/([^/?#]+)\/?$/);
  const isVerification = path === "/verify-email" || path.startsWith("/verify-email/");
  const [verified, setVerified] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"verify" | "reset" | "resend" | null>(null);
  const complete = verified || passwordUpdated;
  const busy = action !== null;

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
          {verified ? "Your email is verified" : passwordUpdated ? "Password updated" : isVerification ? "Verify your email" : resetMatch ? "Choose a new password" : "This reset link is incomplete"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {verified ? "Your account is ready. Sign in to continue to Job Portal." : passwordUpdated ? "You can now sign in with your new password." : isVerification ? "Verify your email using a code, without opening an email link." : resetMatch ? "Use at least 10 characters, including a letter and a number." : "Return to sign in and use Forgot password to request a fresh link."}
        </p>

        {isVerification && !complete && <div className="mt-6"><EmailVerificationForm onVerified={() => { setVerified(true); setError(""); }} /></div>}

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
        <button type="button" onClick={onDone} disabled={busy} className={`mt-6 text-sm font-bold disabled:opacity-60 ${complete ? "w-full rounded-lg bg-[#016a61] py-3 text-white hover:bg-[#005049]" : "text-[#016a61] hover:text-[#005049]"}`}>
          Return to sign in
        </button>
      </section>
    </main>
  );
}
