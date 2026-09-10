/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, DragEvent, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, FileText, CheckCircle, GraduationCap, Briefcase, DollarSign, Tag, Trash2, ArrowRight } from 'lucide-react';
import { Job, ApplicationInput } from '../types';
import { submitApplication } from '../services/api';

interface ApplicationModalProps {
  isOpen: boolean;
  job: Job | null;
  onClose: () => void;
  onApplySuccess: (jobId: string) => void;
  userEmail?: string;
  userName?: string;
}

export default function ApplicationModal({
  isOpen,
  job,
  onClose,
  onApplySuccess,
  userEmail = '',
  userName = '',
}: ApplicationModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states initialized with user parameters if logged in
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [university, setUniversity] = useState('');
  const [gradYear, setGradYear] = useState('2026');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeSource, setResumeSource] = useState<'profile' | 'upload' | 'none'>('profile');
  
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Synchronize name and email when modal is loaded or changes
  useState(() => {
    if (userName) setName(userName);
    if (userEmail) setEmail(userEmail);
  });

  if (!job) return null;

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') {
        setResumeFile(file);
        setResumeSource('upload');
        setError('');
      } else {
        setError('Unsupported file type. Please upload a PDF file.');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResumeFile(file);
      setResumeSource('upload');
      setError('');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setResumeFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (job.resumeRequired && resumeSource === 'none') return setError('This job requires a resume.');
    if (job.resumeRequired && resumeSource === 'upload' && !resumeFile) return setError('Please choose a PDF resume.');
    if (job.coverLetterRequired && !coverLetter.trim()) return setError('This job requires a cover letter.');

    setIsSubmitting(true);

    submitApplication({
      jobId: job.id,
      resumeSource,
      resumeFile: resumeFile || undefined,
      coverLetter,
    }).then(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      onApplySuccess(job.id);
    }).catch((submitError: Error) => {
      setIsSubmitting(false);
      setError(submitError.message);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end md:p-0 p-4">
          {/* Backdrop screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#001142]/40 backdrop-blur-sm"
          />

          {/* Slide Over Application Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden"
          >
            {/* Header branding line */}
            <div className="h-2 bg-[#016a61] shrink-0" />

            {/* Panel Title & Close header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-[#016a61] uppercase bg-[#016a61]/10 px-2.5 py-1 rounded-full">
                  Application Gate
                </span>
                <h3 className="text-xl font-bold text-[#001142] mt-2">
                  Apply to {job.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium">at {job.company}</p>
              </div>
              <button
                id="close-apply-panel"
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Panel Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              {!isSuccess ? (
                <>
                  {/* Job context summary box */}
                  <div className="bg-[#eff4ff]/60 border border-[#d3e4fe]/50 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-[#001142]">{job.title}</div>
                        <div className="text-xs text-[#016a61] font-medium">{job.company}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Compensation</div>
                        <div className="text-sm font-bold text-[#001142]">{job.compensation}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/40">
                      <span className="text-[11px] font-medium bg-[#eafaf7] text-[#016a61] px-2.5 py-0.5 rounded-full">
                        {job.jobType}
                      </span>
                      <span className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {job.industry}
                      </span>
                      {job.skills.map((skill) => (
                        <span key={skill} className="text-[11px] font-medium bg-[#eff4ff] text-[#425aa6] px-2 py-0.5 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">
                      {error}
                    </div>
                  )}

                  {/* Application inputs */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#001142]">Resume choice</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setResumeSource('profile')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${resumeSource === 'profile' ? 'bg-[#016a61] text-white' : 'bg-white text-slate-600 border'}`}>Use profile resume</button>
                        <button type="button" onClick={() => setResumeSource('upload')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${resumeSource === 'upload' ? 'bg-[#016a61] text-white' : 'bg-white text-slate-600 border'}`}>Upload another PDF</button>
                        {!job.resumeRequired && <button type="button" onClick={() => setResumeSource('none')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${resumeSource === 'none' ? 'bg-[#016a61] text-white' : 'bg-white text-slate-600 border'}`}>No resume</button>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                        Your Full Name
                      </label>
                      <input
                        id="applicant-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Liam Sterling"
                        className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                        Institutional Email Address
                      </label>
                      <input
                        id="applicant-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. liam.s@university.edu"
                        className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                          University / Institution
                        </label>
                        <input
                          id="applicant-university"
                          type="text"
                          required
                          value={university}
                          onChange={(e) => setUniversity(e.target.value)}
                          placeholder="e.g. Stanford University"
                          className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                          Expected Graduation Year
                        </label>
                        <select
                          id="applicant-grad-year"
                          value={gradYear}
                          onChange={(e) => setGradYear(e.target.value)}
                          className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50"
                        >
                          <option value="2025">2025</option>
                          <option value="2026">2026</option>
                          <option value="2027">2027</option>
                          <option value="2028">2028</option>
                          <option value="Postgraduate">Postgraduate</option>
                        </select>
                      </div>
                    </div>

                    {/* Drag-and-Drop Resume Box */}
                    <div>
                      <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                        Resume Upload (Required)
                      </label>
                      
                      {!resumeFile ? (
                        <div
                          id="resume-dropzone"
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={triggerFileInput}
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                            isDragActive
                              ? 'border-[#016a61] bg-[#eafaf7]/50'
                              : 'border-slate-200 hover:border-[#001142] bg-slate-50/20'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.docx,.doc"
                            className="hidden"
                          />
                          <div className="w-10 h-10 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#425aa6]">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-[#001142]">
                              Click to upload
                            </span>{' '}
                            <span className="text-sm text-slate-500">
                              or drag and drop your file here
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Acceptable formats: PDF, DOCX, DOC (Max: 8MB)
                          </span>
                        </div>
                      ) : (
                        <div className="p-4 bg-[#eafaf7]/40 border border-[#9defe3]/50 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#9defe3]/30 flex items-center justify-center text-[#016a61]">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="text-left overflow-hidden">
                              <span className="block text-sm font-semibold text-[#001142] truncate max-w-[280px]">
                                {resumeFile.name}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <button
                            id="remove-resume-file"
                            type="button"
                            onClick={removeFile}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                            title="Remove File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#001142] uppercase tracking-wider mb-2">
                        Cover Letter / Statement (Optional)
                      </label>
                      <textarea
                        id="applicant-cover-letter"
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Introduce yourself and tell the recruitment team why you are a perfect fit..."
                        rows={4}
                        className="w-full text-sm px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-[#001142] transition-all bg-slate-50/50 resize-none"
                      />
                    </div>

                    <button
                      id="submit-application-btn"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#016a61] hover:bg-[#005049] text-white font-semibold text-sm py-3.5 rounded-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer shadow-sm shadow-[#016a61]/10 mt-6"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Submit Application</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                /* Application Success State Card */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-6 h-full"
                >
                  <div className="w-20 h-20 rounded-full bg-[#9defe3]/40 text-[#016a61] flex items-center justify-center shadow-lg shadow-[#016a61]/5 animate-bounce">
                    <CheckCircle className="w-12 h-12" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-2xl font-bold text-[#001142]">Application Submitted!</h4>
                    <p className="text-sm font-medium text-[#016a61]">
                      Your application for {job.title} at {job.company} is safe.
                    </p>
                  </div>

                  <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                    We have successfully bridged your academic details and transmitted your verified resume directly to the HR portal at <strong>{job.company}</strong>. Keep an eye on your inbox!
                  </p>

                  <div className="pt-6 w-full max-w-xs space-y-3">
                    <button
                      id="close-success-summary"
                      onClick={onClose}
                      className="w-full py-3 bg-[#001142] hover:bg-[#0b1c30] text-white font-medium text-sm rounded-lg hover:scale-[1.01] transition-all cursor-pointer"
                    >
                      Browse More Roles
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
