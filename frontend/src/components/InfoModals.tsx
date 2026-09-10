/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  CheckCircle2,
  Bookmark,
  Lightbulb,
  Users,
  Globe,
} from "lucide-react";

interface InfoModalProps {
  isOpen: boolean;
  type: "about" | "contact";
  onClose: () => void;
}

export default function InfoModals({ isOpen, type, onClose }: InfoModalProps) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [subject, setSubject] = useState("General Inquiry");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !message) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#001142]/40 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 z-10 flex flex-col max-h-[90vh]"
          >
            {/* Top decorative bar */}
            <div className="h-2 bg-[#016a61] shrink-0" />

            <div className="p-6 md:p-8 overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-[#001142]">
                    {type === "about" ? "About Job Portal" : "Get in Touch"}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {type === "about"
                      ? "Bridging academic ambition and corporate careers"
                      : "We love to hear from students, universities, and stellar startups"}
                  </p>
                </div>
                <button
                  id="close-info-modal"
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {type === "about" ? (
                /* About Us View */
                <div className="space-y-6 text-slate-600 text-sm leading-relaxed">
                  <p>
                    <strong>Job Portal</strong> is a leading-edge academic
                    bridge platform constructed precisely to address the
                    critical transition from classroom theory to practical,
                    high-impact enterprise experience.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center gap-2 text-[#001142] font-semibold">
                        <Users className="w-4 h-4 text-[#016a61]" />
                        <span>Curated Internships</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Hand-vetted tech-startup programs and blue-chip company
                        internships engineered around proper educational values.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center gap-2 text-[#001142] font-semibold">
                        <Lightbulb className="w-4 h-4 text-[#016a61]" />
                        <span>Sustained Growth</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Structured career-track pathways focused on software
                        development, product engineering, design and business
                        metrics.
                      </p>
                    </div>
                  </div>

                  <p className="pt-2 border-t border-slate-100">
                    Our platform empowers hundreds of universities worldwide to
                    map student competencies directly into verified vacancies.
                    By consolidating applications, templates, and resume
                    parameters, we cut average hire cycles by up to 60%.
                  </p>

                  <div className="bg-[#eff4ff]/60 border border-[#d3e4fe]/50 rounded-xl p-4 flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#425aa6] shrink-0" />
                    <span className="text-xs text-[#001142] font-medium">
                      Operational in 12+ regions, coordinating over 80,000
                      active student placements annually.
                    </span>
                  </div>

                  <button
                    id="close-about-btn"
                    onClick={onClose}
                    className="w-full mt-4 py-3 bg-[#001142] hover:bg-[#0b1c30] text-white text-sm font-semibold rounded-lg transition-all"
                  >
                    Return to Job Board
                  </button>
                </div>
              ) : (
                /* Contact Form View */
                <div>
                  {!submitted ? (
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                          Your Full Name
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g. Liam Sterling"
                          className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                            Institutional Email
                          </label>
                          <input
                            id="contact-email"
                            type="email"
                            required
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="liam@school.edu"
                            className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                            Query Category
                          </label>
                          <select
                            id="contact-subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                          >
                            <option value="General Inquiry">
                              General Inquiry
                            </option>
                            <option value="Recruitment Partnership">
                              Recruiter Account
                            </option>
                            <option value="Technical Support">
                              Technical Help
                            </option>
                            <option value="University Liaison">
                              University Partnerships
                            </option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                          Detailed Message
                        </label>
                        <textarea
                          id="contact-message"
                          required
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Please let us know how we can coordinate with your career office..."
                          rows={4}
                          className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50 resize-none"
                        />
                      </div>

                      <button
                        id="submit-contact-btn"
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-[#016a61] hover:bg-[#005049] text-white font-medium text-sm py-3 rounded-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all text-center mt-6 cursor-pointer"
                      >
                        {submitting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Transmit Message</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* Contact Submitted Success View */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-8 text-center space-y-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-[#9defe3]/30 text-[#016a61] flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h4 className="text-xl font-bold text-[#001142]">
                        Inquiry Dispatched Successfully
                      </h4>
                      <p className="text-sm text-slate-500 max-w-sm">
                        Thank you for reaching out,{" "}
                        <strong>{contactName}</strong>. A coordination team
                        member will analyze your request and follow up at{" "}
                        <strong>{contactEmail}</strong>.
                      </p>
                      <button
                        id="close-contact-success"
                        onClick={() => {
                          setSubmitted(false);
                          setContactName("");
                          setContactEmail("");
                          setMessage("");
                          onClose();
                        }}
                        className="mt-4 px-6 py-2.5 bg-[#001142] hover:bg-[#0b1c30] text-white text-sm font-semibold rounded-lg transition-all"
                      >
                        Acknowledge
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
