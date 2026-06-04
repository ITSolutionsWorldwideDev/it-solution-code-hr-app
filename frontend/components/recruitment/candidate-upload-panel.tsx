"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, FileUp, LoaderCircle } from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type {
  ApplicationApiRecord,
  CandidateApiRecord,
  CandidateManualImportResponse,
  CandidateMatchApiRecord,
  CandidateRoleSuggestionApiRecord,
  StoredCandidateRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";

type VacancyMatchLookupProps = {
  vacancies: VacancyApiRecord[];
};

type CandidateMatchLookup = CandidateMatchApiRecord & {
  vacancy_title: string;
};

type StoredCandidateViewModel = StoredCandidateRecord & {
  vacancyLabelTitle: string;
};


function parseApiDate(value: string) {
  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  return new Date(normalizedValue);
}

function VacancyMatchLookup({ vacancies }: VacancyMatchLookupProps) {
  const [vacancyId, setVacancyId] = useState("");
  const [matches, setMatches] = useState<CandidateMatchApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoadMatches = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CandidateMatchApiRecord[]>({
        path: `/vacancies/${vacancyId}/matches`,
      });
      setMatches(response);
    } catch (error) {
      setMatches([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load vacancy matches.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <Panel className="rounded-[30px] p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.35rem] font-semibold text-white">Top vacancy matches</h2>
          <p className="text-sm text-[#95a8b8]">
          Step 3: review the current open vacancy rankings from the backend match table.
          </p>
        </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <FormField label="Vacancy">
          <Select value={vacancyId} onChange={(event) => setVacancyId(event.target.value)}>
            <option value="" disabled>
              Select vacancy
            </option>
            {vacancies.map((vacancy) => (
              <option key={vacancy.id} value={vacancy.id}>
                {vacancy.title}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="md:pt-8">
          <Button type="button" onClick={handleLoadMatches} disabled={!vacancyId || isLoading}>
            {isLoading ? "Loading..." : "Load Rankings"}
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[18px] border border-[#f0d5d7] bg-[#fff7f8] px-4 py-3 text-sm text-[#a65765]">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {matches.map((match) => (
          <div key={match.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">
                  {match.candidate_name ?? `Candidate #${match.candidate_id}`}
                </p>
                <p className="mt-1 text-sm text-[#95a8b8]">{match.ai_summary}</p>
              </div>
              <div className="rounded-full bg-[#466d8a]/18 px-3 py-1 text-sm font-semibold text-[#9fc6e0]">
                {formatMatchScore(match.match_score)}
              </div>
            </div>
            <p className="mt-3 text-sm text-[#95a8b8]">{match.fit_explanation}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function formatTimestamp(value: string) {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently parsed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

const PRESERVE_UPPERCASE_WORDS = new Set([
  "SEO",
  "BS",
  "MS",
  "MSc",
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
    /PERSONAL INFORMATION\s+Name\s+(.+?)\s+Telephone No\s+(.+?)\s+Email\s+(.+?)(?=\s+WORK EXPERIENCE|$)/i
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

function formatMatchScore(value: number | null) {
  if (value === null) {
    return "No score";
  }

  const bucketed = Math.max(0, Math.min(100, Math.round(value / 10) * 10));
  return `${bucketed}%`;
}

function formatRoleSuggestionStrength(value: number) {
  if (value >= 85) {
    return "High signal overlap";
  }
  if (value >= 65) {
    return "Medium signal overlap";
  }
  return "Light signal overlap";
}

function getCandidateTimestamp(
  candidate: CandidateApiRecord,
  match?: CandidateMatchLookup
) {
  const parsedAt = candidate.parsed_data?.resume_path
    ? match?.created_at
    : undefined;

  return parsedAt ?? match?.created_at ?? new Date().toISOString();
}

function isPlaceholderCandidate(candidate: CandidateApiRecord) {
  const parseStatus = typeof candidate.parsed_data?.parse_status === "string"
    ? candidate.parsed_data.parse_status
    : null;

  return (
    candidate.name === "Pending Candidate" ||
    candidate.email.endsWith("@placeholder.local") ||
    parseStatus === "pending"
  );
}

function buildStoredCandidates(
  candidates: CandidateApiRecord[],
  applications: ApplicationApiRecord[],
  matches: CandidateMatchLookup[],
  vacancies: VacancyApiRecord[],
  vacancyScope: string
): StoredCandidateRecord[] {
  const latestMatchByCandidate = new Map<number, CandidateMatchLookup>();
  const applicationsByCandidate = new Map<number, ApplicationApiRecord[]>();
  const visibleCandidates = candidates.filter((candidate) => !isPlaceholderCandidate(candidate));
  const scopedVacancy = vacancyScope
    ? vacancies.find((vacancy) => String(vacancy.id) === vacancyScope) ?? null
    : null;

  for (const match of matches) {
    const existing = latestMatchByCandidate.get(match.candidate_id);
    if (!existing || parseApiDate(match.created_at).getTime() > parseApiDate(existing.created_at).getTime()) {
      latestMatchByCandidate.set(match.candidate_id, match);
    }
  }

  for (const application of applications) {
    const existing = applicationsByCandidate.get(application.candidate_id) ?? [];
    existing.push(application);
    applicationsByCandidate.set(application.candidate_id, existing);
  }

  return visibleCandidates
    .map((candidate) => {
      const candidateApplications = [...(applicationsByCandidate.get(candidate.id) ?? [])].sort((left, right) => {
        const leftTime = parseApiDate(left.created_at)?.getTime() ?? 0;
        const rightTime = parseApiDate(right.created_at)?.getTime() ?? 0;
        return rightTime - leftTime;
      });
      const latestApplication = candidateApplications[0];
      const linkedMatch = latestMatchByCandidate.get(candidate.id);
      const linkedVacancy = latestApplication
        ? vacancies.find((vacancy) => vacancy.id === latestApplication.vacancy_id)
        : null;
      const matching = candidate.parsed_data?.matching as
        | {
            applied_match?: { vacancy_id?: string; role_name?: string; score?: number };
          }
        | undefined;
      const fallbackVacancyId = matching?.applied_match?.vacancy_id ?? null;
      const fallbackVacancyTitle = matching?.applied_match?.role_name ?? "Best open vacancy match";
      const fallbackFitExplanation =
        typeof candidate.parsed_data?.fit_explanation === "string"
          ? candidate.parsed_data.fit_explanation
          : "No vacancy fit explanation stored yet.";
      const matchScore =
        vacancyScope
          ? latestApplication?.ranking_score ??
            latestApplication?.match_score ??
            linkedMatch?.match_score ??
            matching?.applied_match?.score ??
            candidate.match_score ??
            null
          : linkedMatch?.match_score ??
            matching?.applied_match?.score ??
            candidate.match_score ??
            null;
      const linkedVacancyTitle = vacancyScope
        ? linkedVacancy?.title ?? scopedVacancy?.title ?? fallbackVacancyTitle
        : linkedMatch?.vacancy_title ?? fallbackVacancyTitle;
      const vacancyLabel = vacancyScope ? "Applied to" : "Best vacancy match";

      return {
        rowKey: `${candidate.id}-${latestApplication?.id ?? "candidate"}-${latestApplication?.created_at ?? linkedMatch?.created_at ?? getCandidateTimestamp(candidate, linkedMatch)}`,
        id: String(candidate.id),
        name: candidate.name,
        email: candidate.email,
        aiSummary: candidate.ai_summary ?? latestApplication?.ai_summary ?? "No parsed summary available yet.",
        skills: candidate.skills,
        experience: candidate.experience ?? "Not extracted yet.",
        education: candidate.education ?? "Not extracted yet.",
        linkedVacancyId: latestApplication?.vacancy_id ? String(latestApplication.vacancy_id) : fallbackVacancyId,
        linkedVacancyTitle,
        vacancyLabel,
        matchScore,
        fitExplanation:
          linkedMatch?.fit_explanation ??
          fallbackFitExplanation ??
          latestApplication?.ai_summary ??
          "No vacancy fit explanation stored yet.",
        matchedSkills: linkedMatch?.matched_skills ?? candidate.skills,
        uploadedAt: latestApplication?.created_at ?? getCandidateTimestamp(candidate, linkedMatch),
        parsedData: latestApplication?.parsed_data ?? candidate.parsed_data,
      };
    })
    .filter((candidate) => {
      const candidateId = Number(candidate.id);
      const hasScopedApplication = Boolean(applicationsByCandidate.get(candidateId)?.length);
      if (vacancyScope) {
        return hasScopedApplication;
      }

      const hasAnyApplication = applications.some((application) => application.candidate_id == candidateId);
      return !hasAnyApplication;
    })
    .sort((left, right) => parseApiDate(right.uploadedAt).getTime() - parseApiDate(left.uploadedAt).getTime());
}

function buildStoredCandidateViewModel(candidate: StoredCandidateRecord | null): StoredCandidateViewModel | null {
  if (!candidate) {
    return null;
  }

  return {
    ...candidate,
    vacancyLabelTitle: candidate.linkedVacancyTitle || "No direct vacancy linked",
  };
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  const showNotification = () => {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore notification errors in unsupported browser contexts.
    }
  };

  if (Notification.permission === "granted") {
    showNotification();
    return;
  }

  if (Notification.permission === "default") {
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showNotification();
      }
    });
  }
}

export function CandidateUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storedCandidatesSectionRef = useRef<HTMLDivElement | null>(null);
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [vacancyId, setVacancyId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [batchFailures, setBatchFailures] = useState<Array<{ filename: string; error: string }>>([]);
  const [storedCandidates, setStoredCandidates] = useState<StoredCandidateRecord[]>([]);
  const [storedCandidatesLoading, setStoredCandidatesLoading] = useState(false);
  const [sessionCandidateIds, setSessionCandidateIds] = useState<string[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedRoleSuggestions, setSelectedRoleSuggestions] = useState<CandidateRoleSuggestionApiRecord[]>([]);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
  const acceptedFileTypes =
    ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const loadStoredCandidates = async (selectedVacancyId?: string, vacancyRecords?: VacancyApiRecord[]) => {
    const vacancyFilter = selectedVacancyId ?? vacancyId;

    setStoredCandidatesLoading(true);

    try {
      const vacanciesForLookup = vacancyRecords ?? vacancies;
      const [candidateResponse, applicationResponse, matchResponse] = await Promise.all([
        apiRequest<CandidateApiRecord[]>({ path: "/candidates/" }),
        vacancyFilter
          ? apiRequest<ApplicationApiRecord[]>({ path: `/vacancies/${vacancyFilter}/applications` })
          : apiRequest<ApplicationApiRecord[]>({ path: "/applications/" }),
        vacancyFilter
          ? apiRequest<CandidateMatchApiRecord[]>({ path: `/vacancies/${vacancyFilter}/matches` })
          : Promise.resolve([] as CandidateMatchApiRecord[]),
      ]);

      const vacancy = vacanciesForLookup.find((record) => String(record.id) === vacancyFilter);
      const scopedMatches = matchResponse.map((match) => ({
        ...match,
        vacancy_title: vacancy?.title ?? `Vacancy #${match.vacancy_id}`,
      }));
      const nextCandidates = buildStoredCandidates(
        candidateResponse,
        applicationResponse,
        scopedMatches,
        vacanciesForLookup,
        vacancyFilter
      );
      setStoredCandidates(nextCandidates);
      setDetailErrorMessage(null);
    } catch (error) {
      setStoredCandidates([]);
      setDetailErrorMessage(error instanceof Error ? error.message : "Failed to load stored candidates.");
    } finally {
      setStoredCandidatesLoading(false);
    }
  };

  useEffect(() => {
    const loadVacancies = async () => {
      try {
        const response = await apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" });
        setVacancies(response);
        await loadStoredCandidates("", response);
      } catch {
        setVacancies([]);
        setStoredCandidates([]);
      }
    };

    void loadVacancies();
  }, []);

  useEffect(() => {
    void loadStoredCandidates(vacancyId);
  }, [vacancyId]);

  useEffect(() => {
    if (!selectedCandidateId) {
      setSelectedRoleSuggestions([]);
      return;
    }

    const loadRoleSuggestions = async () => {
      try {
        const response = await apiRequest<CandidateRoleSuggestionApiRecord[]>({
          path: `/candidates/${selectedCandidateId}/role-suggestions`,
        });
        setSelectedRoleSuggestions(response);
        setDetailErrorMessage(null);
      } catch (error) {
        setSelectedRoleSuggestions([]);
        setDetailErrorMessage(
          error instanceof Error ? error.message : "Failed to load candidate details."
        );
      }
    };

    void loadRoleSuggestions();
  }, [selectedCandidateId]);

  const visibleCandidates = useMemo(() => {
    const sessionSet = new Set(sessionCandidateIds);
    const scopedCandidates =
      sessionCandidateIds.length > 0
        ? storedCandidates.filter((candidate) => sessionSet.has(candidate.id))
        : storedCandidates;

    return [...scopedCandidates].sort((left, right) => {
      const leftScore = left.matchScore ?? -1;
      const rightScore = right.matchScore ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return parseApiDate(right.uploadedAt).getTime() - parseApiDate(left.uploadedAt).getTime();
    });
  }, [sessionCandidateIds, storedCandidates]);

  const selectedCandidate = useMemo(
    () => visibleCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [selectedCandidateId, visibleCandidates]
  );
  const selectedCandidateView = useMemo(
    () => buildStoredCandidateViewModel(selectedCandidate),
    [selectedCandidate]
  );

  useEffect(() => {
    if (visibleCandidates.length === 0) {
      if (selectedCandidateId !== null) {
        setSelectedCandidateId(null);
      }
      return;
    }

    if (!selectedCandidateId || !visibleCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(visibleCandidates[0].id);
    }
  }, [selectedCandidateId, visibleCandidates]);

  const handleClearParsingArea = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFiles([]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setBatchFailures([]);
  };

  const handleViewParsedCandidate = (candidateId: number) => {
    setSelectedCandidateId(String(candidateId));
    storedCandidatesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setBatchFailures([]);

    try {
      const formData = new FormData();
      if (vacancyId) {
        formData.append("vacancy_id", vacancyId);
      }
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await apiRequest<CandidateManualImportResponse>({
        path: "/candidates/manual-import",
        method: "POST",
        body: formData,
      });

      const failures = response.results
        .filter((item) => item.error_message)
        .map((item) => ({
          filename: item.filename,
          error: item.error_message ?? "Import failed.",
        }));
      setBatchFailures(failures);
      const parsedCandidateIds = response.results
        .map((item) => (item.candidate_id ? String(item.candidate_id) : null))
        .filter((value): value is string => value !== null);
      setSessionCandidateIds(parsedCandidateIds);
      const successCount = response.results.filter((item) => item.parse_status !== "failed").length;
      const nextSuccessMessage = `${successCount} CV${
        successCount === 1 ? "" : "s"
      } parsed successfully${vacancyId ? " for the selected vacancy" : " without a linked vacancy"}.`;

      setSuccessMessage(nextSuccessMessage);
      await loadStoredCandidates(vacancyId);
      if (parsedCandidateIds.length > 0) {
        setSelectedCandidateId(parsedCandidateIds[0]);
      }
      sendBrowserNotification("Resume parsing completed", nextSuccessMessage);
    } catch (error) {
      setSuccessMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "CV upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel className="rounded-[30px] p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.35rem] font-semibold text-white">Bulk parse resumes</h2>
          <p className="text-sm text-[#95a8b8]">
            Upload one or many resumes and import them immediately into the app database. Choosing a vacancy is optional.
          </p>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <FormField label="Resume files">
            <Input
              ref={fileInputRef}
              type="file"
              accept={acceptedFileTypes}
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <p className="mt-2 text-xs text-[#7f93a5]">
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? "" : "s"} selected for direct parsing`
                : "Select one or many resumes to import immediately. PDF, DOCX, and DOC are supported."}
            </p>
          </FormField>

          <FormField label="Vacancy (optional)">
            <Select value={vacancyId} onChange={(event) => setVacancyId(event.target.value)}>
              <option value="">
                No vacancy / Talent pool
              </option>
              {vacancies.map((vacancy) => (
                <option key={vacancy.id} value={vacancy.id}>
                  {vacancy.title}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[18px] border border-[#f0d5d7] bg-[#fff7f8] px-4 py-3 text-sm text-[#a65765]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-[18px] border border-[#8cb4a0]/35 bg-[rgba(106,168,133,0.14)] px-4 py-3 text-sm text-[#d8f0e2]">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{successMessage}</p>
            </div>
          </div>
        ) : null}

        {batchFailures.length > 0 ? (
          <div className="mt-4 rounded-[18px] border border-[#f0d5d7] bg-[#fff7f8] px-4 py-3 text-sm text-[#a65765]">
            <p className="font-medium">
              {batchFailures.length} file{batchFailures.length === 1 ? "" : "s"} could not be parsed:
            </p>
            <div className="mt-2 space-y-1">
              {batchFailures.slice(0, 6).map((failure) => (
                <p key={`${failure.filename}-${failure.error}`}>
                  {failure.filename}: {failure.error}
                </p>
              ))}
              {batchFailures.length > 6 ? (
                <p>...and {batchFailures.length - 6} more.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {isUploading ? (
          <div className="mt-4 rounded-[18px] border border-[#89c7e8]/30 bg-[#122433] px-4 py-3 text-sm text-[#d8eef9]">
            <div className="flex items-center gap-3">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <p>Parsing in progress. This can take a few seconds per CV.</p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            icon={isUploading ? LoaderCircle : FileUp}
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className={isUploading ? "opacity-80" : ""}
          >
            {isUploading ? "Parsing resumes..." : "Parse Resumes Now"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClearParsingArea}
            disabled={isUploading}
          >
            Clear Section
          </Button>
        </div>

      </Panel>

      <div ref={storedCandidatesSectionRef} />
      <Panel className="rounded-[30px] p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.35rem] font-semibold text-white">Stored parsed candidates</h2>
          <p className="text-sm text-[#95a8b8]">
            The most recently parsed CVs for this session appear here immediately after parsing completes.
          </p>
        </div>

        {detailErrorMessage ? (
          <div className="mt-4 rounded-[18px] border border-[#f0d5d7] bg-[#fff7f8] px-4 py-3 text-sm text-[#a65765]">
            {detailErrorMessage}
          </div>
        ) : null}

        {storedCandidatesLoading ? (
          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-[#95a8b8]">
            Loading stored candidates...
          </div>
        ) : visibleCandidates.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-[#95a8b8]">
            No resumes are being shown right now. Parse a new CV batch to display the latest results here.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.02]">
              <div className="grid grid-cols-[1.4fr_1fr_120px_170px] gap-4 border-b border-white/8 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                <span>Candidate</span>
                <span>{vacancyId ? "Applied vacancy" : "Best vacancy match"}</span>
                <span>Match</span>
                <span>Parsed</span>
              </div>
              <div className="divide-y divide-white/8">
                {visibleCandidates.map((candidate) => (
                  <button
                    key={candidate.rowKey}
                    type="button"
                    onClick={() => setSelectedCandidateId(candidate.id)}
                    className={`grid w-full grid-cols-[1.4fr_1fr_120px_170px] gap-4 px-5 py-4 text-left transition ${
                      selectedCandidateId === candidate.id ? "bg-[#466d8a]/14" : "bg-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-white">{candidate.name}</p>
                      <p className="mt-1 text-sm text-[#95a8b8]">{candidate.email}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-[#7f93a5]">{candidate.aiSummary}</p>
                    </div>
                    <div className="text-sm text-[#d6e1ea]">{candidate.linkedVacancyTitle}</div>
                    <div className="text-sm font-semibold text-[#9fc6e0]">
                      {formatMatchScore(candidate.matchScore)}
                    </div>
                    <div className="text-sm text-[#95a8b8]">{formatTimestamp(candidate.uploadedAt)}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedCandidate && selectedCandidateView ? (
              <Panel className="rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[1.25rem] font-semibold text-white">{selectedCandidateView.name}</h3>
                    <p className="mt-1 text-sm text-[#95a8b8]">{selectedCandidateView.email}</p>
                  </div>
                  <div className="rounded-full bg-[#466d8a]/18 px-4 py-2 text-sm font-semibold text-[#9fc6e0]">
                    {formatMatchScore(selectedCandidateView.matchScore)}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">{selectedCandidateView.vacancyLabel}</p>
                    <p className="mt-2 text-base text-white">{selectedCandidateView.vacancyLabelTitle}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Parsed on</p>
                    <p className="mt-2 text-base text-white">{formatTimestamp(selectedCandidateView.uploadedAt)}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Summary</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#d6e1ea]">
                    {selectedCandidateView.aiSummary}
                  </p>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Experience</p>
                    <p className="mt-3 text-sm leading-7 text-[#d6e1ea]">{selectedCandidateView.experience}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Education</p>
                    <p className="mt-3 text-sm leading-7 text-[#d6e1ea]">{selectedCandidateView.education}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Matched skills</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedCandidateView.matchedSkills.length > 0
                      ? selectedCandidateView.matchedSkills
                      : selectedCandidateView.skills
                    ).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-[#9fc6e0]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                    Vacancy fit explanation
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#d6e1ea]">{selectedCandidateView.fitExplanation}</p>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                    Role suggestions
                  </p>
                  <p className="mt-2 text-xs text-[#8ea2b4]">
                    These are role ideas based on CV signal overlap, not the same as the vacancy match score above.
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedRoleSuggestions.length > 0 ? (
                      selectedRoleSuggestions.map((suggestion) => (
                        <div key={suggestion.id} className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{suggestion.role_title}</p>
                              <p className="mt-1 text-sm text-[#95a8b8]">
                                {suggestion.department ?? "General"}
                              </p>
                            </div>
                            <div className="rounded-full bg-[#466d8a]/18 px-3 py-1 text-sm font-semibold text-[#9fc6e0]">
                              {formatRoleSuggestionStrength(suggestion.confidence_score)}
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-[#95a8b8]">
                            {suggestion.reason}
                            {` Signal score: ${Math.round(suggestion.confidence_score)}.`}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#95a8b8]">No stored role suggestions for this candidate yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                    Resume header
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Name</p>
                      <p className="mt-2 text-sm text-[#d6e1ea]">{selectedCandidateView.name}</p>
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Email</p>
                      <p className="mt-2 break-all text-sm text-[#d6e1ea]">{selectedCandidateView.email}</p>
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">Role</p>
                      <p className="mt-2 text-sm text-[#d6e1ea]">{selectedCandidateView.vacancyLabelTitle}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                    Formatted CV Preview
                  </p>
                  <div className="mt-3 space-y-4">
                    {getResumePreviewBlocks(selectedCandidate.parsedData).map((block, index) => (
                      <p
                        key={`${selectedCandidate.id}-preview-${index}`}
                        className="whitespace-pre-wrap break-words text-sm leading-8 text-[#d6e1ea]"
                      >
                        {block}
                      </p>
                    ))}
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
        )}
      </Panel>

      <VacancyMatchLookup vacancies={vacancies} />
    </div>
  );
}
