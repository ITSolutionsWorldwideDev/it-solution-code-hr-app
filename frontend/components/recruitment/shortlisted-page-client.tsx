"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LoaderCircle,
  Mail,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/api/client";
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
import { cn } from "@/lib/utils";

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
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState("");
  const [applications, setApplications] = useState<ApplicationApiRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateApiRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [selectedRoleSuggestions, setSelectedRoleSuggestions] = useState<CandidateRoleSuggestionApiRecord[]>([]);
  const [potentialTalent, setPotentialTalent] = useState<PotentialTalentRecord[]>([]);
  const [potentialTalentLoading, setPotentialTalentLoading] = useState(false);
  const [potentialTalentError, setPotentialTalentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"generate_top_10" | "send_selected_emails" | null>(null);
  const [cardBusyAction, setCardBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"match" | "rank">("match");
  const [statusFilter, setStatusFilter] = useState<"all" | "primary" | "reserve" | "send_selected" | "invite_sent">(
    "all",
  );
  const [vacancyMenuOpen, setVacancyMenuOpen] = useState(false);
  const [pendingInviteIds, setPendingInviteIds] = useState<number[]>([]);
  const [rejectionEmailSentIds, setRejectionEmailSentIds] = useState<number[]>([]);
  const seenSentInviteIdsRef = useRef<number[] | null>(null);

  const selectedVacancy = useMemo(
    () => vacancies.find((vacancy) => String(vacancy.id) === selectedVacancyId) ?? null,
    [selectedVacancyId, vacancies],
  );

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
      return;
    }

    setPotentialTalentLoading(true);
    try {
      const discovery = await apiRequest<VacancyDiscoverySummaryApiRecord>({
        path: `/vacancies/${vacancyId}/trigger-discovery`,
        method: "POST",
      });
      setPotentialTalent((discovery.top_candidates ?? []).slice(0, 5));
      setPotentialTalentError(null);
    } catch (error) {
      setPotentialTalent([]);
      setPotentialTalentError(error instanceof Error ? error.message : "Failed to load potential talent.");
    } finally {
      setPotentialTalentLoading(false);
    }
  };

  useEffect(() => {
    const loadVacancies = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" });
        setVacancies(response);
        if (response[0]) {
          setSelectedVacancyId(String(response[0].id));
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
      return;
    }

    const loadApplications = async () => {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await Promise.all([loadVacancyShortlist(selectedVacancyId, true), loadPotentialTalent(selectedVacancyId)]);
      } catch (error) {
        setApplications([]);
        setCandidates([]);
        setPotentialTalent([]);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load shortlisted candidates.");
      } finally {
        setLoading(false);
      }
    };

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
    const shortlistRecords = applications
      .filter((application) => ["primary", "reserve"].includes(application.shortlist_bucket))
      .map((application) => ({
        application,
        candidate: candidates.find((candidate) => candidate.id === application.candidate_id) ?? null,
      }));

    const filtered = shortlistRecords.filter(({ application }) => {
      if (statusFilter === "all") {
        return true;
      }
      if (statusFilter === "primary") {
        return application.shortlist_bucket === "primary";
      }
      if (statusFilter === "reserve") {
        return application.shortlist_bucket === "reserve";
      }
      if (statusFilter === "send_selected") {
        return selectedIds.includes(application.id);
      }
      if (statusFilter === "invite_sent") {
        return Boolean(application.invite_sent_at);
      }
      return true;
    });

    return filtered.sort((left, right) => {
      if (sortMode === "rank") {
        return (left.application.ranking_position ?? 999) - (right.application.ranking_position ?? 999);
      }

      return (
        (right.application.ranking_score ?? right.application.match_score ?? 0) -
        (left.application.ranking_score ?? left.application.match_score ?? 0)
      );
    });
  }, [applications, candidates, selectedIds, sortMode, statusFilter]);

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
      let queuedCount = 0;
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

          await apiRequest<ApplicationSendInviteResponse>({
            path: `/applications/${applicationId}/send-hr-invite`,
            method: "POST",
            body: JSON.stringify({
              sent_by_id: user.id,
              allow_resend: true,
            }),
          });
          queuedCount += 1;
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
          `${queuedCount} HR invitation email(s) were handed to n8n. They stay here until delivery is confirmed.`,
        );
      } else if (failedCount === 0 && queuedCount === 0 && skippedCount > 0) {
        setSuccessMessage(
          `${skippedCount} selected candidate${skippedCount === 1 ? " is" : "s are"} already in the pipeline, so nothing changed.`,
        );
      } else if (failedCount === 0) {
        setSuccessMessage(
          `${queuedCount} HR invitation email(s) were handed to n8n. ${skippedCount} candidate${skippedCount === 1 ? " was" : "s were"} already in the pipeline and skipped.`,
        );
      } else if (queuedCount === 0) {
        setErrorMessage(
          failureMessages[0] ?? "None of the selected HR invitation emails could be queued for n8n.",
        );
      } else {
        setSuccessMessage(
          `${queuedCount} HR invitation email(s) were handed to n8n, while ${failedCount} failed to queue.${skippedCount > 0 ? ` ${skippedCount} candidate${skippedCount === 1 ? " was" : "s were"} already in the pipeline and skipped.` : ""}`,
        );
        setErrorMessage(
          failureMessages[0] ?? `Queueing failed for application ids: ${failedApplicationIds.join(", ")}.`,
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send selected invitation emails.");
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

  const handleApproveShortlistedCandidate = async (applicationId: number) => {
    setBusy(true);
    setCardBusyAction(`approve-candidate-${applicationId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${applicationId}/stage`,
        method: "PATCH",
        body: JSON.stringify({
          to_stage: "hr_passed",
          changed_by_id: user.id,
          notes: "Candidate handed off from HR to the technical interview queue.",
        }),
      });
      const response = await apiRequest<ApplicationSendInviteResponse>({
        path: `/applications/${applicationId}/send-email`,
        method: "POST",
        body: JSON.stringify({
          sent_by_id: user.id,
          email_type: "hr_passed",
          allow_resend: true,
          template_variant: "technical_interview_invite",
        }),
      });
      setRejectionEmailSentIds((current) => current.filter((id) => id !== applicationId));
      await loadVacancyShortlist(selectedVacancyId, false);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to approve candidate.");
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
      <section className="space-y-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-[3rem] font-semibold tracking-[-0.06em] text-[#e9ecff] sm:text-[4.2rem]">
              Shortlisted
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">
              Manage and invite top-tier talent for the{" "}
              <span className="text-white">{selectedVacancy?.title ?? "selected role"}</span> role.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/12 bg-black px-4 py-4 text-white shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.26em] text-white/45">Sort by</p>
                  <div className="mt-3">
                    <Select
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as "match" | "rank")}
                      className="h-auto border-0 bg-transparent px-0 py-0 text-lg font-medium text-white focus:border-0"
                    >
                      <option value="match">Match Score</option>
                      <option value="rank">Ranking Position</option>
                    </Select>
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 text-white/55" />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-black px-4 py-4 text-white shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.26em] text-white/45">Status</p>
                  <div className="mt-3">
                    <Select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as "all" | "primary" | "reserve" | "send_selected" | "invite_sent",
                        )
                      }
                      className="h-auto border-0 bg-transparent px-0 py-0 text-lg font-medium text-white focus:border-0"
                    >
                      <option value="all">All</option>
                      <option value="primary">Qualified</option>
                      <option value="reserve">Pending Review</option>
                      <option value="send_selected">Send Selected</option>
                      <option value="invite_sent">Invite Sent</option>
                    </Select>
                  </div>
                </div>
                <SlidersHorizontal className="h-5 w-5 text-white/55" />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="w-full rounded-[26px] border border-white/12 bg-black px-5 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] sm:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <label className="flex items-center gap-4 text-white">
                  <input
                    type="checkbox"
                    className="h-6 w-6 rounded-md border border-[#415073] bg-transparent accent-[#3ef0ce]"
                    checked={allVisibleSelected}
                    onChange={(event) => handleToggleAll(event.target.checked)}
                  />
                  <span className="text-base font-medium">Select All Candidates ({visibleCount})</span>
                </label>
                <div className="hidden h-8 w-px bg-white/10 lg:block" />
                <p className="text-base text-white/60">{selectedIds.length} candidates selected</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  icon={Sparkles}
                  loading={busyAction === "generate_top_10"}
                  onClick={handleGenerateShortlist}
                  disabled={!selectedVacancyId || busy}
                  className="justify-center rounded-[18px] border-white/20 bg-black px-5 py-3 text-base text-white hover:bg-white/5"
                >
                  {busyAction === "generate_top_10" ? "Generating Top 10..." : "Generate Top 10"}
                </Button>
                <Button
                  type="button"
                  icon={Mail}
                  loading={busyAction === "send_selected_emails"}
                  onClick={handleSendSelectedEmails}
                  disabled={selectedIds.length === 0 || busy}
                  className="justify-center rounded-[18px] bg-white px-5 py-3 text-base font-semibold text-black shadow-none hover:bg-white/90"
                >
                  {busyAction === "send_selected_emails" ? "Sending Emails..." : "Send Selected Emails"}
                </Button>
              </div>
            </div>

            {busyAction ? (
              <div className="mt-5 flex items-center gap-3 rounded-[16px] border border-white/12 bg-[#141414] px-4 py-3 text-sm text-white/82">
                <LoaderCircle className="h-4 w-4 animate-spin text-[#8fb6ff]" />
                <span>
                  {busyAction === "generate_top_10"
                    ? "Generating the Top 10 shortlist. This can take a moment."
                    : "Sending invitation emails to the selected candidates."}
                </span>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
              <div className="rounded-[18px] border border-white/12 bg-black px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-white/45">Vacancy</p>
                <div className="relative mt-3 flex items-center gap-3">
                  <BriefcaseBusiness className="h-5 w-5 text-white" />
                  <button
                    type="button"
                    onClick={() => setVacancyMenuOpen((current) => !current)}
                    className="flex h-12 w-full items-center justify-between rounded-[14px] border border-white/10 bg-[#161b22] px-4 text-left text-base font-medium text-white transition hover:border-white/20 hover:bg-[#1a2028]"
                  >
                    <span className="truncate">{selectedVacancy?.title ?? "Select vacancy"}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-white/55 transition ${vacancyMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {vacancyMenuOpen ? (
                    <div className="absolute left-8 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-[18px] border border-white/12 bg-[#10151b] shadow-[0_28px_70px_rgba(0,0,0,0.38)]">
                      <div className="border-b border-white/8 px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/45">
                        Choose vacancy
                      </div>
                      <div className="max-h-72 overflow-y-auto py-2">
                        {vacancies.map((vacancy) => {
                          const selected = String(vacancy.id) === selectedVacancyId;
                          return (
                            <button
                              key={vacancy.id}
                              type="button"
                              onClick={() => setSelectedVacancyId(String(vacancy.id))}
                              className={`flex w-full items-center justify-between px-4 py-3 text-left text-base transition ${
                                selected
                                  ? "bg-[#1c2a38] text-white"
                                  : "text-white/78 hover:bg-white/[0.04] hover:text-white"
                              }`}
                            >
                              <span className="truncate">{vacancy.title}</span>
                              {selected ? <Check className="h-4 w-4 text-[#8fb6ff]" /> : <ChevronRight className="h-4 w-4 text-white/25" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[18px] border border-white/12 bg-black px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-white/45">Search</p>
                <div className="mt-3 flex items-center gap-3 text-white/45">
                  <Search className="h-5 w-5" />
                  <span className="text-base">Using shortlist data for this vacancy</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-[20px] border border-[#6b3041] bg-[#2a1620] px-5 py-4 text-sm text-[#ffb9c7]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[20px] border border-white/12 bg-black px-5 py-4 text-sm text-white">
            {successMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[24px] border border-white/12 bg-black px-5 py-8 text-base text-white/65">
            Loading shortlist...
          </div>
        ) : shortlistedCandidates.length === 0 ? (
          <div className="rounded-[24px] border border-white/12 bg-black px-5 py-8 text-base text-white/65">
            No shortlisted candidates yet. Generate the Top 10 shortlist for the selected vacancy first.
          </div>
        ) : (
          <div className="space-y-6">
            {shortlistedCandidates.map(({ application, candidate }) => {
              const checked = selectedIds.includes(application.id);
              const alreadySent = isInviteSent(application);
              const inPipeline = isInInvitePipeline(application);
              const isRejected = application.stage === "hr_rejected";
              const rejectionEmailSent = rejectionEmailSentIds.includes(application.id);
              const expanded = selectedApplicationId === application.id;
              const currentParsedDetail = expanded ? parsedDetail : null;
              const roleText = roleLabel(candidate, selectedVacancy?.title, application);
              const accentClass =
                application.shortlist_bucket === "primary" ? "before:bg-white" : "before:bg-white/60";

              return (
                <article
                  key={application.id}
                  className={cn(
                    "relative overflow-hidden rounded-[28px] border border-white/12 bg-black px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)] before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:content-[''] sm:px-7 sm:py-7",
                    accentClass,
                  )}
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black text-white/70">
                            <UserRound className="h-8 w-8" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0">
                              <h2 className="text-[1.85rem] font-semibold tracking-[-0.04em] text-[#eef1ff]">
                                {candidate?.name ?? `Candidate #${application.candidate_id}`}
                              </h2>
                              <p className="mt-1 text-sm uppercase tracking-[0.3em] text-white/45">
                                {roleText} / {experienceLabel(candidate)}
                              </p>
                            </div>

                            <div className="shrink-0 text-left xl:text-right">
                              <p className="text-[3.25rem] font-semibold tracking-[-0.06em] text-white">
                                {formatRawScore(application.ranking_score ?? application.match_score)}
                              </p>
                              <p className="text-[0.8rem] uppercase tracking-[0.24em] text-white/45">Rank score</p>
                            </div>
                          </div>

                          <div className="mt-8">
                            <p className="text-[0.78rem] uppercase tracking-[0.26em] text-white/45">
                              Assessment summary
                            </p>
                            <p className="mt-4 max-w-5xl text-lg leading-9 text-white/85">
                              {candidate?.ai_summary ?? application.ai_summary ?? "No AI summary available yet."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 border-t border-white/6 pt-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
                            <div className="flex items-center gap-3">
                              <span className="text-lg text-[#d4dbef]">Status:</span>
                              <span
                                className={cn(
                                  "rounded-full border px-4 py-2 text-sm font-medium",
                                  application.shortlist_bucket === "primary"
                                    ? "border-white/25 bg-white/10 text-white"
                                    : "border-white/20 bg-white/5 text-white/85",
                                )}
                              >
                                {shortlistLabel(application.shortlist_bucket)}
                              </span>
                              {isRejected ? (
                                <span className="inline-flex items-center gap-2 rounded-full border border-[#6b3041] bg-[#2a1620] px-4 py-2 text-sm font-medium text-[#ffccd6]">
                                  Rejected
                                </span>
                              ) : null}
                              {isRejected && rejectionEmailSent ? (
                                <span className="inline-flex items-center gap-2 rounded-full border border-[#315545] bg-[#15271d] px-4 py-2 text-sm font-medium text-[#cdeed8]">
                                  Rejection Email Sent
                                </span>
                              ) : null}
                              {alreadySent ? (
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                                  <Check className="h-4 w-4" />
                                  Sent to candidate
                                </span>
                              ) : null}
                              {inPipeline ? (
                                <span className="inline-flex items-center gap-2 rounded-full border border-[#2b4f6b] bg-[#142333] px-4 py-2 text-sm font-medium text-[#cde8ff]">
                                  <Check className="h-4 w-4" />
                                  Sent to pipeline
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                onClick={() => handleToggle(application.id, !checked)}
                                className={cn(
                                  "relative h-9 w-16 rounded-full transition",
                                  checked ? "bg-white" : "bg-white/25",
                                )}
                                aria-pressed={checked}
                              >
                                <span
                                  className={cn(
                                    "absolute top-1 h-7 w-7 rounded-full bg-white shadow-[0_8px_16px_rgba(0,0,0,0.24)] transition",
                                    checked ? "left-8" : "left-1",
                                  )}
                                />
                              </button>
                              <span className="text-lg text-[#edf2ff]">
                                {checked ? "Included In Invite Batch" : "Not In Invite Batch"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            {isRejected ? (
                              <>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="justify-center rounded-[16px] border-white/20 bg-black px-6 py-3 text-base text-white"
                                  onClick={() => handleRestoreRejectedCandidate(application.id)}
                                  disabled={busy}
                                  loading={cardBusyAction === `restore-candidate-${application.id}`}
                                >
                                  Approve Candidate
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="justify-center rounded-[16px] border-[#8bc9ea] bg-[#10202c] px-6 py-3 text-base text-[#d7f5ff] hover:bg-[#152b3a]"
                                  onClick={() => handleApproveShortlistedCandidate(application.id)}
                                  disabled={busy}
                                  loading={cardBusyAction === `approve-candidate-${application.id}`}
                                >
                                  Send To Technical
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="justify-center rounded-[16px] border-[#6b3041] bg-[#2a1620] px-6 py-3 text-base text-[#ffccd6] hover:bg-[#321a24]"
                                  onClick={() => handleSendRejectionEmail(application.id)}
                                  disabled={busy}
                                  loading={cardBusyAction === `rejected-email-${application.id}`}
                                >
                                  Rejected Email
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="justify-center rounded-[16px] border-[#8bc9ea] bg-[#10202c] px-6 py-3 text-base text-[#d7f5ff] hover:bg-[#152b3a]"
                                  onClick={() => handleApproveShortlistedCandidate(application.id)}
                                  disabled={busy}
                                  loading={cardBusyAction === `approve-candidate-${application.id}`}
                                >
                                  Send To Technical
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="justify-center rounded-[16px] border-[#6b3041] bg-[#2a1620] px-6 py-3 text-base text-[#ffccd6] hover:bg-[#321a24]"
                                  onClick={() => handleSendRejectionEmail(application.id)}
                                  disabled={busy}
                                  loading={cardBusyAction === `rejected-email-${application.id}`}
                                >
                                  Rejected Email
                                </Button>
                              </>
                            )}
                            <Button
                              type="button"
                              className="justify-center rounded-[16px] bg-white px-6 py-3 text-base font-semibold text-black shadow-none hover:bg-white/90"
                              onClick={() =>
                                setSelectedApplicationId((current) => (current === application.id ? null : application.id))
                              }
                            >
                              Review Details{" "}
                              {expanded ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {expanded && currentParsedDetail ? (
                        <div className="mt-7 grid gap-4 rounded-[24px] border border-[#303b59] bg-[#12192d] p-5">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Applied to</p>
                              <p className="mt-3 text-lg font-medium text-[#eef2ff]">
                                {selectedVacancy?.title ?? "Unknown vacancy"}
                              </p>
                            </div>
                            <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Parsed on</p>
                              <p className="mt-3 text-lg font-medium text-[#eef2ff]">
                                {formatTimestamp(application.created_at)}
                              </p>
                            </div>
                            <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Email</p>
                              <p className="mt-3 text-lg font-medium text-[#eef2ff]">
                                {candidate?.email ?? "No email stored"}
                              </p>
                            </div>
                            <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Vacancy fit</p>
                              <p className="mt-3 text-lg font-medium text-[#52f1d1]">
                                {formatMatchScore(currentParsedDetail.vacancyScore)}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                            <div className="space-y-4">
                              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                                <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Summary</p>
                                <p className="mt-3 text-base leading-8 text-[#dce2f4]">{currentParsedDetail.summary}</p>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Experience</p>
                                  <p className="mt-3 text-base leading-8 text-[#dce2f4]">
                                    {currentParsedDetail.experience}
                                  </p>
                                </div>
                                <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">Education</p>
                                  <p className="mt-3 text-base leading-8 text-[#dce2f4]">
                                    {currentParsedDetail.education}
                                  </p>
                                </div>
                              </div>
                              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                                <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">
                                  Vacancy fit explanation
                                </p>
                                <p className="mt-3 text-base leading-8 text-[#dce2f4]">
                                  {currentParsedDetail.fitExplanation}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">
                                    Matched skills
                                  </p>
                                  <Check className="h-4 w-4 text-[#52f1d1]" />
                                </div>
                                {currentParsedDetail.matchedSkills.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {currentParsedDetail.matchedSkills.map((skill) => (
                                      <span
                                        key={skill}
                                        className="rounded-full border border-[#334362] bg-[#1c2540] px-3 py-1.5 text-sm font-medium text-[#dfe6f8]"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-sm text-[#96a4c6]">No matched skills stored yet.</p>
                                )}
                              </div>

                              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">
                                    Role suggestions
                                  </p>
                                  {detailErrorMessage ? (
                                    <span className="text-xs text-[#ffb7c2]">{detailErrorMessage}</span>
                                  ) : null}
                                </div>
                                {selectedRoleSuggestions.length ? (
                                  <div className="mt-3 space-y-3">
                                    {selectedRoleSuggestions.slice(0, 3).map((suggestion) => (
                                      <div
                                        key={suggestion.id}
                                        className="rounded-[16px] border border-[#31405f] bg-[#17203a] px-4 py-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="text-base font-semibold text-[#eef2ff]">
                                              {suggestion.role_title}
                                            </p>
                                            <p className="mt-1 text-sm text-[#96a4c6]">
                                              {suggestion.department ?? "General"}
                                            </p>
                                          </div>
                                          <span className="text-lg font-semibold text-[#52f1d1]">
                                            {formatMatchScore(suggestion.confidence_score)}
                                          </span>
                                        </div>
                                        <p className="mt-3 text-sm leading-7 text-[#d7def1]">
                                          {suggestion.reason ?? "No explanation stored for this role suggestion."}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-sm text-[#96a4c6]">
                                    No role suggestions are available yet for this candidate.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {currentParsedDetail.resumePreviewBlocks.length > 0 ? (
                            <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-4">
                              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#7f8cab]">
                                Formatted CV Preview
                              </p>
                              <div className="mt-3 grid gap-3">
                                {currentParsedDetail.resumePreviewBlocks.slice(0, 3).map((block) => (
                                  <div
                                    key={block}
                                    className="whitespace-pre-wrap rounded-[14px] border border-white/6 bg-black/10 px-4 py-3 text-sm leading-7 text-[#dce2f4]"
                                  >
                                    {block}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <Panel className="rounded-[30px] border border-white/12 bg-black p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2">
            <h2 className="text-[1.55rem] font-semibold text-[#eef2ff]">Potential Talent from Database</h2>
            <p className="text-base leading-7 text-white/65">
              AI suggests up to 5 extra candidates from the database who did not apply for this vacancy but may still
              fit.
            </p>
          </div>

          {potentialTalentError ? (
            <div className="mt-4 rounded-[18px] border border-[#6b3041] bg-[#2a1620] px-4 py-3 text-sm text-[#ffb9c7]">
              {potentialTalentError}
            </div>
          ) : null}

          {potentialTalentLoading ? (
            <div className="mt-5 rounded-[22px] border border-white/12 bg-black px-4 py-5 text-sm text-white/65">
              Loading potential talent...
            </div>
          ) : potentialTalent.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-white/12 bg-black px-4 py-5 text-sm text-white/65">
              Not available for this vacancy yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {potentialTalent.map((candidate, index) => (
                <div
                  key={`${candidate.candidate_name}-${index}`}
                  className="rounded-[24px] border border-[#2b3550] bg-[#12192d] px-5 py-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#334362] bg-[#18223d] text-[#89a0ca]">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[1rem] font-semibold text-[#eef2ff]">{candidate.candidate_name}</p>
                        <p className="mt-1 text-sm text-[#95a8c8]">Original role: {candidate.original_role}</p>
                      </div>
                    </div>
                    <div className="rounded-full border border-[#2c8a80] bg-[#103136] px-3 py-1 text-sm font-semibold text-[#7ef0d8]">
                      {candidate.potential_score}%
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[#d7def1]">{candidate.reason}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
