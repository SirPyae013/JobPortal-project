import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, CircleAlert, Clock3, FileText, GraduationCap, Search, SlidersHorizontal, X } from "lucide-react";
import type { Job } from "../../types";
import { fetchJobs, fetchStudentApplications } from "../../services/api";
import { selectJobs, type JobSort } from "./jobs";

const jobTypes = ["Internship", "Part-Time", "Full-Time", "Remote"];

export interface StudentViewProps {
  isLoggedIn: boolean;
  onOpenLogin: (mode?: "login" | "register") => void;
  onOpenApplication: (job: Job) => void;
  applicationRevision?: number;
}

function postedDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function StudentView({ isLoggedIn, onOpenLogin, onOpenApplication, applicationRevision = 0 }: StudentViewProps) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [sort, setSort] = useState<JobSort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchJobs(undefined, true).then((result) => { if (!cancelled) setJobs(result); })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    setAppliedIds(new Set());
    if (isLoggedIn) {
      fetchStudentApplications(undefined, true).then((applications) => {
        if (!cancelled) setAppliedIds(new Set(applications.map((application) => String(application.job_details?.id)).filter((id) => id !== "undefined")));
      }).catch(() => { /* An unavailable application history must not block browsing. */ });
    }
    return () => { cancelled = true; };
  }, [isLoggedIn, applicationRevision]);

  const filteredJobs = useMemo(() => selectJobs(jobs, search, types, industry, sort), [jobs, search, types, industry, sort]);
  const industries = useMemo(() => [...new Set(jobs.map((job) => job.industry).filter(Boolean))].sort(), [jobs]);
  const filterCount = types.length + Number(Boolean(industry));
  const hasFilters = Boolean(filterCount || search);
  const toggleType = (type: string) => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  const reset = () => { setTypes([]); setIndustry(""); setQuery(""); setSearch(""); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(query.trim()); };

  return (
    <main id="main-content" tabIndex={-1} className="cm-main">
      <section className="cm-discovery">
        <div className="cm-container">
          <div className="cm-intro-row">
            <div>
              <p className="cm-eyebrow"><span /> MYANMAR · STUDENTS & GRADUATES</p>
              <h1>Your next chapter <span>starts here.</span></h1>
              <p className="cm-intro-copy">Find internships, part-time work and your first graduate role.</p>
            </div>
            <div className="cm-intro-note"><GraduationCap size={25} strokeWidth={1.5} aria-hidden="true" /><span>From campus<br /><strong>to your next opportunity.</strong></span></div>
          </div>
          <form className="cm-search" role="search" onSubmit={submitSearch}>
            <Search size={22} aria-hidden="true" />
            <label className="cm-sr-only" htmlFor="search-input-field">Search by job title, company or skill</label>
            <input id="search-input-field" type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value) setSearch(""); }} placeholder="Job title, company or skill" />
            <button id="search-action-btn" type="submit" className="cm-button cm-primary">Find opportunities <ArrowRight size={18} aria-hidden="true" /></button>
          </form>
        </div>
      </section>

      <div className="cm-container cm-job-layout">
        <aside className="cm-filter-sidebar" aria-label="Filter opportunities">
          <button type="button" className="cm-mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="job-filters" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={18} aria-hidden="true" /> Filters{filterCount > 0 && <span className="cm-filter-count">{filterCount}</span>}<ChevronDown size={18} className={filtersOpen ? "cm-rotated" : ""} aria-hidden="true" /></button>
          <div id="job-filters" className={`cm-filter-panel${filtersOpen ? " is-open" : ""}`}>
            <div className="cm-filter-heading"><h2><SlidersHorizontal size={17} aria-hidden="true" /> Filters</h2><button type="button" onClick={reset} disabled={!hasFilters}>Reset</button></div>
            <fieldset><legend>Job type</legend>
              {jobTypes.map((type) => <label className="cm-checkbox-row" key={type}><input type="checkbox" checked={types.includes(type)} onChange={() => toggleType(type)} /><span>{type === "Part-Time" ? "Part-time" : type === "Full-Time" ? "Full-time" : type}</span><span className="cm-type-count">{loading || error ? "–" : jobs.filter((job) => job.jobType === type).length}</span></label>)}
            </fieldset>
            {industries.length > 0 && <fieldset><legend>Field of work</legend><label className="cm-sr-only" htmlFor="industry-filter">Field of work</label><select id="industry-filter" value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">All fields</option>{industries.map((value) => <option key={value}>{value}</option>)}</select></fieldset>}
            <p className="cm-filter-hint">Select more than one job type to explore your options.</p>
          </div>
          <div className="cm-application-tip"><FileText size={22} aria-hidden="true" /><h3>A little preparation goes a long way.</h3><p>Keep your profile and PDF résumé ready for your next application.</p>{!isLoggedIn && <button type="button" onClick={() => onOpenLogin("register")}>Create your profile <ArrowRight size={16} aria-hidden="true" /></button>}</div>
        </aside>

        <section className="cm-results" aria-labelledby="opportunities-heading" aria-busy={loading}>
          <div className="cm-results-heading"><div><p className="cm-section-kicker">TAKE THE NEXT STEP</p><h2 id="opportunities-heading">Explore opportunities <span>{!loading && !error ? filteredJobs.length : ""}</span></h2></div><div className="cm-sort"><label htmlFor="job-sort">Sort by</label><select id="job-sort" value={sort} onChange={(event) => setSort(event.target.value as JobSort)}><option value="newest">Newest first</option><option value="salary">Highest compensation</option><option value="title">Job title A–Z</option></select></div></div>
          <p className="cm-sr-only" role="status">{loading ? "Loading opportunities" : error ? "Unable to load opportunities" : `${filteredJobs.length} opportunities found`}</p>
          {hasFilters && <div className="cm-active-filters" aria-label="Active filters">{search && <button type="button" onClick={() => { setQuery(""); setSearch(""); }} aria-label={`Remove search: ${search}`}>“{search}” <X size={14} aria-hidden="true" /></button>}{types.map((type) => <button type="button" key={type} onClick={() => toggleType(type)} aria-label={`Remove ${type} filter`}>{type} <X size={14} aria-hidden="true" /></button>)}{industry && <button type="button" onClick={() => setIndustry("")} aria-label={`Remove ${industry} filter`}>{industry} <X size={14} aria-hidden="true" /></button>}</div>}
          {loading ? <div className="cm-loading" role="status"><span className="cm-loading-spinner" /><p>Finding your next opportunity…</p></div> : error ? <div className="cm-empty cm-error" role="alert"><CircleAlert size={30} aria-hidden="true" /><h3>We couldn’t load the jobs.</h3><p>{error}</p><button type="button" className="cm-button cm-primary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : filteredJobs.length === 0 ? <div className="cm-empty"><Search size={32} aria-hidden="true" /><h3>{hasFilters ? "Let’s broaden your search." : "New opportunities are on their way."}</h3><p>{hasFilters ? "Try a different keyword or remove a filter to see more roles." : "There are no open roles right now. Check back soon for new listings."}</p>{hasFilters && <button type="button" className="cm-button cm-primary" onClick={reset}>Clear all filters</button>}</div> : <div className="cm-job-grid">{filteredJobs.map((job) => {
            const applied = appliedIds.has(String(job.id));
            const date = postedDate(job.createdAt);
            return <article key={job.id} className="cm-job-card">
              <div className="cm-card-top"><div className="cm-company-monogram" aria-hidden="true">{job.company.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><span className={`cm-job-type${job.jobType === "Internship" ? " cm-type-internship" : ""}`}>{job.jobType}</span></div>
              <div className="cm-job-title"><p>{job.company}</p><h3>{job.title}</h3></div>
              <div className="cm-job-meta">{job.industry && <span><BriefcaseBusiness size={15} aria-hidden="true" />{job.industry}</span>}{date && <span><Clock3 size={15} aria-hidden="true" /><time dateTime={job.createdAt}>Posted {date}</time></span>}</div>
              {job.skills.length > 0 && <ul className="cm-skills" aria-label="Skills">{job.skills.slice(0, 4).map((skill) => <li key={skill}>{skill}</li>)}{job.skills.length > 4 && <li>+{job.skills.length - 4} more</li>}</ul>}
              <details className="cm-role-details"><summary>Role details <ChevronDown size={15} aria-hidden="true" /></summary><div><p>{job.description || "No additional role description has been provided."}</p>{job.skills.length > 4 && <p><strong>All skills:</strong> {job.skills.join(", ")}</p>}<p className="cm-requirements">{job.resumeRequired ? "PDF résumé required" : "Résumé optional"}{job.coverLetterRequired ? " · Cover letter required" : ""}</p></div></details>
              <div className="cm-card-footer"><div className="cm-compensation"><span>Compensation</span><strong>{job.compensation || "Not specified"}</strong></div><button id={`apply-btn-job-${job.id}`} type="button" disabled={applied} className={`cm-button ${applied ? "cm-applied" : "cm-apply"}`} aria-label={applied ? `Applied to ${job.title}` : `Apply for ${job.title}`} onClick={() => isLoggedIn ? onOpenApplication(job) : onOpenLogin("login")}>{applied ? <>Applied <Check size={16} aria-hidden="true" /></> : <>Apply <ArrowRight size={16} aria-hidden="true" /></>}</button></div>
            </article>;
          })}</div>}
        </section>
      </div>
      <footer className="cm-footer cm-container"><span>JobPortal <span>·</span> Campus to career</span><p>Built for the next generation of Myanmar talent.</p></footer>
    </main>
  );
}
