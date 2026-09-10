/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Lock, User, GraduationCap } from "lucide-react";
import type { User as AuthUser } from "../types";
import { ApiError, googleLogin, login as loginAccount, requestPasswordReset, resendVerificationEmail } from "../services/api";

declare global {
  interface Window { google?: any; }
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  initialMode?: "login" | "register";
  userRole: "student" | "recruiter";
  setUserRole: (r: "student" | "recruiter") => void;
  companyName: string;
  setCompanyName: (s: string) => void;
  university: string;
  setUniversity: (s: string) => void;
  onRegister?: (payload: any) => Promise<any>;
}

export default function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  initialMode = "login",
  userRole,
  setUserRole,
  companyName,
  setCompanyName,
  university,
  setUniversity,
  onRegister,
}: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const busy = loading || resetLoading || resendLoading;
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError("");
      setSuccessMessage("");
      setVerificationEmail("");
      setLoading(false);
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!isOpen || !googleClientId || !googleButtonRef.current) return;
    const render = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }: { credential: string }) => {
          setLoading(true);
          setError("");
          try {
            const user = await googleLogin({ id_token: credential, role: userRole, full_name: name, university, company_name: companyName });
            onLoginSuccess(user);
            onClose();
          } catch (googleError: any) {
            setError(googleError?.message || "Google sign-in failed.");
          } finally { setLoading(false); }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 350 });
    };
    const existing = document.getElementById("google-identity-script");
    if (existing) { render(); return; }
    const script = document.createElement("script");
    script.id = "google-identity-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [isOpen, googleClientId, userRole, name, university, companyName, verificationEmail]);

  const passwordError =
    mode === "register" &&
    password.length > 0 &&
    (!/^.{10,}$/.test(password) ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password))
      ? "Password must be at least 10 characters long and include at least one letter and one number. Avoid common passwords and passwords similar to your name or email."
      : "";

  const clearRegistrationState = () => {
    setPassword("");
    setName("");
    setCompanyName("");
    setUniversity("");
    setUserRole("student");
  };

  const handleResendVerification = async () => {
    if (busy || resendCooldown > 0) return;
    const address = (verificationEmail || email).trim();
    setError("");
    setSuccessMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address first, then request a verification email.");
      return;
    }
    setResendLoading(true);
    try {
      const result = await resendVerificationEmail(address);
      setSuccessMessage(result.detail);
      setResendCooldown(60);
    } catch (resendError: unknown) {
      if (resendError instanceof ApiError && resendError.status === 429) {
        setResendCooldown(Math.max(60, resendError.retryAfter));
      }
      setError(resendError instanceof Error ? resendError.message : "Unable to send a verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setSuccessMessage("");

    if (!email || !password) {
      setError("Please fill in all standard credentials.");
      return;
    }

    if (mode === "register") {
      if (!name) {
        setError("Please provide your full name.");
        return;
      }
      if (userRole === "student" && !university) {
        setError("Please provide your university name.");
        return;
      }
      if (userRole === "recruiter" && !companyName) {
        setError("Please provide your company name.");
        return;
      }
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    const proceed = async () => {
      setLoading(true);
      try {
        if (mode === "register") {
          if (!onRegister) throw new Error("No register handler provided");

          const payload: any = {
            email: email.trim(),
            password,
            role: userRole,
            full_name: name,
            company_name: companyName || "",
            university: university || "",
          };

          const result = await onRegister(payload);
          if (result?.message) {
            clearRegistrationState();
            setMode("login");
            setError("");
            if (result.email_verification_required) {
              setVerificationEmail(payload.email);
              setResendCooldown(60);
            } else {
              setSuccessMessage(result.message);
            }
          } else {
            setError("Registration failed.");
          }
        } else {
          const user = await loginAccount(email.trim(), password);
          onLoginSuccess(user);
          onClose();
        }
      } catch (err: any) {
        setSuccessMessage("");
        setError(err?.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    proceed();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#001142]/40 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="auth-dialog relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100/80 z-10"
          >
            <div className="h-2 bg-[#016a61]" />

            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3
                    id="modal-title"
                    className="text-2xl font-bold text-[#001142]"
                  >
                    {verificationEmail ? "Check your inbox" : mode === "login"
                      ? "Welcome Back"
                      : userRole === "student" ? "Create Student Account" : "Create Employer Account"}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {verificationEmail ? "One more step to activate your account" : mode === "login"
                      ? "Access campus opportunities instantly"
                      : "Bridge academic ambition and career growth"}
                  </p>
                </div>
                <button
                  id="close-login-modal"
                  aria-label="Close sign in dialog"
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {successMessage && (
                <div role="status" className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-lg font-medium">
                  {successMessage}
                </div>
              )}

              {error && (
                <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">
                  {error}
                </div>
              )}

              {verificationEmail ? (
                <div className="space-y-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#016a61]">
                    <Mail aria-hidden="true" className="h-7 w-7" />
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    We sent a verification link to <strong className="break-all text-[#001142]">{verificationEmail}</strong>.
                    Open the email and confirm your address before signing in.
                  </p>
                  <p className="text-xs leading-5 text-slate-500">If it hasn't arrived, check your spam or junk folder. You can request another email below.</p>
                  <button type="button" onClick={handleResendVerification} disabled={busy || resendCooldown > 0} className="w-full rounded-lg border border-teal-200 py-3 text-sm font-semibold text-[#016a61] hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60">
                    {resendLoading ? "Sending verification email..." : resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend verification email"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setVerificationEmail(""); setError(""); setSuccessMessage(""); }} className="w-full rounded-lg bg-[#016a61] py-3 text-sm font-semibold text-white hover:bg-[#005049] disabled:opacity-60">
                    Return to sign in
                  </button>
                </div>
              ) : <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <>
                    <div className="flex gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => setUserRole("student")}
                        className={`px-3 py-2 rounded-lg border font-medium ${userRole === "student" ? "bg-[#016a61] text-white" : "bg-white text-slate-600"}`}
                      >
                        I am a Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRole("recruiter")}
                        className={`px-3 py-2 rounded-lg border font-medium ${userRole === "recruiter" ? "bg-[#016a61] text-white" : "bg-white text-slate-600"}`}
                      >
                        I am an Employer
                      </button>
                    </div>

                    <div>
                      <label htmlFor="register-name-field" className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          id="register-name-field"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Alex Smith"
                          className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                        />
                      </div>
                    </div>

                    {userRole === "recruiter" ? (
                      <div>
                        <label htmlFor="register-company-field" className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                          Company Name
                        </label>
                        <div className="relative">
                          <input
                            id="register-company-field"
                            type="text"
                            required
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Acme Corp"
                            className="w-full text-sm pl-4 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="register-university-field" className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                          University Name
                        </label>
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            id="register-university-field"
                            type="text"
                            required
                            value={university}
                            onChange={(e) => setUniversity(e.target.value)}
                            placeholder="Stanford University"
                            className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label htmlFor="login-email-field" className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="login-email-field"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex.smith@university.edu"
                      className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password-field" className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="login-password-field"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                    />
                  </div>
                  {mode === "register" && passwordError && (
                    <p className="mt-2 text-xs text-red-600">{passwordError}</p>
                  )}
                </div>

                <button
                  id="submit-auth-btn"
                  type="submit"
                  disabled={busy}
                  className="w-full mt-2 bg-[#016a61] hover:bg-[#005049] text-white font-medium text-sm py-3 rounded-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all text-center"
                >
                  {loading ? (
                    <><span aria-hidden="true" className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Working...</span></>
                  ) : mode === "login" ? (
                    "Log In"
                  ) : (
                    "Register Account"
                  )}
                </button>
              </form>

              {mode === "login" && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (busy) return;
                      setSuccessMessage("");
                      setError("");
                      if (!email.trim()) return setError("Enter your email address first.");
                      setResetLoading(true);
                      try {
                        await requestPasswordReset(email.trim());
                        setSuccessMessage("If that account exists, a reset link has been sent.");
                      } catch (resetError: unknown) {
                        setError(resetError instanceof Error ? resetError.message : "Unable to request a password reset.");
                      } finally {
                        setResetLoading(false);
                      }
                    }}
                    className="text-xs font-semibold text-[#016a61] hover:text-[#005049] disabled:opacity-60"
                  >
                    {resetLoading ? "Sending reset link..." : "Forgot password?"}
                  </button>
                  <button type="button" onClick={handleResendVerification} disabled={busy || resendCooldown > 0} className="text-xs font-semibold text-[#016a61] hover:text-[#005049] disabled:opacity-60">
                    {resendLoading ? "Sending verification email..." : resendCooldown > 0 ? `Resend verification in ${resendCooldown}s` : "Resend verification email"}
                  </button>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                {googleClientId && <div ref={googleButtonRef} className="mb-5 flex justify-center" />}
                <p className="text-sm text-slate-500">
                  {mode === "login"
                    ? "Don't have an account yet?"
                    : "Already registered?"}
                  <button
                    id="switch-auth-mode-btn"
                    disabled={busy}
                    onClick={() => {
                      setMode(mode === "login" ? "register" : "login");
                      setError("");
                      setSuccessMessage("");
                    }}
                    className="ml-2 font-semibold text-[#016a61] hover:text-[#005049] transition-colors"
                  >
                    {mode === "login" ? "Create one" : "Sign In"}
                  </button>
                </p>
              </div>
              </>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
