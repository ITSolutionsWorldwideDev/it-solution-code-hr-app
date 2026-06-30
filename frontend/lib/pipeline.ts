import type {
  ApplicationStageApi,
  PipelineCandidateRecord,
  PipelineStage,
  WorkspaceApplicationApiRecord,
  WorkspaceCandidateApiRecord,
  WorkspaceVacancyApiRecord,
} from "@/lib/recruitment-types";

export const pipelineStageOrder: PipelineStage[] = [
  "hr_invite_sent",
  "hr_in_progress",
  "technical_in_progress",
  "technical_passed",
  "management_in_progress",
  "selected",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "hired",
  "rejected",
];

export const pipelineStageLabels: Record<PipelineStage, string> = {
  applied: "Applied",
  ranked: "Ranked",
  shortlisted: "Shortlisted",
  hr_review: "HR Review",
  hr_invite_sent: "Waiting For Approval",
  hr_interview_scheduled: "HR Interview",
  hr_in_progress: "HR Interview",
  hr_approved: "HR Approved",
  hr_passed: "Technical Pipeline",
  technical_review: "Technical Review",
  technical_interview_scheduled: "Technical Interview",
  technical_in_progress: "Technical Interview",
  technical_approved: "Technical Approved",
  technical_passed: "Technical Passed",
  management_review: "Management Review",
  management_interview_scheduled: "Management Interview",
  management_in_progress: "Management Interview",
  selected: "Selected",
  offer_sent: "Offer Sent",
  offer_accepted: "Offer Accepted",
  offer_declined: "Offer Declined",
  hired: "Hired",
  rejected: "Rejected",
};

export function mapApplicationStageToPipelineStage(application: WorkspaceApplicationApiRecord): PipelineStage | null {
  if (
    application.invite_sent_at &&
    (application.stage === "primary_shortlist" ||
      application.stage === "reserve_shortlist" ||
      application.stage === "hr_invite_selected")
  ) {
    return "hr_invite_sent";
  }

  const stage = application.stage;
  switch (stage) {
    case "hr_invite_sent":
      return "hr_invite_sent";
    case "hr_interview_scheduled":
    case "hr_in_progress":
      return "hr_in_progress";
    case "hr_passed":
    case "technical_interview_scheduled":
    case "technical_in_progress":
      return "technical_in_progress";
    case "technical_passed":
      return "technical_passed";
    case "management_interview_scheduled":
    case "management_in_progress":
      return "management_in_progress";
    case "selected":
      return "selected";
    case "offer_sent":
      return "offer_sent";
    case "offer_accepted":
      return "offer_accepted";
    case "offer_declined":
      return "offer_declined";
    case "hired":
      return "hired";
    case "hr_rejected":
    case "technical_rejected":
    case "management_rejected":
      return "rejected";
    default:
      return null;
  }
}

export function mapApplicationToPipelineCandidate(
  application: WorkspaceApplicationApiRecord,
  candidate: WorkspaceCandidateApiRecord | null,
  vacancy: WorkspaceVacancyApiRecord | null,
): PipelineCandidateRecord | null {
  const stage = mapApplicationStageToPipelineStage(application);

  if (!stage) {
    return null;
  }

  const parsedData = resolveParsedData(application, candidate);
  const name = candidate?.name?.trim() || asString(parsedData.name) || `Candidate #${application.candidate_id}`;

  return {
    id: String(application.id),
    name,
    vacancyId: String(vacancy?.id ?? application.vacancy_id),
    role: vacancy?.title ?? `Vacancy #${application.vacancy_id}`,
    matchScore: application.ranking_score ?? application.match_score ?? candidate?.match_score ?? 0,
    stage,
    applicationStage: application.stage,
    interviewAt:
      application.hr_interview_at ??
      application.technical_interview_at ??
      application.management_interview_at ??
      null,
    interviewStageType:
      application.stage === "hr_invite_sent" ||
      application.stage === "hr_interview_scheduled" ||
      application.stage === "hr_in_progress"
        ? "hr"
        : application.stage === "hr_passed" ||
            application.stage === "technical_interview_scheduled" ||
            application.stage === "technical_in_progress"
          ? "technical"
          : application.stage === "technical_passed" ||
              application.stage === "management_interview_scheduled" ||
              application.stage === "management_in_progress"
            ? "management"
            : null,
    aiSummary:
      candidate?.ai_summary ??
      application.ai_summary ??
      asString(parsedData.summary) ??
      "No AI summary available yet.",
    cvReference:
      asString(parsedData.resume_path) ??
      asString(parsedData.file_path) ??
      `Application #${application.id}`,
    parsedData: {
      name,
      email: candidate?.email ?? asString(parsedData.email) ?? "No email stored",
      phone: candidate?.phone ?? asString(parsedData.phone) ?? "No phone stored",
      skills: candidate?.skills?.length ? candidate.skills : asStringArray(parsedData.skills),
      experience:
        candidate?.experience ??
        asString(parsedData.experience_summary) ??
        asString(parsedData.experience) ??
        "No experience details stored.",
      education:
        candidate?.education ??
        asString(parsedData.education_summary) ??
        asString(parsedData.education) ??
        "No education details stored.",
      location:
        asString(asRecord(parsedData.intake_metadata).location) ??
        asString(parsedData.location) ??
        undefined,
      workAuthorization:
        asString(asRecord(parsedData.intake_metadata).work_authorization) ??
        asString(parsedData.work_authorization) ??
        undefined,
      noticePeriod:
        asString(asRecord(parsedData.intake_metadata).notice_period) ??
        asString(parsedData.notice_period) ??
        undefined,
      executiveSummary:
        candidate?.ai_summary ??
        asString(parsedData.executive_summary) ??
        undefined,
      pros: asStringArray(parsedData.pros),
      cons: asStringArray(parsedData.cons),
      experienceYears: asNumber(parsedData.experience_years) ?? asNumber(parsedData.years_experience) ?? undefined,
      fitExplanation: asString(parsedData.fit_explanation) ?? undefined,
    },
  };
}

function resolveParsedData(
  application: WorkspaceApplicationApiRecord,
  candidate: WorkspaceCandidateApiRecord | null,
): Record<string, unknown> {
  const applicationParsedData =
    application.parsed_data && typeof application.parsed_data === "object"
      ? application.parsed_data
      : {};
  const candidateParsedData =
    candidate?.parsed_data && typeof candidate.parsed_data === "object"
      ? candidate.parsed_data
      : {};

  if (Object.keys(candidateParsedData).length > 0) {
    return {
      ...applicationParsedData,
      ...candidateParsedData,
    };
  }

  return applicationParsedData;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
