"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Mail,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useRole } from "@/components/providers/role-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { apiRequest } from "@/lib/api/client";
import { isPlaceholderCandidate } from "@/lib/candidate-utils";
import type {
  ApplicationApiRecord,
  ApplicationStageApi,
  ApplicationSendInviteResponse,
  CandidateApiRecord,
  CandidateRoleSuggestionApiRecord,
  UserApiRecord,
  VacancyDiscoverySummaryApiRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";

const roleToUserRole = {
  HR: "HR",
  Technical: "Technical",
  Manager: "Manager",
  Admin: "Admin",
} as const;

const invitePipelineStages = new Set<ApplicationStageApi>([
  "hr_invite_sent",
  "hr_interview_scheduled",
  "hr_in_progress",
  "hr_passed",
  "hr_rejected",
  "technical_interview_scheduled",
  "technical_in_progress",
  "technical_passed",
  "technical_rejected",
  "management_interview_scheduled",
  "management_in_progress",
  "selected",
  "management_rejected",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "hired",
]);

const approvalPipelineStages = new Set<ApplicationStageApi>([
  "hr_passed",
  "technical_interview_scheduled",
  "technical_in_progress",
  "technical_passed",
  "technical_rejected",
  "management_interview_scheduled",
  "management_in_progress",
  "selected",
  "management_rejected",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "hired",
]);

type ShortlistedCandidateRecord = {
  application: ApplicationApiRecord;
  candidate: CandidateApiRecord | null;
};

type PotentialTalentRecord = {
  candidate_id: number;
  candidate_name: string;
  original_role: string;
  potential_score: number;
  reason: string;
};

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "Not available";
  }

  const normalizedValue = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function toTimestamp(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalizedValue = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalizedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
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

const PRESERVE_UPPERCASE_WORDS = new Set([
  "SEO",
  "BS",
  "MS",
  "MSC",
  "MBA",
  "HTML",
  "CSS",
  "UI",
  "UX",
  "CMS",
  "CV",
  "AI",
  "IT",
  "VAC",
]);

function formatMatchScore(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "No score";
  }

  const bucketed = Math.max(0, Math.min(100, Math.round(value / 10) * 10));
  return `${bucketed}%`;
}

function formatRawScore(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "--";
  }

  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function normalizeResumePreviewText(value: unknown) {
  if (typeof value !== "string") {
    return "No extracted text stored yet.";
  }

  const withRecoveredBreaks = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");

  return withRecoveredBreaks.replace(/\s+/g, " ").trim() || "No extracted text stored yet.";
}

