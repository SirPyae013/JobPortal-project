export type UserRole = "student" | "recruiter" | "guest";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  email_verified: boolean;
  capabilities: {
    browse_jobs: boolean;
    apply: boolean;
    manage_jobs: boolean;
    browse_students: boolean;
  };
  profile: {
    name: string;
    photo_url?: string | null;
    is_complete?: boolean;
    approval_status?: string;
    rejection_reason?: string;
    company_approval_status?: string;
    company_rejection_reason?: string;
  } | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyId?: string;
  jobType: string;
  job_type?: string;
  industry: string;
  compensation: string;
  compensationMin?: number;
  compensationMax?: number | null;
  description?: string;
  skills: string[];
  is_active?: boolean;
  resumeRequired?: boolean;
  coverLetterRequired?: boolean;
  createdAt?: string;
}

export interface ApplicationInput {
  jobId: string;
  name: string;
  email: string;
  university: string;
  gradYear: string;
  coverLetter?: string;
}
