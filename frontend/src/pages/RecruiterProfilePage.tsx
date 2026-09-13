import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, Check, UserRound } from "lucide-react";
import {
  fetchCompany, fetchRecruiterProfile, resubmitCompany, updateCompany, updateRecruiterProfile,
  type Company, type RecruiterProfile,
} from "../services/api";

interface Props {
  onBack: () => void;
  onProfileSaved: (profile: RecruiterProfile) => void;
  onCompanySaved: (company: Company) => void;
}

const inputClass = "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-[#001142]";
const labelClass = "text-sm font-semibold text-slate-600";
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unable to save your changes. Please try again.";

export default function RecruiterProfilePage({ onBack, onProfileSaved, onCompanySaved }: Props) {
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [savedProfile, setSavedProfile] = useState<RecruiterProfile | null>(null);
  const [savedCompany, setSavedCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [profileError, setProfileError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [companySuccess, setCompanySuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    Promise.all([fetchRecruiterProfile(controller.signal), fetchCompany(controller.signal)])
      .then(([nextProfile, nextCompany]) => {
        if (controller.signal.aborted) return;
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
        setCompany(nextCompany);
        setSavedCompany(nextCompany);
      })
      .catch(error => { if (!controller.signal.aborted) setLoadError(errorMessage(error)); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!logo) { setLogoPreview(""); return; }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || savingProfile) return;
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const updated = await updateRecruiterProfile({ name: profile.name.trim(), job_title: profile.job_title.trim(), phone: profile.phone.trim(), bio: profile.bio.trim() }, photo || undefined);
      setProfile(updated);
      setSavedProfile(updated);
      setPhoto(null);
      if (photoInput.current) photoInput.current.value = "";
      onProfileSaved(updated);
      setProfileSuccess("Recruiter details saved.");
    } catch (error) { setProfileError(errorMessage(error)); }
    finally { setSavingProfile(false); }
  };

  const saveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company || savingCompany) return;
    setSavingCompany(true);
    setCompanyError("");
    setCompanySuccess("");
    const form = new FormData();
    for (const field of ["name", "website", "industry", "location", "contact_email", "description"] as const) {
      let value = company[field].trim();
      if (field === "website" && value && !/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
      form.set(field, value);
    }
    if (logo) form.set("logo", logo);
    try {
      const updated = await updateCompany(form);
      setCompany(updated);
      setSavedCompany(updated);
      setLogo(null);
      if (logoInput.current) logoInput.current.value = "";
      onCompanySaved(updated);
      setCompanySuccess(savedCompany?.approval_status === "approved" && updated.approval_status === "pending"
        ? "Company saved and sent for review. Hiring tools will be available again after approval."
        : "Company profile saved.");
    } catch (error) { setCompanyError(errorMessage(error)); }
    finally { setSavingCompany(false); }
  };

  const requestReview = async () => {
    setResubmitting(true);
    setReviewError("");
    setReviewMessage("");
    try {
      await resubmitCompany();
      const [nextProfile, nextCompany] = await Promise.all([fetchRecruiterProfile(), fetchCompany()]);
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setCompany(nextCompany);
      setSavedCompany(nextCompany);
      onProfileSaved(nextProfile);
      onCompanySaved(nextCompany);
      setReviewMessage("Your profile has been resubmitted for review.");
    } catch (error) { setReviewError(errorMessage(error)); }
    finally { setResubmitting(false); }
  };

  if (!profile || !company || !savedProfile || !savedCompany) return (
    <main id="main-content" tabIndex={-1} className="cm-recruiter mx-auto flex-1">
      {loadError ? <div role="alert" className="space-y-4"><p>{loadError}</p><button type="button" className="cm-button cm-primary" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : <p role="status">Loading your recruiter profile...</p>}
    </main>
  );

  const rejected = savedProfile.approval_status === "rejected" || savedCompany.approval_status === "rejected";
  const approved = savedProfile.approval_status === "approved" && savedCompany.approval_status === "approved";
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile) || JSON.stringify(company) !== JSON.stringify(savedCompany) || Boolean(logo) || Boolean(photo);
  const identityChanged = savedCompany.approval_status === "approved" && (
    company.name.trim() !== savedCompany.name ||
    (company.website.trim() && !/^[a-z][a-z\d+.-]*:/i.test(company.website.trim()) ? `https://${company.website.trim()}` : company.website.trim()) !== savedCompany.website
  );

  return (
    <main id="main-content" tabIndex={-1} className="cm-recruiter cm-profile-page mx-auto flex-1 space-y-7">
      <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-[#016a61]" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to workspace</button>
      <header className="cm-workspace-header">
        <div><p className="cm-eyebrow">YOUR RECRUITER ACCOUNT</p><h1>Recruiter profile</h1><p>Introduce yourself and help students get to know your company.</p></div>
        {approved && <span className="cm-approved-tag"><Check size={15} aria-hidden="true" />Account approved</span>}
      </header>

      <div className="cm-profile-layout">
        <aside className="cm-profile-summary bg-white rounded-2xl border border-slate-200 p-6">
          <div className="cm-profile-logo">{savedCompany.logo_url ? <img src={savedCompany.logo_url} alt={`${savedCompany.name} logo`} /> : <Building2 size={32} aria-hidden="true" />}</div>
          <h2 className="mt-4 text-xl font-bold text-[#001142] break-words">{savedCompany.name}</h2>
          <p className="mt-1 text-sm text-slate-500 break-words">{[savedCompany.industry, savedCompany.location].filter(Boolean).join(" · ") || "Add your company details below."}</p>
          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="cm-profile-photo mb-3">{savedProfile.photo_url ? <img src={savedProfile.photo_url} alt={`${savedProfile.name}'s profile photo`} /> : <UserRound size={28} aria-hidden="true" />}</div>
            <p className="font-semibold text-[#001142] break-words">{savedProfile.name}</p>
            <p className="mt-1 text-sm text-slate-500 break-words">{savedProfile.job_title || "Recruiter"}</p>
            <p className="mt-2 text-sm text-slate-500 break-all">{savedProfile.email}</p>
          </div>
          <dl className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Recruiter review</dt><dd className="font-semibold capitalize">{savedProfile.approval_status}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Company review</dt><dd className="font-semibold capitalize">{savedCompany.approval_status}</dd></div>
          </dl>
          {!approved && <p className="mt-4 text-sm text-slate-500">You can build your profile while your account is under review. Both approvals are needed to post jobs and browse talent.</p>}
          {savedProfile.rejection_reason && <p className="mt-3 text-sm text-red-600">Recruiter: {savedProfile.rejection_reason}</p>}
          {savedCompany.rejection_reason && <p className="mt-3 text-sm text-red-600">Company: {savedCompany.rejection_reason}</p>}
          {rejected && <div className="mt-4 space-y-3"><p className="text-sm text-slate-500">Save your changes, then request another review.</p><button type="button" className="cm-button cm-primary w-full" disabled={dirty || savingProfile || savingCompany || resubmitting} onClick={requestReview}>{resubmitting ? "Submitting..." : "Resubmit for approval"}</button></div>}
          {reviewMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{reviewMessage}</p>}
          {reviewError && <p role="alert" className="mt-3 text-sm text-red-600">{reviewError}</p>}
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7" aria-labelledby="recruiter-details-heading">
            <h2 id="recruiter-details-heading" className="flex items-center gap-3 text-xl font-bold text-[#001142]"><UserRound size={21} aria-hidden="true" />Recruiter details</h2>
            <p className="mt-2 text-sm text-slate-500">Your name, role and a little about the people you hire.</p>
            <form onSubmit={saveProfile} className="mt-6">
              <fieldset disabled={savingProfile || resubmitting} className="grid min-w-0 gap-5 sm:grid-cols-2">
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <div className="cm-profile-photo">{photoPreview || profile.photo_url ? <img src={photoPreview || profile.photo_url || ""} alt="Recruiter profile photo preview" /> : <UserRound size={32} aria-hidden="true" />}</div>
                  <div className="min-w-0 flex-1">
                    <label className={labelClass} htmlFor="recruiter-photo">Profile photo</label>
                    <input id="recruiter-photo" ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="recruiter-photo-help" className="mt-2 block w-full text-xs" onChange={event => {
                      const file = event.target.files?.[0];
                      setProfileError("");
                      setProfileSuccess("");
                      if (!file) { setPhoto(null); return; }
                      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
                        setProfileError("Choose a PNG, JPG or WebP profile photo up to 2 MB.");
                        event.target.value = "";
                        setPhoto(null);
                        return;
                      }
                      setPhoto(file);
                    }} />
                    <p id="recruiter-photo-help" className="mt-2 text-xs text-slate-500">PNG, JPG or WebP. Maximum 2 MB. Save recruiter details to update your photo.</p>
                    {photo && <button type="button" className="mt-2 text-xs font-semibold text-[#016a61]" onClick={() => { setPhoto(null); if (photoInput.current) photoInput.current.value = ""; }}>Cancel photo change</button>}
                  </div>
                </div>
                <label className={labelClass}>Full name <span aria-hidden="true">*</span><input required maxLength={255} autoComplete="name" className={inputClass} value={profile.name} onChange={event => { setProfile({ ...profile, name: event.target.value }); setProfileSuccess(""); }} /></label>
                <label className={labelClass}>Job title<input maxLength={120} autoComplete="organization-title" placeholder="e.g. Talent Acquisition Manager" className={inputClass} value={profile.job_title} onChange={event => { setProfile({ ...profile, job_title: event.target.value }); setProfileSuccess(""); }} /></label>
                <label className={labelClass}>Account email<input type="email" readOnly value={profile.email} className={`${inputClass} bg-slate-50`} /><span className="mt-2 block text-xs font-normal text-slate-500">Your verified sign-in email.</span></label>
                <label className={labelClass}>Phone number<input type="tel" maxLength={40} autoComplete="tel" placeholder="e.g. +95 9 123 456 789" className={inputClass} value={profile.phone} onChange={event => { setProfile({ ...profile, phone: event.target.value }); setProfileSuccess(""); }} /></label>
                <label className={`${labelClass} sm:col-span-2`}>About you<textarea rows={4} placeholder="Tell us about your role, the teams you recruit for and what you look for in candidates." className={inputClass} value={profile.bio} onChange={event => { setProfile({ ...profile, bio: event.target.value }); setProfileSuccess(""); }} /></label>
                <div className="sm:col-span-2 space-y-3">
                  {profileError && <p role="alert" className="text-sm text-red-600">{profileError}</p>}
                  {profileSuccess && <p role="status" className="text-sm text-emerald-700">{profileSuccess}</p>}
                  <button type="submit" className="cm-button cm-primary">{savingProfile ? "Saving..." : "Save recruiter details"}</button>
                </div>
              </fieldset>
            </form>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7" aria-labelledby="company-details-heading">
            <h2 id="company-details-heading" className="flex items-center gap-3 text-xl font-bold text-[#001142]"><Building2 size={21} aria-hidden="true" />Company profile</h2>
            <p className="mt-2 text-sm text-slate-500">Build a clear picture of your company and where you work.</p>
            <form onSubmit={saveCompany} className="mt-6">
              <fieldset disabled={savingCompany || resubmitting} className="grid min-w-0 gap-5 sm:grid-cols-2">
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <div className="cm-profile-logo">{logoPreview || company.logo_url ? <img src={logoPreview || company.logo_url || ""} alt="Company logo preview" /> : <Building2 size={28} aria-hidden="true" />}</div>
                  <label className={`${labelClass} min-w-0 flex-1`}>Company logo<input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-xs font-normal" onChange={event => {
                    const file = event.target.files?.[0];
                    setCompanyError("");
                    setCompanySuccess("");
                    if (!file) { setLogo(null); return; }
                    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
                      setCompanyError("Choose a PNG, JPG or WebP image up to 2 MB.");
                      event.target.value = "";
                      setLogo(null);
                      return;
                    }
                    setLogo(file);
                  }} /><span className="mt-2 block text-xs font-normal text-slate-500">PNG, JPG or WebP. Maximum 2 MB.</span></label>
                </div>
                {([
                  ["name", "Company name", "e.g. Yangon Tech", 255],
                  ["website", "Website", "example.com or https://example.com", 200],
                  ["industry", "Industry", "e.g. Software & technology", 120],
                  ["location", "Location", "e.g. Yangon, Myanmar", 255],
                  ["contact_email", "Contact email", "careers@example.com", 254],
                ] as const).map(([field, label, placeholder, maxLength]) => <label key={field} className={labelClass}>{label}{(field === "name" || field === "contact_email") && <span aria-hidden="true"> *</span>}<input type={field === "contact_email" ? "email" : "text"} inputMode={field === "website" ? "url" : undefined} required={field === "name" || field === "contact_email"} maxLength={maxLength} className={inputClass} placeholder={placeholder} value={company[field]} onChange={event => { setCompany({ ...company, [field]: event.target.value }); setCompanySuccess(""); }} /></label>)}
                <label className={`${labelClass} sm:col-span-2`}>About the company<textarea rows={5} className={inputClass} placeholder="Describe what your company does, your culture and the opportunities you offer students." value={company.description} onChange={event => { setCompany({ ...company, description: event.target.value }); setCompanySuccess(""); }} /></label>
                <div className="sm:col-span-2 space-y-3">
                  {identityChanged && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">Changing your company name or website sends the company for review again. Hiring tools will pause until it is approved.</p>}
                  {companyError && <p role="alert" className="text-sm text-red-600">{companyError}</p>}
                  {companySuccess && <p role="status" className="text-sm text-emerald-700">{companySuccess}</p>}
                  <button type="submit" className="cm-button cm-primary">{savingCompany ? "Saving..." : "Save company profile"}</button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
