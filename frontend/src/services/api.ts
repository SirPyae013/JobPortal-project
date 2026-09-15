import type { Job, User } from "../types";

const API_ROOT = "/api/v1";

const slowRequests = new Set<symbol>();
const requestListeners = new Set<() => void>();
export const hasSlowRequest = () => slowRequests.size > 0;
export function subscribeToSlowRequests(listener: () => void) {
  requestListeners.add(listener);
  return () => { requestListeners.delete(listener); };
}

async function trackedFetch(url: string, options: RequestInit) {
  const id = Symbol();
  const timer = setTimeout(() => {
    slowRequests.add(id);
    requestListeners.forEach(listener => listener());
  }, 8000);
  try {
    return await fetch(url, options);
  } finally {
    clearTimeout(timer);
    if (slowRequests.delete(id)) requestListeners.forEach(listener => listener());
  }
}

export function dashboardRequest<T>(path: string, options: RequestInit = {}) {
  return request<T>(`/dashboard${path}`, options, false);
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  fields: Record<string, string[]>;
  status: number;
  retryAfter: number;

  constructor(message: string, fields: Record<string, string[]> = {}, status = 0, retryAfter = 0) {
    super(message);
    this.fields = fields;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function validationMessage(fields: Record<string, unknown> = {}) {
  const messages = Object.entries(fields).flatMap(([field, value]) => {
    const values = Array.isArray(value) ? value : [value];
    const label = field === "non_field_errors"
      ? ""
      : `${field.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}: `;
    return values.filter(Boolean).map((message) => `${label}${String(message)}`);
  });
  return messages.join(" ");
}

function cookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

let refreshRequest: Promise<void> | null = null;

export async function ensureCsrf() {
  await trackedFetch(`${API_ROOT}/auth/csrf/`, { credentials: "include" });
}

async function request<T>(path: string, options: RequestInit = {}, retry = true, responseType: "json" | "blob" = "json"): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = cookie("csrftoken");
    if (token) headers.set("X-CSRFToken", decodeURIComponent(token));
  }
  const response = await trackedFetch(`${API_ROOT}${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && retry && !path.includes("/auth/login") && !path.includes("/auth/token/refresh")) {
    refreshRequest ||= request<void>("/auth/token/refresh/", { method: "POST" }, false).finally(() => {
      refreshRequest = null;
    });
    try {
      await refreshRequest;
      return request<T>(path, options, false, responseType);
    } catch {}
  }
  const data = response.status === 204 ? null : response.ok && responseType === "blob" ? await response.blob() : await response.json().catch(() => null);
  if (!response.ok) {
    const fields = data?.fields || {};
    throw new ApiError(
      validationMessage(fields) || data?.message || data?.detail || "Request failed.",
      fields,
      response.status,
      Number(response.headers.get("Retry-After")) || 0,
    );
  }
  return data as T;
}

export async function downloadResume(resource: "applications" | "students", id: string, name: string) {
  const file = await request<Blob>(`/${resource}/${encodeURIComponent(id)}/resume/`, { cache: "no-store" }, true, "blob");
  if (!file.type.toLowerCase().startsWith("application/pdf")) throw new Error("The server did not return a PDF résumé. Please try again.");
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "candidate"}-${resource === "applications" ? "application" : "profile"}-${id.slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function mapJob(dto: any): Job {
  return {
    id: dto.id,
    title: dto.title,
    company: dto.company_name,
    companyId: dto.company,
    jobType: dto.job_type,
    industry: dto.industry,
    compensation: dto.compensation,
    compensationMin: dto.compensation_min,
    compensationMax: dto.compensation_max,
    description: dto.description,
    skills: dto.skills || [],
    resumeRequired: dto.resume_required,
    coverLetterRequired: dto.cover_letter_required,
    createdAt: dto.created_at,
  };
}

async function pageResults<T>(path: string, allPages = false, signal?: AbortSignal): Promise<T[]> {
  const results: T[] = [];
  const collection = path.split("?")[0];
  const visited = new Set<string>();
  let next: string | null = path;
  while (next) {
    if (visited.has(next)) throw new Error("Unable to load the next page. Please try again.");
    visited.add(next);
    const page: Page<T> = await request<Page<T>>(next, { signal });
    results.push(...page.results);
    // Reuse only pagination parameters, keeping requests on our own API collection.
    next = allPages && page.next ? `${collection}${new URL(page.next, window.location.origin).search}` : null;
  }
  return results;
}

export async function fetchJobs(params?: { q?: string; job_type?: string; industry?: string; sort_by?: string }, allPages = false) {
  const query = new URLSearchParams();
  if (params?.q) query.set("search", params.q);
  if (params?.job_type) query.set("job_type", params.job_type);
  if (params?.industry) query.set("industry", params.industry);
  if (params?.sort_by) query.set("ordering", params.sort_by);
  return (await pageResults<any>(`/jobs/${query.size ? `?${query}` : ""}`, allPages)).map(mapJob);
}

export async function fetchMyJobs(allPages = false, signal?: AbortSignal) {
  return (await pageResults<any>("/jobs/?mine=1", allPages, signal)).map(mapJob);
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  role: "student" | "recruiter";
  full_name: string;
  university?: string;
  company_name?: string;
  company_website?: string;
}) {
  await ensureCsrf();
  return request<{ message: string; email_verification_required: boolean }>("/auth/register/", { method: "POST", body: JSON.stringify(payload) });
}

export async function login(email: string, password: string) {
  await ensureCsrf();
  await request("/auth/login/", { method: "POST", body: JSON.stringify({ email, password }) });
  return fetchCurrentUser();
}

export async function googleLogin(payload: { id_token: string; role: "student" | "recruiter"; full_name?: string; university?: string; company_name?: string }) {
  await ensureCsrf();
  await request("/auth/google/", { method: "POST", body: JSON.stringify(payload) });
  return fetchCurrentUser();
}

export async function logout() {
  await request("/auth/logout/", { method: "POST" });
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<User> {
  return request<User>("/auth/me/", { signal });
}

export async function requestPasswordReset(email: string) {
  return request("/auth/password/reset/", { method: "POST", body: JSON.stringify({ email }) });
}

export async function verifyEmail(email: string, code: string) {
  await ensureCsrf();
  return request("/auth/registration/verify-email/", { method: "POST", body: JSON.stringify({ email, code }) });
}

export async function resendVerificationEmail(email: string) {
  await ensureCsrf();
  return request<{ detail: string }>("/auth/registration/resend-email/", { method: "POST", body: JSON.stringify({ email }) });
}

export async function confirmPasswordReset(uid: string, token: string, password: string) {
  return request("/auth/password/reset/confirm/", { method: "POST", body: JSON.stringify({ uid, token, new_password1: password, new_password2: password }) });
}

export async function submitApplication(payload: {
  jobId: string;
  resumeSource: "none" | "profile" | "upload";
  resumeFile?: File;
  coverLetter?: string;
}) {
  const form = new FormData();
  form.append("job", payload.jobId);
  form.append("resume_source", payload.resumeSource);
  form.append("cover_letter", payload.coverLetter || "");
  if (payload.resumeFile) form.append("resume_file", payload.resumeFile);
  return request("/applications/", { method: "POST", body: form });
}

export interface StudentApplication {
  id: string;
  status: string;
  submitted_at: string;
  job_details: any;
  job?: { title?: string; company?: string };
  title?: string;
  company?: string;
  created_at?: string;
}

export async function fetchStudentApplications(signal?: AbortSignal, allPages = false): Promise<StudentApplication[]> {
  return pageResults<StudentApplication>("/applications/", allPages, signal);
}

export async function withdrawApplication(id: string) {
  return request(`/applications/${id}/withdraw/`, { method: "POST" });
}

export interface StudentProfile {
  id: string;
  name: string;
  university: string;
  graduation_year: number | null;
  photo_url: string | null;
  has_resume: boolean;
  skills: string[];
  experience: string;
  bio: string;
  is_complete: boolean;
}

export async function fetchStudentProfile(): Promise<StudentProfile> {
  return request<StudentProfile>("/student-profile/me/");
}

export async function updateStudentProfile(payload: {
  name?: string;
  university?: string;
  graduationYear?: string;
  skills: string[];
  resumeFile?: File;
  profilePhoto?: File;
  experience: string;
  bio: string;
}) {
  const form = new FormData();
  if (payload.name !== undefined) form.append("name", payload.name);
  if (payload.university !== undefined) form.append("university", payload.university);
  if (payload.graduationYear) form.append("graduation_year", payload.graduationYear);
  payload.skills.forEach((skill) => form.append("skills", skill));
  form.append("experience", payload.experience);
  form.append("bio", payload.bio);
  if (payload.resumeFile) form.append("resume", payload.resumeFile);
  if (payload.profilePhoto) form.append("photo", payload.profilePhoto);
  return request<StudentProfile>("/student-profile/me/", { method: "PATCH", body: form });
}

export async function createJob(payload: Record<string, unknown>) {
  const dto = await request<any>("/jobs/", { method: "POST", body: JSON.stringify(payload) });
  return mapJob(dto);
}

export async function deleteJob(id: string) {
  return request<void>(`/jobs/${id}/`, { method: "DELETE" });
}

export async function fetchApplications(allPages = false, signal?: AbortSignal): Promise<any[]> {
  return pageResults<any>("/applications/", allPages, signal);
}

export async function updateApplicationStatus(id: string, status: string) {
  return request(`/applications/${id}/status/`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface RecruiterProfile {
  id: string;
  name: string;
  email: string;
  job_title: string;
  phone: string;
  bio: string;
  photo_url: string | null;
  approval_status: ApprovalStatus;
  rejection_reason: string;
}

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  website: string;
  industry: string;
  location: string;
  contact_email: string;
  description: string;
  approval_status: ApprovalStatus;
  rejection_reason: string;
}

export function fetchRecruiterProfile(signal?: AbortSignal) {
  return request<RecruiterProfile>("/recruiter-profile/me/", { signal });
}

export function updateRecruiterProfile(payload: Pick<RecruiterProfile, "name" | "job_title" | "phone" | "bio">, photo?: File) {
  const form = new FormData();
  for (const [field, value] of Object.entries(payload)) form.set(field, value);
  if (photo) form.set("photo", photo);
  return request<RecruiterProfile>("/recruiter-profile/me/", { method: "PATCH", body: form });
}

export async function fetchCompany(signal?: AbortSignal) {
  return request<Company>("/company/me/", { signal });
}

export async function updateCompany(form: FormData) {
  return request<Company>("/company/me/", { method: "PATCH", body: form });
}

export async function resubmitCompany() {
  return request("/company/me/resubmit/", { method: "POST" });
}

export async function fetchStudents(search = "", allPages = false, signal?: AbortSignal) {
  return pageResults<StudentProfile>(`/students/${search ? `?search=${encodeURIComponent(search)}` : ""}`, allPages, signal);
}

export async function fetchNotifications(signal?: AbortSignal) {
  return (await request<Page<any>>("/notifications/", { signal, cache: "no-store" })).results;
}

export async function fetchUnreadCount(signal?: AbortSignal) {
  return request<{ count: number }>("/notifications/unread-count/", { signal, cache: "no-store" });
}

export async function markAllNotificationsRead() {
  return request("/notifications/read-all/", { method: "POST" });
}
