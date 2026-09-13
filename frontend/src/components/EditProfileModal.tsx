/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, FileText, Link, LoaderCircle, UserRound } from "lucide-react";
import { fetchStudentProfile } from "../services/api";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  onAuthRequired: () => void;
  onSave: (payload: {
    email: string;
    skills: string[];
    resumeUrl: string;
    resumeFile?: File;
    profilePhoto?: File;
    experience: string;
    bio: string;
    graduationYear: string;
  }) => Promise<void>;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  userEmail,
  onAuthRequired,
  onSave,
}: EditProfileModalProps) {
  const [skills, setSkills] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File>();
  const [profilePhoto, setProfilePhoto] = useState<File>();
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [experience, setExperience] = useState("");
  const [bio, setBio] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !userEmail) return;

    setError("");
    setResumeFile(undefined);
    setProfilePhoto(undefined);
    setIsLoading(true);
    fetchStudentProfile()
      .then((profile) => {
        setSkills(
          Array.isArray(profile.skills) ? profile.skills.join(", ") : "",
        );
        setResumeUrl(profile.has_resume ? "Saved private PDF" : "No saved resume");
        setPhotoPreviewUrl(profile.photo_url || "");
        setExperience(profile.experience || "");
        setBio(profile.bio || "");
        setGraduationYear(profile.graduation_year ? String(profile.graduation_year) : "");
      })
      .catch((loadError: Error) => {
        if (loadError.message === "AUTH_REQUIRED") {
          onAuthRequired();
          onClose();
          return;
        }
        setError(loadError.message);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, userEmail]);

  const handleResumeFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please attach a PDF resume.");
      setResumeFile(undefined);
      return;
    }
    setError("");
    setResumeFile(file);
  };

  const handleProfilePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file for your profile photo.");
      return;
    }
    setError("");
    setProfilePhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await onSave({
        email: userEmail,
        skills: skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        resumeUrl: resumeUrl.trim(),
        resumeFile,
        profilePhoto,
        experience: experience.trim(),
        bio: bio.trim(),
        graduationYear,
      });
      onClose();
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message === "AUTH_REQUIRED") {
        onAuthRequired();
        onClose();
        return;
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile.",
      );
    } finally {
      setIsSaving(false);
    }
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
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden"
          >
            <div className="h-2 bg-[#016a61]" />
            <form onSubmit={handleSubmit} className="p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-[#001142]">
                    Edit Profile
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Complete the portfolio details recruiters see
                  </p>
                </div>
                <button
                  id="close-edit-profile-modal"
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Loading profile...
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="relative shrink-0">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#eff4ff] text-[#001142] shadow-sm">
                          {photoPreviewUrl ? (
                            <img
                              src={photoPreviewUrl}
                              alt="Profile preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserRound className="h-9 w-9" />
                          )}
                        </div>
                        <label
                          htmlFor="profile-photo"
                          className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#016a61] text-white shadow-sm transition-colors hover:bg-[#005049]"
                          title="Change profile photo"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="sr-only">Change profile photo</span>
                        </label>
                        <input
                          id="profile-photo"
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhotoChange}
                          className="sr-only"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#001142]">Profile photo</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Add a clear photo so recruiters can recognize you.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="profile-graduation-year" className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">Graduation year</label>
                      <input id="profile-graduation-year" type="number" min="1900" max="2200" step="1" required value={graduationYear} onChange={event => setGraduationYear(event.target.value)} placeholder="2027" className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] bg-slate-50/50" />
                      <p className="mt-1 text-xs text-slate-500">Add your graduation year, bio, skills, and résumé to help recruiters understand your profile.</p>
                    </div>
                    <div>
                      <label
                        htmlFor="profile-skills"
                        className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2"
                      >
                        Skills
                      </label>
                      <input
                        id="profile-skills"
                        value={skills}
                        onChange={(event) => setSkills(event.target.value)}
                        placeholder="Python, React, PostgreSQL"
                        className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Separate each skill with a comma.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="profile-resume-url"
                        className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2"
                      >
                        Saved résumé
                      </label>
                      <div className="relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          id="profile-resume-url"
                          type="text"
                          disabled
                          value={resumeUrl}
                          onChange={(event) => setResumeUrl(event.target.value)}
                          placeholder="https://example.com/resume.pdf"
                          className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="profile-resume-file"
                        className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2"
                      >
                        Upload Resume (PDF)
                      </label>
                      <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2.5">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <input
                          id="profile-resume-file"
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={handleResumeFileChange}
                          className="min-w-0 flex-1 text-sm text-slate-500"
                        />
                      </div>
                      {resumeFile && (
                        <p className="mt-1 text-xs text-slate-400">
                          Selected: {resumeFile.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="profile-experience"
                        className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2"
                      >
                        Past Experience
                      </label>
                      <textarea
                        id="profile-experience"
                        value={experience}
                        onChange={(event) => setExperience(event.target.value)}
                        placeholder="Internships, projects, or work history"
                        rows={4}
                        className="w-full resize-y text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-bio"
                        className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2"
                      >
                        Bio / Overview
                      </label>
                      <textarea
                        id="profile-bio"
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="A short summary about your interests and goals"
                        rows={3}
                        className="w-full resize-y text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                      />
                    </div>
                  </>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || isSaving}
                    className="flex-1 px-4 py-3 rounded-lg bg-[#016a61] text-white text-sm font-semibold hover:bg-[#005049] transition-colors"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
