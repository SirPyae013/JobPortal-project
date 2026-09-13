import type { Job } from "../../types";

export type JobSort = "newest" | "salary" | "title";

export function selectJobs(jobs: Job[], query: string, types: string[], industry: string, sort: JobSort): Job[] {
  const normalized = query.trim().toLocaleLowerCase();
  const result = jobs.filter((job) => {
    const matchesQuery = !normalized || [job.title, job.company, ...job.skills].some((value) => value.toLocaleLowerCase().includes(normalized));
    return matchesQuery && (!types.length || types.includes(job.jobType)) && (!industry || industry === job.industry);
  });
  const timestamp = (job: Job) => Date.parse(job.createdAt || "") || 0;
  const salary = (job: Job) => Number(job.compensationMin) || Number(job.compensation?.replaceAll(",", "").match(/\d+(?:\.\d+)?/)?.[0]) || 0;
  return result.sort((a, b) => sort === "salary" ? salary(b) - salary(a) : sort === "title" ? a.title.localeCompare(b.title) : timestamp(b) - timestamp(a));
}
