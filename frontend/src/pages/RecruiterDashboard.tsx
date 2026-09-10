import { FormEvent, useEffect, useState } from "react";
import { BriefcaseBusiness, Check, FileText, Users } from "lucide-react";
import type { Job, User } from "../types";
import {
  createJob,
  deleteJob,
  fetchApplications,
  fetchCompany,
  fetchCurrentUser,
  fetchMyJobs,
  fetchStudents,
  resubmitCompany,
  updateApplicationStatus,
  updateCompany,
} from "../services/api";

export interface CandidateApplication {
  id: string;
  candidateName: string;
  university: string;
  email: string;
  status: "Reviewing" | "Shortlisted" | "Interviewed" | "Hired";
}

export default function RecruiterDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const approved = Boolean(user?.capabilities.manage_jobs);

  const load = async () => {
    try {
      const [nextUser, nextCompany] = await Promise.all([
        fetchCurrentUser(),
        fetchCompany(),
      ]);
      setUser(nextUser);
      setCompany(nextCompany);
      if (nextUser.capabilities.manage_jobs) {
        const [nextJobs, nextApplications, nextStudents] = await Promise.all([
          fetchMyJobs(true),
          fetchApplications(true),
          fetchStudents("", true),
        ]);
        setJobs(nextJobs);
        setApplications(nextApplications);
        setStudents(nextStudents);
      }
    } catch (loadError: any) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (approved) return;
    const approvalPoll = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(approvalPoll);
  }, [approved]);
  useEffect(() => {
    const openJobForm = () => {
      setShowJobForm(true);
      window.setTimeout(
        () =>
          document
            .getElementById("new-job-form")
            ?.scrollIntoView({ behavior: "smooth" }),
        0,
      );
    };
    window.addEventListener("jobportal:post-job", openJobForm);
    return () => window.removeEventListener("jobportal:post-job", openJobForm);
  }, []);

  const saveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const website = String(data.get("website") || "").trim();
    if (website && !/^https?:\/\//i.test(website))
      data.set("website", `https://${website}`);
    setError("");
    setSuccess("");
    setIsSavingCompany(true);
    try {
      setCompany(await updateCompany(data));
      await load();
      setSuccess("Company profile saved successfully.");
    } catch (saveError: any) {
      setError(saveError.message);
    } finally {
      setIsSavingCompany(false);
    }
  };

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
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      {!approved && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Approval pending
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#001142]">
            Complete your company profile
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
        <header className="cm-workspace-header"><div><p className="cm-eyebrow">RECRUITER WORKSPACE</p><h1>Make your next great hire.</h1><p>{company.name} · Your jobs, candidates and campus talent in one place.</p></div><span className="cm-approved-tag"><Check size={15} aria-hidden="true" />Account approved</span></header>
        <div className="cm-workspace-stats">
          <a href="#posted-jobs"><BriefcaseBusiness aria-hidden="true" /><div><strong>{jobs.length}</strong><span>Job listings</span></div></a>
          <a href="#candidate-applications"><FileText aria-hidden="true" /><div><strong>{applications.length}</strong><span>Applications</span></div></a>
          <a href="#candidate-applications"><Users aria-hidden="true" /><div><strong>{applications.filter((application) => application.status === "submitted").length}</strong><span>Awaiting review</span></div></a>
        </div>
        <nav className="cm-workspace-nav" aria-label="Recruiter sections"><a href="#posted-jobs">Job listings</a><a href="#candidate-applications">Applications</a><a href="#student-talent">Talent directory</a></nav>
      </div>}

      {!approved && (
        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#001142]">Company Profile</h2>
          <form
            onSubmit={saveCompany}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            {[
              ["name", "Company name"],
              ["website", "Website"],
              ["industry", "Industry"],
              ["location", "Location"],
              ["contact_email", "Contact email"],
            ].map(([name, label]) => (
              <label
                key={name}
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                {label}
                <input
                  name={name}
                  type={name === "contact_email" ? "email" : "text"}
                  defaultValue={company[name] || ""}
                  required={name === "name" || name === "contact_email"}
                  placeholder={
                    name === "website"
                      ? "example.com or https://example.com"
                      : undefined
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-normal normal-case text-[#001142]"
                />
              </label>
            ))}
            <label className="md:col-span-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Description
              <textarea
                name="description"
                defaultValue={company.description || ""}
                rows={4}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-normal normal-case text-[#001142]"
              />
            </label>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={isSavingCompany}
                className="rounded-lg bg-[#016a61] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingCompany ? "Saving…" : "Save company"}
              </button>
              {!approved && (
                <button
                  type="button"
                  onClick={async () => {
                    await resubmitCompany();
                    await load();
                  }}
                  className="rounded-lg border border-[#016a61] px-5 py-3 text-sm font-bold text-[#016a61]"
                >
                  Resubmit approval
                </button>
              )}
            </div>
          </form>
        </section>
      )}

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
                  min="1"
                  required
                  placeholder="Minimum MMK/month"
                  className="rounded-lg border p-3"
                />
                <input
                  name="compensation_max"
                  aria-label="Maximum compensation in MMK per month"
                  type="number"
                  min="1"
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
            <table className="mt-5 min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3">Candidate</th>
                  <th>University</th>
                  <th>Job</th>
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

          <section id="student-talent" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#001142]">
              Student Talent Directory
            </h2>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setStudents(await fetchStudents(studentSearch, true));
              }}
              className="cm-talent-search mt-4 flex gap-2"
            >
              <input
                value={studentSearch}
                aria-label="Search students by name, university or skill"
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search name, university, or skill"
                className="flex-1 rounded-lg border p-3"
              />
              <button className="rounded-lg bg-[#001142] px-5 text-white">
                Search
              </button>
            </form>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {students.map((student) => (
                <article key={student.id} className="rounded-xl border p-4">
                  <h3 className="font-bold text-[#001142]">{student.name}</h3>
                  <p className="text-sm text-slate-500">
                    {student.university} · {student.graduation_year}
                  </p>
                  <p className="mt-2 text-xs text-[#425aa6]">
                    {student.skills.join(", ")}
                  </p>
                  <a
                    href={`/api/v1/students/${student.id}/resume/`}
                    className="mt-3 inline-block text-sm font-bold text-[#016a61]"
                  >
                    Download résumé
                  </a>
                </article>
              ))}
            </div>
            {!students.length && <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">{studentSearch ? "No students match your search. Try a different name, university or skill." : "Student profiles will appear here when they are available."}</p>}
          </section>
        </>
      )}
    </main>
  );
}
