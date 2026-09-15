import { FormEvent, useEffect, useState } from "react";
import { BriefcaseBusiness, Check, FileText, Users } from "lucide-react";
import type { Job, User } from "../types";
import {
  createJob,
  deleteJob,
  downloadResume,
  fetchApplications,
  fetchCompany,
  fetchCurrentUser,
  fetchMyJobs,
  updateApplicationStatus,
} from "../services/api";

export interface CandidateApplication {
  id: string;
  candidateName: string;
  university: string;
  email: string;
  status: "Reviewing" | "Shortlisted" | "Interviewed" | "Hired";
}

interface RecruiterDashboardProps {
  onEditProfile: () => void;
  onUserChange: (user: User) => void;
  postJobRequested: boolean;
  onPostJobHandled: () => void;
}

export default function RecruiterDashboard({ onEditProfile, onUserChange, postJobRequested, onPostJobHandled }: RecruiterDashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [showJobForm, setShowJobForm] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState<string | null>(null);
  const approved = Boolean(user?.capabilities.manage_jobs);

  const handleDownloadResume = async (resource: "applications" | "students", id: string, name: string) => {
    if (downloadingResume) return;
    setError("");
    setDownloadingResume(id);
    try { await downloadResume(resource, id, name); }
    catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : "Unable to download this résumé."); }
    finally { setDownloadingResume(null); }
  };

  const load = async (signal?: AbortSignal) => {
    try {
      const [nextUser, nextCompany] = await Promise.all([
        fetchCurrentUser(signal),
        fetchCompany(signal),
      ]);
      if (signal?.aborted) return;
      setUser(nextUser);
      onUserChange(nextUser);
      setCompany(nextCompany);
    } catch (loadError: any) {
      if (!signal?.aborted) setError(loadError.message);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!approved) { setJobs([]); setApplications([]); return; }
    const controller = new AbortController();
    Promise.all([fetchMyJobs(true, controller.signal), fetchApplications(true, controller.signal)])
      .then(([nextJobs, nextApplications]) => {
        if (controller.signal.aborted) return;
        setJobs(nextJobs);
        setApplications(nextApplications);
      })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load your hiring activity."); });
    return () => controller.abort();
  }, [approved]);
  useEffect(() => {
    if (approved) return;
    const controller = new AbortController();
    const approvalPoll = window.setInterval(() => void load(controller.signal), 5000);
    return () => { controller.abort(); window.clearInterval(approvalPoll); };
  }, [approved]);
  useEffect(() => {
    if (!postJobRequested || !approved) return;
    setShowJobForm(true);
    onPostJobHandled();
  }, [postJobRequested, approved, onPostJobHandled]);
  useEffect(() => {
    if (showJobForm) document.getElementById("new-job-form")?.scrollIntoView({ behavior: "smooth" });
  }, [showJobForm]);

  const postJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      title: data.get("title"),
      job_type: data.get("job_type"),
      industry: data.get("industry"),
      description: data.get("description"),
      skills: String(data.get("skills") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      compensation_min: Number(data.get("compensation_min")),
      compensation_max: data.get("compensation_max")
        ? Number(data.get("compensation_max"))
        : null,
      resume_required: data.get("resume_required") === "on",
      cover_letter_required: data.get("cover_letter_required") === "on",
    };
    try {
      const job = await createJob(payload);
      setJobs((current) => [job, ...current]);
      setShowJobForm(false);
    } catch (postError: any) {
      setError(postError.message);
    }
  };

  if (!user || !company)
    return (
      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto p-10 text-slate-500">
        {error ? <div role="alert"><p>{error}</p><button type="button" className="cm-button cm-primary" onClick={() => { setError(""); void load(); }}>Try again</button></div> : "Loading recruiter workspace..."}
      </main>
    );

  return (
    <main id="main-content" tabIndex={-1} className="cm-recruiter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-8">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}
      {!approved && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Account review
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#001142]">
            Build your recruiter profile
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Recruiter: {user.profile?.approval_status}. Company:{" "}
            {user.profile?.company_approval_status}.
          </p>
          {(user.profile?.rejection_reason ||
            user.profile?.company_rejection_reason) && (
            <p className="mt-2 text-sm text-red-600">
              {user.profile?.rejection_reason ||
                user.profile?.company_rejection_reason}
            </p>
          )}
        </section>
      )}

      {approved && <div>
        <header className="cm-workspace-header"><div><p className="cm-eyebrow">RECRUITER WORKSPACE</p><h1>Make your next great hire.</h1><p>{company.name} · Your jobs and candidates in one place.</p></div><span className="cm-approved-tag"><Check size={15} aria-hidden="true" />Account approved</span></header>
        <div className="cm-workspace-stats">
          <a href="#posted-jobs"><BriefcaseBusiness aria-hidden="true" /><div><strong>{jobs.length}</strong><span>Job listings</span></div></a>
          <a href="#candidate-applications"><FileText aria-hidden="true" /><div><strong>{applications.length}</strong><span>Applications</span></div></a>
          <a href="#candidate-applications"><Users aria-hidden="true" /><div><strong>{applications.filter((application) => application.status === "submitted").length}</strong><span>Awaiting review</span></div></a>
        </div>
        <nav className="cm-workspace-nav" aria-label="Recruiter sections"><a href="#posted-jobs">Job listings</a><a href="#candidate-applications">Applications</a><button type="button" onClick={onEditProfile}>Recruiter profile</button></nav>
      </div>}

      <section className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="cm-listings-heading flex items-center justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold text-[#001142]">Your recruiter profile</h2>
            <p className="mt-2 text-sm text-slate-500">Add your recruiter details, company story and logo. You can update them at any time.</p>
          </div>
          <button type="button" className="cm-button cm-primary shrink-0" onClick={onEditProfile}>Edit recruiter profile</button>
        </div>
      </section>

      {approved && (
        <>
          <section id="posted-jobs" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="cm-listings-heading flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#016a61]">
                  Recruiter Console
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#001142]">
                  Posted Job Listings
                </h2>
              </div>
              <button
                onClick={() => setShowJobForm((value) => !value)}
                className="bg-[#016a61] text-white px-4 py-2.5 rounded-lg"
              >
                + New Posting
              </button>
            </div>
            {showJobForm && (
              <form
                id="new-job-form"
                onSubmit={postJob}
                className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-5 md:grid-cols-2"
              >
                <input
                  name="title"
                  aria-label="Job title"
                  required
                  placeholder="Job title"
                  className="rounded-lg border p-3"
                />
                <select name="job_type" aria-label="Job type" className="rounded-lg border p-3">
                  {["Internship", "Part-Time", "Full-Time", "Remote"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
                <select name="industry" aria-label="Industry" className="rounded-lg border p-3">
                  <option>Computer Science</option>
                </select>
                <input
                  name="skills"
                  aria-label="Skills, comma separated"
                  placeholder="Skills, comma separated"
                  className="rounded-lg border p-3"
                />
                <input
                  name="compensation_min"
                  aria-label="Minimum compensation in MMK per month"
                  type="number"
                  min="5000"
                  step="5000"
                  required
                  placeholder="Minimum MMK/month"
                  className="rounded-lg border p-3"
                />
                <input
                  name="compensation_max"
                  aria-label="Maximum compensation in MMK per month"
                  type="number"
                  min="5000"
                  step="5000"
                  placeholder="Maximum MMK/month"
                  className="rounded-lg border p-3"
                />
                <textarea
                  name="description"
                  aria-label="Role description"
                  required
                  placeholder="Role description"
                  className="rounded-lg border p-3 md:col-span-2"
                  rows={4}
                />
                <label className="text-sm">
                  <input
                    type="checkbox"
                    name="resume_required"
                    defaultChecked
                  />{" "}
                  Resume required
                </label>
                <label className="text-sm">
                  <input type="checkbox" name="cover_letter_required" /> Cover
                  letter required
                </label>
                <button className="rounded-lg bg-[#001142] px-5 py-3 text-white md:col-span-2">
                  Publish job
                </button>
              </form>
            )}
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <span className="text-xs text-[#016a61]">{job.jobType}</span>
                  <h3 className="mt-2 text-lg font-bold text-[#001142]">
                    {job.title}
                  </h3>
                  <p className="text-sm text-slate-500">{job.compensation}</p>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          "Delete this job and every application permanently?",
                        )
                      ) {
                        await deleteJob(job.id);
                        setJobs((current) =>
                          current.filter((item) => item.id !== job.id),
                        );
                      }
                    }}
                    className="mt-4 text-xs font-bold text-red-600"
                  >
                    Delete permanently
                  </button>
                </article>
              ))}
            </div>
            {!jobs.length && (
              <p className="mt-6 rounded-xl bg-slate-50 p-8 text-center text-slate-500">
                No jobs posted yet.
              </p>
            )}
          </section>

          <section id="candidate-applications" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm overflow-x-auto">
            <h2 className="text-2xl font-bold text-[#001142]">
              Candidate Applications
            </h2>
            <p className="mt-2 text-sm text-slate-500">Download the résumé submitted with each application. It may differ from the student's current profile résumé.</p>
            <table className="mt-5 min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3">Candidate</th>
                  <th>University</th>
                  <th>Job</th>
                  <th>Submitted résumé</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id} className="border-b">
                    <td className="py-3">
                      {application.student_profile?.name}
                    </td>
                    <td>{application.student_profile?.university}</td>
                    <td>{application.job_details?.title}</td>
                    <td className="py-3 pr-4">
                      {application.resume_download_url ? <button type="button" disabled={downloadingResume !== null} onClick={() => handleDownloadResume("applications", application.id, application.student_profile?.name || "candidate")} className="text-sm font-bold text-[#016a61] disabled:opacity-50" aria-label={`Download submitted résumé for ${application.student_profile?.name || "candidate"}, ${application.job_details?.title || "application"}`}>
                        {downloadingResume === application.id ? "Downloading…" : "Download résumé"}
                      </button> : <span className="text-slate-400">No résumé submitted</span>}
                    </td>
                    <td>
                      <select
                        aria-label={`Application status for ${application.student_profile?.name || "candidate"}`}
                        value={application.status}
                        onChange={async (event) => {
                          const updated: any = await updateApplicationStatus(
                            application.id,
                            event.target.value,
                          );
                          setApplications((items) =>
                            items.map((item) =>
                              item.id === application.id ? updated : item,
                            ),
                          );
                        }}
                        className="rounded border p-2"
                      >
                        {[
                          "submitted",
                          "under_review",
                          "accepted",
                          "rejected",
                        ].map((value) => (
                          <option key={value} value={value}>
                            {value.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!applications.length && <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Applications will appear here when students apply to your jobs.</p>}
          </section>
        </>
      )}
    </main>
  );
}