function normalizeResumeWord(word: string) {
  const cleanedLetters = word.replace(/[^A-Za-z]/g, "");
  if (!cleanedLetters) {
    return word;
  }

  const upper = cleanedLetters.toUpperCase();
  if (PRESERVE_UPPERCASE_WORDS.has(upper) || cleanedLetters.length <= 2) {
    return word.toUpperCase();
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeResumeDisplayLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  const bulletPrefix = trimmed.startsWith("- ") ? "- " : "";
  const content = bulletPrefix ? trimmed.slice(2) : trimmed;
  const hasLetters = /[A-Za-z]/.test(content);
  const isMostlyUppercase = hasLetters && content === content.toUpperCase();

  if (!isMostlyUppercase) {
    return `${bulletPrefix}${content.replace(/\s{2,}/g, " ")}`.trim();
  }

  const normalizedContent = content
    .split(/\s+/)
    .map((word) => normalizeResumeWord(word))
    .join(" ");

  return `${bulletPrefix}${normalizedContent}`.trim();
}

function formatResumePreviewText(value: unknown) {
  const text = normalizeResumePreviewText(value);
  if (text === "No extracted text stored yet.") {
    return text;
  }

  const compact = text.replace(/\s+/g, " ").trim();

  const personalInfoBlock = compact.match(
    /PERSONAL INFORMATION\s+Name\s+(.+?)\s+Telephone No\s+(.+?)\s+Email\s+(.+?)(?=\s+WORK EXPERIENCE|$)/i,
  );

  const workExperienceMatch = compact.match(/WORK EXPERIENCE\s+(.+)$/i);
  const workExperienceText = workExperienceMatch?.[1] ?? "";
  const experienceEntries = workExperienceText
    .split(/\s+(?=Date\s+)/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const lines: string[] = [];

  if (personalInfoBlock) {
    lines.push("PERSONAL INFORMATION");
    lines.push(`- Name: ${personalInfoBlock[1].trim()}`);
    lines.push(`- Telephone: ${personalInfoBlock[2].trim()}`);
    lines.push(`- Email: ${personalInfoBlock[3].trim()}`);
    lines.push("");
  }

  if (experienceEntries.length > 0) {
    lines.push("WORK EXPERIENCE");

    for (const entry of experienceEntries) {
      const normalizedEntry = entry
        .replace(/^Date\s+/i, "")
        .replace(/\s+Name\/address of company\s+/i, "\nCompany: ")
        .replace(/\s+Type of job\s+/i, "\nRole: ")
        .replace(/\s+Principal responsibilities\s+/i, "\nResponsibilities: ");

      const [datePart, ...restParts] = normalizedEntry.split("\n");
      const date = datePart.trim();
      const details = restParts
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => `- ${part}`);

      lines.push("");
      lines.push(date);
      lines.push(...details);
    }
  }

  const formatted = lines.join("\n").trim();
  return (formatted || text)
    .split("\n")
    .map((line) => normalizeResumeDisplayLine(line))
    .join("\n");
}

function getResumePreviewText(parsedData: Record<string, unknown>) {
  const formattedPreview = parsedData.formatted_resume_preview;
  if (typeof formattedPreview === "string" && formattedPreview.trim()) {
    return formattedPreview
      .trim()
      .split("\n")
      .map((line) => normalizeResumeDisplayLine(line))
      .join("\n");
  }

  return formatResumePreviewText(parsedData.extracted_text);
}

function getResumePreviewBlocks(parsedData: Record<string, unknown>) {
  const preview = getResumePreviewText(parsedData);
  if (preview === "No extracted text stored yet.") {
    return [preview];
  }

  return preview
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function shortlistLabel(bucket: ApplicationApiRecord["shortlist_bucket"]) {
  if (bucket === "primary") {
    return "Qualified";
  }
  if (bucket === "reserve") {
    return "Shortlisted";
  }
  return "Not shortlisted";
}

function experienceLabel(candidate: CandidateApiRecord | null) {
  const source = candidate?.experience?.trim();
  if (!source) {
    return "Experience not extracted";
  }

  const match = source.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  if (match) {
    return `${match[1]} years exp`;
  }

  return source.length > 30 ? `${source.slice(0, 27)}...` : source;
}

function formatShortDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function isFromTalentPool(application: ApplicationApiRecord) {
  const parsedData =
    application.parsed_data && typeof application.parsed_data === "object"
      ? (application.parsed_data as Record<string, unknown>)
      : null;
  return parsedData?.shortlist_source === "talent_pool";
}

function isDirectVacancyApplication(
  application: ApplicationApiRecord,
  candidate: CandidateApiRecord | null,
) {
  if (isFromTalentPool(application)) {
    return false;
  }

  const parsedData =
    candidate?.parsed_data && typeof candidate.parsed_data === "object"
      ? (candidate.parsed_data as Record<string, unknown>)
      : null;

  if (parsedData?.source !== "job_application") {
    return false;
  }

  return String(parsedData?.source_reference_id ?? "") === String(application.id);
}

function roleLabel(
  candidate: CandidateApiRecord | null,
  vacancyTitle: string | undefined,
  application: ApplicationApiRecord,
) {
  const parsedData =
    candidate?.parsed_data && typeof candidate.parsed_data === "object"
      ? (candidate.parsed_data as Record<string, unknown>)
      : application.parsed_data && typeof application.parsed_data === "object"
        ? (application.parsed_data as Record<string, unknown>)
        : {};

  const explicitRole =
    asString(parsedData.current_title) ??
    asString(parsedData.role_title) ??
    asString(parsedData.job_title) ??
    asString(parsedData.current_role);

  return explicitRole ?? vacancyTitle ?? "Candidate profile";
}

function locationLabel(candidate: CandidateApiRecord | null, application: ApplicationApiRecord) {
  const candidateParsedData =
    candidate?.parsed_data && typeof candidate.parsed_data === "object"
      ? (candidate.parsed_data as Record<string, unknown>)
      : {};
  const applicationParsedData =
    application.parsed_data && typeof application.parsed_data === "object"
      ? (application.parsed_data as Record<string, unknown>)
      : {};

  return (
    asString(candidateParsedData.location) ??
    asString(candidateParsedData.city) ??
    asString(candidateParsedData.current_location) ??
    asString(applicationParsedData.location) ??
    asString(applicationParsedData.city) ??
    "Not specified"
  );
}

function isInviteSent(application: ApplicationApiRecord) {
  return Boolean(application.invite_sent_at);
}

function isInviteSelected(application: ApplicationApiRecord) {
  return application.stage === "hr_invite_selected";
}

function isInInvitePipeline(application: ApplicationApiRecord) {
  return invitePipelineStages.has(application.stage);
}

function isInApprovalPipeline(application: ApplicationApiRecord) {
  return approvalPipelineStages.has(application.stage);
}

function isTransientNetworkError(message: string | null) {
  if (!message) {
    return false;
  }

  return message.includes("Could not reach the API: Failed to fetch");
}

function shortlistPipelineStatusLabel(application: ApplicationApiRecord) {
  switch (application.stage) {
    case "hr_invite_sent":
      return "Already Sent to Pipeline";
    case "hr_interview_scheduled":
    case "hr_in_progress":
      return "In HR Pipeline";
    case "hr_passed":
      return "Passed to Technical";
    case "technical_interview_scheduled":
    case "technical_in_progress":
      return "In Technical Pipeline";
    case "technical_passed":
      return "Passed to Management";
    case "management_interview_scheduled":
    case "management_in_progress":
      return "In Management Pipeline";
    case "selected":
      return "Selected";
    case "offer_sent":
      return "Offer Sent";
    case "offer_accepted":
      return "Offer Accepted";
    case "offer_declined":
      return "Offer Declined";
    case "hired":
      return "Hired";
    default:
      return "Already Sent to Pipeline";
  }
}

async function ensureDemoUser(role: keyof typeof roleToUserRole, fullName: string): Promise<UserApiRecord> {
  const users = await apiRequest<UserApiRecord[]>({ path: "/users/" });
  const existing = users.find((user) => user.role === roleToUserRole[role] && user.full_name === fullName);
  if (existing) {
    return existing;
  }

  const emailSlug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, ".");
  return apiRequest<UserApiRecord>({
    path: "/users/",
    method: "POST",
    body: JSON.stringify({
      full_name: fullName,
      email: `${emailSlug}@itsolutionsworldwide.local`,
      role: roleToUserRole[role],
      department_id: null,
    }),
  });
}

export function ShortlistedPageClient() {
  const { role, name } = useRole();
  const router = useRouter();
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [vacancyApplicationCounts, setVacancyApplicationCounts] = useState<Record<number, { total: number; shortlisted: number }>>({});
  const [selectedVacancyId, setSelectedVacancyId] = useState("");
  const [applications, setApplications] = useState<ApplicationApiRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateApiRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [selectedRoleSuggestions, setSelectedRoleSuggestions] = useState<CandidateRoleSuggestionApiRecord[]>([]);
  const [potentialTalent, setPotentialTalent] = useState<PotentialTalentRecord[]>([]);
  const [potentialTalentLoading, setPotentialTalentLoading] = useState(false);
  const [potentialTalentRefreshing, setPotentialTalentRefreshing] = useState(false);
  const [potentialTalentError, setPotentialTalentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"generate_top_10" | "send_selected_emails" | null>(null);
  const [cardBusyAction, setCardBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
  const [vacancyMenuOpen, setVacancyMenuOpen] = useState(false);
  const [pendingInviteIds, setPendingInviteIds] = useState<number[]>([]);
  const [rejectionEmailSentIds, setRejectionEmailSentIds] = useState<number[]>([]);
  const seenSentInviteIdsRef = useRef<number[] | null>(null);

  const selectedVacancy = useMemo(
    () => vacancies.find((vacancy) => String(vacancy.id) === selectedVacancyId) ?? null,
    [selectedVacancyId, vacancies],
  );
  const duplicateVacancyTitles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vacancy of vacancies) {
      counts.set(vacancy.title, (counts.get(vacancy.title) ?? 0) + 1);
    }
    return counts;
  }, [vacancies]);

  const loadVacancyShortlist = async (vacancyId: string, syncSelection: boolean) => {
    if (!vacancyId) {
      setApplications([]);
      setCandidates([]);
      return;
    }

    const [applicationResponse, candidateResponse] = await Promise.all([
      apiRequest<ApplicationApiRecord[]>({ path: `/vacancies/${vacancyId}/applications` }),
      apiRequest<CandidateApiRecord[]>({ path: "/candidates/" }),
    ]);

    setApplications(applicationResponse);
    setCandidates(candidateResponse);
    setErrorMessage(null);

    if (syncSelection) {
      setSelectedIds(
        applicationResponse
          .filter(
            (application) =>
              ["primary", "reserve"].includes(application.shortlist_bucket) &&
              isInviteSelected(application),
          )
          .map((application) => application.id),
      );
    }
  };

  const loadPotentialTalent = async (vacancyId: string) => {
    if (!vacancyId) {
      setPotentialTalent([]);
      setPotentialTalentRefreshing(false);
      return;
    }

    let hasCachedCandidates = false;
    setPotentialTalentLoading(true);
    try {
      const cachedDiscovery = await apiRequest<VacancyDiscoverySummaryApiRecord>({
        path: `/vacancies/${vacancyId}/discovery-summary`,
      });
      const cachedTopCandidates = (cachedDiscovery.top_candidates ?? []).slice(0, 5);
      hasCachedCandidates = cachedTopCandidates.length > 0;
      setPotentialTalent(cachedTopCandidates);
      setPotentialTalentError(null);

      if (hasCachedCandidates) {
        setPotentialTalentLoading(false);
        setPotentialTalentRefreshing(true);
      }

      const discovery = await apiRequest<VacancyDiscoverySummaryApiRecord>({
        path: `/vacancies/${vacancyId}/trigger-discovery`,
        method: "POST",
      });
      setPotentialTalent((discovery.top_candidates ?? []).slice(0, 5));
      setPotentialTalentError(null);
    } catch (error) {
      if (!hasCachedCandidates) {
        setPotentialTalent([]);
        const message = error instanceof Error ? error.message : "Failed to load potential talent.";
        setPotentialTalentError(
          message === "Internal Server Error" || isTransientNetworkError(message)
            ? "Potential talent is temporarily unavailable for this vacancy."
            : message,
        );
      } else {
        setPotentialTalentError(null);
      }
    } finally {
      setPotentialTalentLoading(false);
      setPotentialTalentRefreshing(false);
    }
  };

  useEffect(() => {
    const loadVacancies = async () => {
      setLoading(true);
      try {
        const [vacancyResponse, applicationResponse, candidateResponse] = await Promise.all([
          apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" }),
          apiRequest<ApplicationApiRecord[]>({ path: "/applications/" }),
          apiRequest<CandidateApiRecord[]>({ path: "/candidates/" }),
        ]);
        setVacancies(vacancyResponse);

        const visibleCandidateIds = new Set(
          candidateResponse
            .filter((candidate) => !isPlaceholderCandidate(candidate))
            .map((candidate) => candidate.id),
        );
        const counts = applicationResponse.reduce<Record<number, { total: number; shortlisted: number }>>((acc, application) => {
          const current = acc[application.vacancy_id] ?? { total: 0, shortlisted: 0 };
          const isVisibleCandidate = visibleCandidateIds.has(application.candidate_id);
          if (isVisibleCandidate) {
            current.total += 1;
          }
          if (isVisibleCandidate && ["primary", "reserve"].includes(application.shortlist_bucket)) {
            current.shortlisted += 1;
          }
          acc[application.vacancy_id] = current;
          return acc;
        }, {});
        setVacancyApplicationCounts(counts);

        const preferredVacancy =
          vacancyResponse.find((vacancy) => (counts[vacancy.id]?.shortlisted ?? 0) > 0) ??
          vacancyResponse.find((vacancy) => (counts[vacancy.id]?.total ?? 0) > 0) ??
          vacancyResponse[0];

        if (preferredVacancy) {
          setSelectedVacancyId(String(preferredVacancy.id));
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load vacancies.");
      } finally {
        setLoading(false);
      }
    };

    void loadVacancies();
  }, []);

  useEffect(() => {
    if (!selectedVacancyId) {
      setApplications([]);
      setCandidates([]);
      setPotentialTalent([]);
      setShortlistLoading(false);
      return;
    }

    const loadApplications = async () => {
      setShortlistLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await loadVacancyShortlist(selectedVacancyId, true);
      } catch (error) {
        setApplications([]);
        setCandidates([]);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load shortlisted candidates.");
      } finally {
        setShortlistLoading(false);
      }
    };

    void loadPotentialTalent(selectedVacancyId);
    void loadApplications();
  }, [selectedVacancyId]);

  useEffect(() => {
    setVacancyMenuOpen(false);
  }, [selectedVacancyId]);

  useEffect(() => {
    if (!selectedVacancyId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (busy) {
        return;
      }

      void loadVacancyShortlist(selectedVacancyId, false).catch(() => {
        // Keep the current shortlist visible if a background refresh fails.
      });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [busy, selectedVacancyId]);

  useEffect(() => {
    const currentSentIds = applications.filter((application) => isInviteSent(application)).map((application) => application.id);

    if (seenSentInviteIdsRef.current === null) {
      seenSentInviteIdsRef.current = currentSentIds;
      return;
    }

    const previousSentIds = new Set(seenSentInviteIdsRef.current);
    const confirmedFromPending = pendingInviteIds.filter((id) => currentSentIds.includes(id));
    const newlyObserved = currentSentIds.filter((id) => !previousSentIds.has(id));
    const confirmedIds = confirmedFromPending.length > 0 ? confirmedFromPending : newlyObserved;

    if (confirmedIds.length > 0) {
      setErrorMessage(null);
      setSuccessMessage(
        `${confirmedIds.length} invitation email${confirmedIds.length === 1 ? "" : "s"} sent to candidate.`,
      );
      setPendingInviteIds((current) => current.filter((id) => !confirmedIds.includes(id)));
    }

    seenSentInviteIdsRef.current = currentSentIds;
  }, [applications, pendingInviteIds]);

  const shortlistedCandidates = useMemo<ShortlistedCandidateRecord[]>(() => {
    return applications
      .filter((application) => ["primary", "reserve"].includes(application.shortlist_bucket))
      .map((application) => ({
        application,
        candidate: candidates.find((candidate) => candidate.id === application.candidate_id) ?? null,
      }))
      .filter(({ candidate }) => !candidate || !isPlaceholderCandidate(candidate))
      .sort((left, right) => {
        return (
        (right.application.ranking_score ?? right.application.match_score ?? 0) -
        (left.application.ranking_score ?? left.application.match_score ?? 0)
        );
      });
  }, [applications, candidates]);

  const directApplicantCount = useMemo(
    () =>
      applications.filter((application) => {
        const candidate = candidates.find((item) => item.id === application.candidate_id) ?? null;
        return isDirectVacancyApplication(application, candidate);
      }).length,
    [applications, candidates],
  );

  const selectedRecord = useMemo(
    () => shortlistedCandidates.find(({ application }) => application.id === selectedApplicationId) ?? null,
    [selectedApplicationId, shortlistedCandidates],
  );

  useEffect(() => {
    if (shortlistedCandidates.length === 0) {
      setSelectedApplicationId(null);
      return;
    }

    if (
      selectedApplicationId != null &&
      !shortlistedCandidates.some(({ application }) => application.id === selectedApplicationId)
    ) {
      setSelectedApplicationId(null);
    }
  }, [selectedApplicationId, shortlistedCandidates]);

  useEffect(() => {
    const visibleIds = new Set(shortlistedCandidates.map(({ application }) => application.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [shortlistedCandidates]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoleSuggestions(candidateId: number) {
      try {
        setDetailErrorMessage(null);
        const suggestions = await apiRequest<CandidateRoleSuggestionApiRecord[]>({
          path: `/candidates/${candidateId}/role-suggestions`,
        });
        if (!cancelled) {
          setSelectedRoleSuggestions(suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedRoleSuggestions([]);
          setDetailErrorMessage(error instanceof Error ? error.message : "Failed to load role suggestions.");
        }
      }
    }

    const candidateId = selectedRecord?.candidate?.id ?? null;
    if (!candidateId) {
      setSelectedRoleSuggestions([]);
      setDetailErrorMessage(null);
      return () => {
        cancelled = true;
      };
    }

    void loadRoleSuggestions(candidateId);

    return () => {
      cancelled = true;
    };
  }, [selectedRecord?.candidate?.id]);

  const parsedDetail = useMemo(() => {
    if (!selectedRecord) {
      return null;
    }

    const { application, candidate } = selectedRecord;
    const parsedData =
      application.parsed_data && typeof application.parsed_data === "object"
        ? application.parsed_data
        : candidate?.parsed_data && typeof candidate.parsed_data === "object"
          ? candidate.parsed_data
          : {};

    const parsedDataRecord = parsedData as Record<string, unknown>;

    return {
      vacancyScore: application.ranking_score ?? application.match_score ?? 0,
      summary:
        candidate?.ai_summary ??
        application.ai_summary ??
        asString(parsedDataRecord.summary) ??
        "No parsed summary available yet.",
      experience:
        candidate?.experience ??
        asString(parsedDataRecord.experience_summary) ??
        "No detailed experience extracted yet.",
      education:
        candidate?.education ??
        asString(parsedDataRecord.education_summary) ??
        "No education details extracted yet.",
      matchedSkills: [...new Set([...asStringArray(parsedDataRecord.matched_skills), ...(candidate?.skills ?? [])])],
      fitExplanation:
        asString(parsedDataRecord.fit_explanation) ??
        application.ai_summary ??
        "No vacancy fit explanation stored yet.",
      resumePreviewBlocks: getResumePreviewBlocks(parsedDataRecord),
    };
  }, [selectedRecord]);

  const visibleCount = shortlistedCandidates.length;
  const allVisibleSelected =
    visibleCount > 0 && shortlistedCandidates.every(({ application }) => selectedIds.includes(application.id));
  const isRefreshingShortlist =
    shortlistLoading && (applications.length > 0 || candidates.length > 0 || shortlistedCandidates.length > 0);
  const hideInlineError =
    isTransientNetworkError(errorMessage) &&
    !shortlistLoading &&
    (shortlistedCandidates.length > 0 || potentialTalent.length > 0 || potentialTalentLoading);

  const handleGenerateShortlist = async () => {
    if (!selectedVacancyId) {
      return;
    }

    setBusy(true);
    setBusyAction("generate_top_10");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord[]>({
        path: `/vacancies/${selectedVacancyId}/shortlist/generate`,
        method: "POST",
        body: JSON.stringify({ changed_by_id: user.id }),
      });
      await loadVacancyShortlist(selectedVacancyId, true);
      setSuccessMessage("Top 5 primary and next 5 reserve shortlist were generated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate shortlist.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const handleToggle = (applicationId: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, applicationId])] : current.filter((id) => id !== applicationId),
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (!checked) {
      const visibleIds = new Set(shortlistedCandidates.map(({ application }) => application.id));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

      setSelectedIds((current) => [
        ...new Set([
          ...current,
          ...shortlistedCandidates.map(({ application }) => application.id),
        ]),
      ]);
    };

  const handleSendSelectedEmails = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    setBusy(true);
    setBusyAction("send_selected_emails");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      let movedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const failedApplicationIds: number[] = [];
      const failureMessages: string[] = [];

      for (const application of shortlistedCandidates.map((item) => item.application)) {
        const shouldSend = selectedIds.includes(application.id);
        await apiRequest<ApplicationApiRecord>({
          path: `/applications/${application.id}/invite-selection`,
          method: "PATCH",
          body: JSON.stringify({
            invite_selected: shouldSend,
            changed_by_id: user.id,
          }),
        });
      }

      for (const applicationId of selectedIds) {
        try {
          const currentApplication = applications.find((application) => application.id === applicationId);
          if (!currentApplication) {
            throw new Error("Application not found.");
          }

          if (isInInvitePipeline(currentApplication)) {
            skippedCount += 1;
            continue;
          }

          await apiRequest<ApplicationApiRecord>({
            path: `/applications/${applicationId}/stage`,
            method: "PATCH",
            body: JSON.stringify({
              to_stage: "hr_invite_sent",
              changed_by_id: user.id,
              notes: "Moved into the HR pipeline from shortlisted.",
            }),
          });
          movedCount += 1;
        } catch (error) {
          failedCount += 1;
          failedApplicationIds.push(applicationId);
          if (error instanceof Error && error.message.trim()) {
            failureMessages.push(`Application ${applicationId}: ${error.message.trim()}`);
          }
        }
      }

      await loadVacancyShortlist(selectedVacancyId, true);
      const queuedApplicationIds = selectedIds.filter((applicationId) => {
        const currentApplication = applications.find((application) => application.id === applicationId);
        return currentApplication ? !isInInvitePipeline(currentApplication) : false;
      });
      setPendingInviteIds((current) => [...new Set([...current, ...queuedApplicationIds])]);

      if (failedCount === 0 && skippedCount === 0) {
        setSuccessMessage(
          `${movedCount} candidate${movedCount === 1 ? "" : "s"} ${movedCount === 1 ? "was" : "were"} sent to the pipeline.`,
        );
      } else if (failedCount === 0 && movedCount === 0 && skippedCount > 0) {
        setSuccessMessage(
          `${skippedCount} selected candidate${skippedCount === 1 ? " is" : "s are"} already in the pipeline, so nothing changed.`,
        );
      } else if (failedCount === 0) {
        setSuccessMessage(
          `${movedCount} candidate${movedCount === 1 ? " was" : "s were"} sent to the pipeline. ${skippedCount} candidate${skippedCount === 1 ? " was" : "s were"} already in the pipeline and skipped.`,
        );
      } else if (movedCount === 0) {
        setErrorMessage(
          failureMessages[0] ?? "None of the selected candidates could be sent to the pipeline.",
        );
      } else {
        setSuccessMessage(
          `${movedCount} candidate${movedCount === 1 ? " was" : "s were"} sent to the pipeline, while ${failedCount} failed.${skippedCount > 0 ? ` ${skippedCount} candidate${skippedCount === 1 ? " was" : "s were"} already in the pipeline and skipped.` : ""}`,
        );
        setErrorMessage(
          failureMessages[0] ?? `Pipeline update failed for application ids: ${failedApplicationIds.join(", ")}.`,
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send selected candidates to the pipeline.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const handleRejectShortlistedCandidate = async (applicationId: number) => {
    setBusy(true);
    setCardBusyAction(`reject-candidate-${applicationId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${applicationId}/reject`,
        method: "PATCH",
        body: JSON.stringify({
          rejected_stage: "hr_rejected",
          reason: "Rejected from the shortlist workspace.",
          changed_by_id: user.id,
        }),
      });
      await loadVacancyShortlist(selectedVacancyId, false);
      setSuccessMessage("Candidate was rejected. You can now send the rejection email.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reject candidate.");
    } finally {
      setBusy(false);
      setCardBusyAction(null);
    }
  };

  const handleSendHrInvite = async (applicationId: number) => {
    setBusy(true);
    setCardBusyAction(`send-hr-invite-${applicationId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${applicationId}/invite-selection`,
        method: "PATCH",
        body: JSON.stringify({
          invite_selected: true,
          changed_by_id: user.id,
        }),
      });
      const currentApplication = applications.find((application) => application.id === applicationId);
      if (currentApplication && isInInvitePipeline(currentApplication)) {
        setSuccessMessage(`Candidate is already in the pipeline as ${shortlistPipelineStatusLabel(currentApplication)}.`);
        return;
      }
      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${applicationId}/stage`,
        method: "PATCH",
        body: JSON.stringify({
          to_stage: "hr_invite_sent",
          changed_by_id: user.id,
          notes: "Moved into the HR pipeline from shortlisted.",
        }),
      });
      setPendingInviteIds((current) => [...new Set([...current, applicationId])]);
      setRejectionEmailSentIds((current) => current.filter((id) => id !== applicationId));
      await loadVacancyShortlist(selectedVacancyId, false);
      setSuccessMessage("Candidate was sent to the pipeline.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send candidate to the pipeline.");
    } finally {
      setBusy(false);
      setCardBusyAction(null);
    }
  };

  const handleAddTalentPoolCandidate = async (candidateRecord: PotentialTalentRecord) => {
    if (!selectedVacancyId) {
      return;
    }

    setBusy(true);
    setCardBusyAction(`add-talent-pool-${candidateRecord.candidate_id}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord>({
        path: `/vacancies/${selectedVacancyId}/shortlist/from-talent-pool`,
        method: "POST",
        body: JSON.stringify({
          candidate_id: candidateRecord.candidate_id,
          changed_by_id: user.id,
          shortlist_bucket: "reserve",
          potential_score: candidateRecord.potential_score,
          reason: candidateRecord.reason,
        }),
      });
      await loadVacancyShortlist(selectedVacancyId, false);
      await loadPotentialTalent(selectedVacancyId);
      setSuccessMessage(`${candidateRecord.candidate_name} was added to the shortlist from the talent pool.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add talent-pool candidate to shortlist.");
    } finally {
      setBusy(false);
      setCardBusyAction(null);
    }
  };

  const handleRestoreRejectedCandidate = async (applicationId: number) => {
    setBusy(true);
    setCardBusyAction(`restore-candidate-${applicationId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      const currentApplication = applications.find((application) => application.id === applicationId);

      if (!currentApplication) {
        throw new Error("Application not found.");
      }

      if (!["primary", "reserve"].includes(currentApplication.shortlist_bucket)) {
        throw new Error("Only shortlisted candidates can be restored from rejection.");
      }

      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${applicationId}/shortlist`,
        method: "PATCH",
        body: JSON.stringify({
          shortlist_bucket: currentApplication.shortlist_bucket,
          changed_by_id: user.id,
        }),
      });

      setRejectionEmailSentIds((current) => current.filter((id) => id !== applicationId));
      await loadVacancyShortlist(selectedVacancyId, false);
      setSuccessMessage("Candidate was restored to the shortlist.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to restore candidate.");
    } finally {
      setBusy(false);
      setCardBusyAction(null);
    }
  };

  const handleSendRejectionEmail = async (applicationId: number) => {
    setBusy(true);
    setCardBusyAction(`rejected-email-${applicationId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      const currentApplication = applications.find((application) => application.id === applicationId);

      if (!currentApplication) {
        throw new Error("Application not found.");
      }

      if (currentApplication.stage !== "hr_rejected") {
        await apiRequest<ApplicationApiRecord>({
          path: `/applications/${applicationId}/reject`,
          method: "PATCH",
          body: JSON.stringify({
            rejected_stage: "hr_rejected",
            reason: "Rejected before sending rejection email.",
            changed_by_id: user.id,
          }),
        });
      }

      const response = await apiRequest<ApplicationSendInviteResponse>({
        path: `/applications/${applicationId}/send-email`,
        method: "POST",
        body: JSON.stringify({
          sent_by_id: user.id,
          email_type: "hr_rejection",
          allow_resend: true,
        }),
      });
      setRejectionEmailSentIds((current) => [...new Set([...current, applicationId])]);
      await loadVacancyShortlist(selectedVacancyId, false);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send rejection email.");
    } finally {
      setBusy(false);
      setCardBusyAction(null);
    }
  };

  if (role !== "HR") {
    return (
      <Panel className="rounded-[30px] border border-white/8 bg-[#121a31] p-6">
        <h2 className="text-[1.5rem] font-semibold text-white">Shortlisting stays in the HR workspace</h2>
        <p className="mt-3 max-w-3xl text-[1rem] leading-7 text-[#95a8b8]">
          HR decides who from the top 10 gets the invitation email. Technical and Management only join after the
          candidate moves into the interview pipeline.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
              <span>Recruitment Command Center</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#66fcf1]">Shortlisted</span>
            </div>
            <h1 className="text-[3rem] font-bold tracking-[-0.04em] text-white sm:text-[3.5rem]">Shortlisted</h1>
            <div className="inline-flex items-center gap-3 rounded-xl border border-white/5 bg-[#17202b]/80 px-4 py-3">
              <BriefcaseBusiness className="h-4 w-4 text-[#66fcf1]" />
              <div className="relative">
                <select
                  value={selectedVacancyId}
                  onChange={(event) => setSelectedVacancyId(event.target.value)}
                  className="appearance-none bg-transparent pr-8 font-mono text-[1rem] text-[#dae3f2] focus:outline-none"
                >
                  {vacancies.map((vacancy) => {
                    const hasDuplicateTitle = (duplicateVacancyTitles.get(vacancy.title) ?? 0) > 1;
                    const shortlistedCount = vacancyApplicationCounts[vacancy.id]?.shortlisted ?? 0;
                    const createdLabel = formatShortDate(vacancy.created_at);

                    return (
                      <option key={vacancy.id} value={String(vacancy.id)}>
                        {hasDuplicateTitle ? `${vacancy.title} (#${vacancy.id})` : vacancy.title}
                        {createdLabel ? ` · ${createdLabel}` : ""}
                        {` · ${shortlistedCount} shortlisted`}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#859491]" />
              </div>
              {shortlistLoading ? (
                <span className="inline-flex items-center gap-2 text-sm text-[#9ed7e2]">
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#66fcf1]" />
                  Updating...
                </span>
              ) : null}
            </div>
          </div>

        </div>

        <div className="rounded-2xl border border-white/10 bg-[rgba(23,32,43,0.7)] p-5 shadow-[0_0_0_1px_rgba(197,198,199,0.04),0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-3 text-[1rem] font-medium text-[#dae3f2]">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-[#3c4948] bg-[#17202b] text-[#66fcf1] focus:ring-[#66fcf1]"
                  checked={allVisibleSelected}
                  onChange={(event) => handleToggleAll(event.target.checked)}
                />
                <span>Select All Candidates ({visibleCount})</span>
              </label>
              <div className="hidden h-6 w-px bg-white/10 sm:block" />
              <button
                type="button"
                onClick={handleGenerateShortlist}
                disabled={!selectedVacancyId || busy}
                className="inline-flex items-center gap-2 text-[1rem] text-[#bacac7] transition hover:text-[#66fcf1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === "generate_top_10" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{busyAction === "generate_top_10" ? "Generating Top 10" : "Generate Top 10"}</span>
              </button>
            </div>

            <Button
              type="button"
              icon={Mail}
              loading={busyAction === "send_selected_emails"}
              onClick={handleSendSelectedEmails}
              disabled={selectedIds.length === 0 || busy}
              className="justify-center rounded-2xl bg-[#62f9ee] px-8 py-5 text-[1rem] font-bold text-[#00716b] shadow-[0_0_15px_rgba(102,252,241,0.2)] hover:brightness-105"
            >
              Send Selected to Pipeline
            </Button>
          </div>
        </div>

        {busyAction ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#2b4551] bg-[#13202b] px-4 py-3 text-sm text-[#c9dff1]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#66fcf1]" />
            {busyAction === "generate_top_10"
              ? "Generating the shortlist for this vacancy."
              : "Sending selected candidates to the pipeline."}
          </div>
        ) : null}

        {errorMessage && shortlistedCandidates.length === 0 ? (
          <div className="rounded-xl border border-[#6b3041] bg-[#2a1620] px-4 py-3 text-sm text-[#ffb9c7]">
            {errorMessage}
          </div>
        ) : null}

        {errorMessage && shortlistedCandidates.length > 0 && !hideInlineError ? (
          <div className="rounded-xl border border-[#504428] bg-[#221b10] px-4 py-3 text-sm text-[#f6d7a7]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-[#234c45] bg-[#10211f] px-4 py-3 text-sm text-[#c8fff6]">
            {successMessage}
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[rgba(23,32,43,0.7)] shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur">
          {isRefreshingShortlist ? (
            <div className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-[#2b4551] bg-[#13202b]/95 px-3 py-2 text-xs font-medium text-[#c9dff1] shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <LoaderCircle className="h-4 w-4 animate-spin text-[#66fcf1]" />
              Refreshing shortlist...
            </div>
          ) : null}
          {loading || (shortlistLoading && applications.length === 0 && candidates.length === 0) ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-[#bacac7]">
              <LoaderCircle className="h-6 w-6 animate-spin text-[#66fcf1]" />
              <span>Loading shortlist...</span>
            </div>
          ) : shortlistedCandidates.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-[#bacac7]">
              {directApplicantCount === 0 && potentialTalent.length > 0
                ? "There are no direct applicants yet. Talent pool suggestions are available below."
                : "No shortlisted candidates yet. Generate the top 10 shortlist for this vacancy first."}
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#222b36]/50 text-[12px] font-bold uppercase tracking-[0.08em] text-[#bacac7]">
                  <th className="w-12 px-6 py-5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => handleToggleAll(event.target.checked)}
                      className="h-5 w-5 rounded border-[#3c4948] bg-[#17202b] text-[#66fcf1] focus:ring-[#66fcf1]"
                    />
                  </th>
                  <th className="px-6 py-5">Candidate</th>
                  <th className="px-6 py-5">Current Role</th>
                  <th className="px-6 py-5">Location</th>
                  <th className="w-72 px-6 py-5">Match Score</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shortlistedCandidates.map(({ application, candidate }) => {
                  const checked = selectedIds.includes(application.id);
                  const expanded = selectedApplicationId === application.id;
                  const roleText = roleLabel(candidate, selectedVacancy?.title, application);
                  const locationText = locationLabel(candidate, application);
                  const score = Math.max(
                    0,
                    Math.min(100, Math.round(application.ranking_score ?? application.match_score ?? 0)),
                  );
                  const isRejected = application.stage === "hr_rejected";
                  const alreadySentToPipeline = !isRejected && isInInvitePipeline(application);

                  return (
                    <Fragment key={application.id}>
                      <tr className="transition-colors hover:bg-[#62f9ee]/[0.04]">
                        <td className="px-6 py-7 align-top">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => handleToggle(application.id, event.target.checked)}
                            className="mt-1 h-5 w-5 rounded border-[#3c4948] bg-[#17202b] text-[#66fcf1] focus:ring-[#66fcf1]"
                          />
                        </td>
                        <td className="px-6 py-7">
                          <div>
                            <p className="text-[1rem] font-semibold text-white">
                              {candidate?.name ?? `Candidate #${application.candidate_id}`}
                            </p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#bacac7]">
                              ID: #{application.id}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-7 text-[1rem] text-[#dae3f2]">{roleText}</td>
                        <td className="px-6 py-7 text-[1rem] text-[#dae3f2]">{locationText}</td>
                        <td className="px-6 py-7">
                          <div className="flex items-center gap-4">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#131c27]">
                              <div
                                className="h-full rounded-full bg-[#7bd6d1] shadow-[0_0_15px_rgba(102,252,241,0.2)]"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="min-w-[42px] font-mono text-[13px] text-[#66fcf1]">{score}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-7">
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {alreadySentToPipeline ? (
                              <span className="inline-flex items-center gap-2 px-1 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#9be7f5]">
                                <span className="h-2 w-2 rounded-full bg-[#9be7f5]" />
                                {shortlistPipelineStatusLabel(application)}
                              </span>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                isRejected
                                  ? handleRestoreRejectedCandidate(application.id)
                                  : handleSendHrInvite(application.id)
                              }
                              disabled={busy}
                              loading={
                                cardBusyAction ===
                                `${isRejected ? "restore-candidate" : "send-hr-invite"}-${application.id}`
                              }
                              className="rounded-lg border border-white/10 bg-[#222b36] px-4 py-2 text-xs font-medium text-[#dae3f2] hover:bg-[#2c3541]"
                            >
                              {isRejected ? "Approve Candidate" : "Send to Pipeline"}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => handleSendRejectionEmail(application.id)}
                              disabled={busy}
                              loading={cardBusyAction === `rejected-email-${application.id}`}
                              className="rounded-lg border-0 bg-[#93000a]/20 px-4 py-2 text-xs font-medium text-[#ffb4ab] hover:bg-[#93000a]/35"
                            >
                              Rejected Email
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                setSelectedApplicationId((current) => (current === application.id ? null : application.id))
                              }
                              className="rounded-lg bg-[#62f9ee] px-4 py-2 text-xs font-bold text-[#00716b] hover:brightness-105"
                            >
                              Review Details
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {expanded && parsedDetail ? (
                        <tr className="bg-[#111923]">
                          <td colSpan={6} className="px-6 pb-6 pt-1">
                            <div className="grid gap-4 rounded-2xl border border-white/5 bg-[#0f171f] p-5 lg:grid-cols-[1.3fr_0.7fr]">
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
                                    Summary
                                  </p>
                                  <p className="mt-2 text-sm leading-7 text-[#dae3f2]">{parsedDetail.summary}</p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
                                      Experience
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-[#dae3f2]">{parsedDetail.experience}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
                                      Education
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-[#dae3f2]">{parsedDetail.education}</p>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
                                    Vacancy Fit Explanation
                                  </p>
                                  <p className="mt-2 text-sm leading-7 text-[#dae3f2]">
                                    {parsedDetail.fitExplanation}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
                                    Matched Skills
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {parsedDetail.matchedSkills.length > 0 ? (
                                      parsedDetail.matchedSkills.slice(0, 8).map((skill) => (
                                        <span
                                          key={skill}
                                          className="rounded bg-[#17202b] px-3 py-1 text-[11px] font-bold uppercase text-[#dae3f2]"
                                        >
                                          {skill}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-[#859491]">No matched skills stored yet.</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bacac7]">
                                      Role Suggestions
                                    </p>
                                    {detailErrorMessage ? (
                                      <span className="text-xs text-[#ffb4ab]">{detailErrorMessage}</span>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 space-y-3">
                                    {selectedRoleSuggestions.slice(0, 3).map((suggestion) => (
                                      <div key={suggestion.id} className="rounded-xl border border-white/5 bg-[#17202b] p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="text-sm font-semibold text-white">{suggestion.role_title}</p>
                                            <p className="text-xs text-[#859491]">
                                              {suggestion.department ?? "General"}
                                            </p>
                                          </div>
                                          <span className="font-mono text-xs text-[#66fcf1]">
                                            {formatMatchScore(suggestion.confidence_score)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border border-[#66fcf1] text-[#66fcf1]" />
          <h2 className="text-[2rem] font-semibold tracking-[-0.03em] text-white">Potential Talent from Database</h2>
          <span className="rounded-full bg-[#66fcf1]/10 px-3 py-1 text-[10px] font-bold uppercase text-[#66fcf1]">
            AI Discovery
          </span>
          {potentialTalentRefreshing ? (
            <span className="inline-flex items-center gap-2 text-sm text-[#9ed7e2]">
              <LoaderCircle className="h-4 w-4 animate-spin text-[#66fcf1]" />
              Refreshing pool...
            </span>
          ) : null}
        </div>

        {potentialTalentError ? (
          <div className="rounded-xl border border-[#6b3041] bg-[#2a1620] px-4 py-3 text-sm text-[#ffb9c7]">
            {potentialTalentError}
          </div>
        ) : null}

        {potentialTalentLoading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[rgba(23,32,43,0.7)] px-5 py-8 text-sm text-[#bacac7]">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#66fcf1]" />
            <span>Loading potential talent...</span>
          </div>
        ) : potentialTalent.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[rgba(23,32,43,0.7)] px-5 py-8 text-sm text-[#bacac7]">
            Not available for this vacancy yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {potentialTalent.map((candidate, index) => {
              const existingApplication = applications.find(
                (application) =>
                  application.candidate_id === candidate.candidate_id &&
                  ["primary", "reserve"].includes(application.shortlist_bucket),
              );
              const alreadyShortlisted = Boolean(existingApplication);
              const highlightedSkills = (selectedVacancy?.required_skills ?? []).slice(0, 2);
              const extraSkills = Math.max((selectedVacancy?.required_skills?.length ?? 0) - highlightedSkills.length, 0);

              return (
                <div
                  key={`${candidate.candidate_name}-${index}`}
                  className="rounded-2xl border border-white/10 bg-[rgba(23,32,43,0.7)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[1.1rem] font-bold text-white">{candidate.candidate_name}</h3>
                      <p className="mt-1 text-sm text-[#bacac7]">{candidate.original_role}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[2rem] font-bold text-[#7bd6d1]">{candidate.potential_score}%</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#bacac7]">Match</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {highlightedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded bg-[#222b36] px-3 py-1 text-[10px] font-bold uppercase text-[#dae3f2]"
                      >
                        {skill}
                      </span>
                    ))}
                    {extraSkills > 0 ? (
                      <span className="rounded bg-[#222b36] px-3 py-1 text-[10px] font-bold uppercase text-[#dae3f2]">
                        +{extraSkills} Skills
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[#bacac7]">
                        {alreadyShortlisted ? "Already shortlisted" : "Talent pool candidate"}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleAddTalentPoolCandidate(candidate)}
                        disabled={busy || alreadyShortlisted}
                        loading={cardBusyAction === `add-talent-pool-${candidate.candidate_id}`}
                        className="rounded-lg border-0 bg-transparent px-0 py-0 text-sm font-bold text-[#66fcf1] hover:bg-transparent hover:underline"
                      >
                        {alreadyShortlisted ? "Added to shortlisted" : "Shortlist Now"}
                      </Button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#dae3f2]">{candidate.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
