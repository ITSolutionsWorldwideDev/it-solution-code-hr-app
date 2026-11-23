import { apiRequest } from "@/lib/api/client";
import type { VacancyApiRecord } from "@/lib/recruitment-types";
import type { PortalJob } from "@/components/recruitment/portal-jobs-table";

/**
 * Ensures a portal job exists as a vacancy in the Talent Genie database.
 * If already existing (by title match), returns the existing vacancy.
 * Otherwise, creates a new open vacancy.
 */
export async function ensureVacancyFromPortalJob(
  job: PortalJob,
  existingVacancies?: VacancyApiRecord[]
): Promise<VacancyApiRecord> {
  const allVacancies =
    existingVacancies ?? (await apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" }));

  // Check if a vacancy with this title already exists
  const normalizedTitle = job.title.trim().toLowerCase();
  const existing = allVacancies.find(
    (v) => v.title.trim().toLowerCase() === normalizedTitle
  );
  if (existing) {
    return existing;
  }

  // Create clean description
  let description = job.description || "";
  // Strip HTML tags if content is HTML
  if (description.includes("<") && description.includes(">")) {
    description = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!description) {
    description = `${job.title} - Career portal position for ${job.portal_label}.`;
  }

  // Create vacancy in Talent Genie
  const created = await apiRequest<VacancyApiRecord>({
    path: "/vacancies/",
    method: "POST",
    body: JSON.stringify({
      title: job.title.trim(),
      description,
      required_skills: [job.portal_label, job.employment_type || "Full-time"].filter(Boolean),
      experience_level: job.experience_level || "MID",
      status: "open",
      department_id: 1,
      parsed_data: {
        location: job.location || "Not specified",
        employment_type: job.employment_type || "Full-time",
        source_portal: job.portal,
        portal_job_id: job.id,
        target_portal: job.portal,
        published: 1,
      },
    }),
  });

  return created;
}
