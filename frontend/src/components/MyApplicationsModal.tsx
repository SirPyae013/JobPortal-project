/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Briefcase, Loader2, CircleAlert } from "lucide-react";
import { fetchStudentApplications, withdrawApplication, type StudentApplication } from "../services/api";

interface MyApplicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700 border-amber-100",
  under_review: "bg-blue-50 text-blue-700 border-blue-100",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-red-50 text-red-700 border-red-100",
  withdrawn: "bg-slate-50 text-slate-700 border-slate-100",
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Submitted: "bg-amber-50 text-amber-700 border-amber-100",
  Reviewed: "bg-blue-50 text-blue-700 border-blue-100",
  "Under Review": "bg-blue-50 text-blue-700 border-blue-100",
  Shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Rejected: "bg-red-50 text-red-700 border-red-100",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function MyApplicationsModal({
  isOpen,
  onClose,
}: MyApplicationsModalProps) {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const loadApplications = async () => {
      setLoading(true);
      setError("");

      try {
        setApplications(await fetchStudentApplications(controller.signal));
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError(err?.message || "Failed to load applications");
        }
      } finally {
        setLoading(false);
      }
    };

    loadApplications();

    return () => controller.abort();
  }, [isOpen]);

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
            className="relative z-10 w-full max-w-3xl rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden max-h-[90vh]"
          >
            <div className="h-2 bg-[#016a61]" />

            <div className="p-8 overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-[#001142]">
                    My Applications
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Track the status of every role you have applied for
                  </p>
                </div>
                <button
                  id="close-applications-modal"
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loading && (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#016a61]" />
                  <p className="text-sm font-medium">Loading applications...</p>
                </div>
              )}

              {!loading && error && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && applications.length === 0 && (
                <div className="py-16 text-center text-slate-500">
                  <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium">You haven't applied to any jobs yet.</p>
                </div>
              )}

              {!loading && !error && applications.length > 0 && (
                <div className="space-y-3">
                  {applications.map((application) => {
                    const title =
                      application.job?.title || application.job_details?.title || application.title || "Untitled Role";
                    const company =
                      application.job?.company || application.job_details?.company_name || application.company || "Unknown Company";
                    const appliedAt = application.submitted_at || application.created_at;
                    const badgeClass =
                      STATUS_STYLES[application.status] ||
                      "bg-slate-50 text-slate-700 border-slate-100";

                    return (
                      <div
                        key={application.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-[#eff4ff] text-[#001142] flex items-center justify-center shrink-0">
                              <Briefcase className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#001142] truncate">
                                {title}
                              </p>
                              <p className="text-sm text-slate-500 truncate">
                                {company}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                Date Applied: {formatDate(appliedAt)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold border px-3 py-1.5 rounded-full ${badgeClass}`}
                          >
                            {application.status}
                          </span>
                          {(application.status === "submitted" || application.status === "under_review") && (
                            <button type="button" onClick={async () => { await withdrawApplication(application.id); setApplications((items) => items.map((item) => item.id === application.id ? {...item, status: "withdrawn"} : item)); }} className="text-xs font-bold text-red-600">Withdraw</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
