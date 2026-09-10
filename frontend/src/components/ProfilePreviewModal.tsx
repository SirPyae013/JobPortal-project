import { AnimatePresence, motion } from "motion/react";
import { BriefcaseBusiness, FileText, GraduationCap, UserRound, X } from "lucide-react";

export interface ProfilePreview {
  photoUrl: string;
  name: string;
  university: string;
  graduationYear: string;
  bio: string;
  skills: string[];
  experience: string;
  resumeUrl: string;
}

interface ProfilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  profile: ProfilePreview;
}

export default function ProfilePreviewModal({
  isOpen,
  onClose,
  onEdit,
  profile,
}: ProfilePreviewModalProps) {
  const education = [profile.university, profile.graduationYear]
    .filter(Boolean)
    .join(" · ");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#001142]/50 backdrop-blur-sm"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-preview-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
          >
            <div className="h-2 bg-[#016a61]" />
            <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#016a61]">
                    Recruiter view
                  </p>
                  <h2 id="profile-preview-title" className="mt-1 text-2xl font-bold text-[#001142]">
                    Public Profile Preview
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close profile preview"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-7">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#001142] text-white">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={`${profile.name || "Student"}'s profile`} className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#001142]">
                      {profile.name || "Your Name"}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <GraduationCap className="h-4 w-4 text-[#016a61]" />
                      {education || "University and graduation year not provided"}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 pt-6">
                  <PreviewSection title="About">
                    <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                      {profile.bio || "No bio provided yet."}
                    </p>
                  </PreviewSection>

                  <PreviewSection title="Skills">
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.length ? profile.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-[#016a61]/10 px-3 py-1.5 text-xs font-semibold text-[#016a61]">
                          {skill}
                        </span>
                      )) : <p className="text-sm text-slate-500">No skills provided yet.</p>}
                    </div>
                  </PreviewSection>

                  <PreviewSection title="Work Experience">
                    <div className="flex gap-3 text-sm leading-6 text-slate-600">
                      <BriefcaseBusiness className="mt-1 h-4 w-4 shrink-0 text-[#016a61]" />
                      <p className="whitespace-pre-line">{profile.experience || "No work experience provided yet."}</p>
                    </div>
                  </PreviewSection>

                  {profile.resumeUrl && (
                    <a
                      href={profile.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#016a61] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#005049]"
                    >
                      <FileText className="h-4 w-4" /> View Resume
                    </a>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="rounded-lg border border-[#016a61] px-4 py-2.5 text-sm font-semibold text-[#016a61] transition-colors hover:bg-[#016a61]/5"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#001142]">{title}</h4>
      {children}
    </section>
  );
}
