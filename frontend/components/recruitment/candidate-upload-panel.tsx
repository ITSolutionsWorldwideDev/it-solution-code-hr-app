"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Expand,
  FileUp,
  History,
  Info,
  LoaderCircle,
  Plus,
  Sparkles,
} from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type {
  ApplicationApiRecord,
  CandidateApiRecord,
  CandidateManualImportResponse,
  CandidateMatchApiRecord,
  StoredCandidateRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type CandidateMatchLookup = CandidateMatchApiRecord & {
  vacancy_title: string;
};

type StoredCandidateViewModel = StoredCandidateRecord & {
  vacancyLabelTitle: string;
};

const BULK_PARSE_SESSION_STORAGE_KEY = "itsw-bulk-parse-session-results";
const BULK_PARSE_SESSION_IDS_STORAGE_KEY = "itsw-bulk-parse-session-candidate-ids";
const BULK_PARSE_SELECTED_CANDIDATE_STORAGE_KEY = "itsw-bulk-parse-selected-candidate";
const MAX_UPLOAD_BATCH_FILES = 5;
const MAX_UPLOAD_BATCH_BYTES = 4 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PARALLEL_UPLOAD_BATCHES = 2;

type UploadProgressState = {
  processedFiles: number;
  totalFiles: number;
  currentBatch: number;
  totalBatches: number;
};

function parseApiDate(value: string) {
  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  return new Date(normalizedValue);
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

function getCandidateInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CV";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function splitFilesIntoUploadBatches(files: File[]) {
  const batches: File[][] = [];
  let currentBatch: File[] = [];
  let currentBytes = 0;

  for (const file of files) {
    const shouldStartNewBatch =
      currentBatch.length >= MAX_UPLOAD_BATCH_FILES ||
      (currentBatch.length > 0 && currentBytes + file.size > MAX_UPLOAD_BATCH_BYTES);

    if (shouldStartNewBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }

    currentBatch.push(file);
    currentBytes += file.size;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
) {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
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
  vacancyScope: string,
  preservedCandidateIds: string[] = []
): StoredCandidateRecord[] {
  const latestMatchByCandidate = new Map<number, CandidateMatchLookup>();
  const applicationsByCandidate = new Map<number, ApplicationApiRecord[]>();
  const preservedCandidateIdSet = new Set(preservedCandidateIds.map((id) => Number(id)));
  const visibleCandidates = candidates.filter(
    (candidate) => preservedCandidateIdSet.has(candidate.id) || !isPlaceholderCandidate(candidate)
  );
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

function buildImmediateStoredCandidatesFromImport(
  results: CandidateManualImportResponse["results"],
  vacancies: VacancyApiRecord[],
  vacancyScope: string
): StoredCandidateRecord[] {
  const scopedVacancy = vacancyScope
    ? vacancies.find((vacancy) => String(vacancy.id) === vacancyScope) ?? null
    : null;

  return results
    .filter((item) => item.parse_status !== "failed" && item.candidate_id)
    .map((item) => {
      const parsedData = item.parsed_data ?? {};
      const matching = parsedData.matching as
        | {
            applied_match?: { vacancy_id?: string; role_name?: string; score?: number };
          }
        | undefined;
      const fallbackVacancyTitle = matching?.applied_match?.role_name ?? "Best open vacancy match";
      const linkedVacancyTitle = scopedVacancy?.title ?? fallbackVacancyTitle;
      const fitExplanation =
        typeof parsedData.fit_explanation === "string"
          ? parsedData.fit_explanation
          : "No vacancy fit explanation stored yet.";

      return {
        rowKey: `session-${item.candidate_id}-${item.filename}`,
        id: String(item.candidate_id),
        name: item.candidate_name ?? "Parsed candidate",
        email: item.candidate_email ?? "No email extracted",
        aiSummary: item.ai_summary ?? "No parsed summary available yet.",
        skills: item.skills ?? [],
        experience: item.experience ?? "Not extracted yet.",
        education: item.education ?? "Not extracted yet.",
        linkedVacancyId: vacancyScope || matching?.applied_match?.vacancy_id || null,
        linkedVacancyTitle,
        vacancyLabel: vacancyScope ? "Applied to" : "Best vacancy match",
        matchScore: item.score ?? matching?.applied_match?.score ?? null,
        fitExplanation,
        matchedSkills: item.skills ?? [],
        uploadedAt: new Date().toISOString(),
        parsedData,
      };
    });
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

type CandidateUploadPanelProps = {
  onCandidatesImported?: () => void | Promise<void>;
};

export function CandidateUploadPanel({ onCandidatesImported }: CandidateUploadPanelProps) {
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
  const [recentParsedCandidates, setRecentParsedCandidates] = useState<StoredCandidateRecord[]>([]);
  const [storedCandidatesLoading, setStoredCandidatesLoading] = useState(false);
  const [sessionCandidateIds, setSessionCandidateIds] = useState<string[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const acceptedFileTypes =
    ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedSessionResults = window.localStorage.getItem(BULK_PARSE_SESSION_STORAGE_KEY);
      const storedSessionIds = window.localStorage.getItem(BULK_PARSE_SESSION_IDS_STORAGE_KEY);
      const storedSelectedCandidateId = window.localStorage.getItem(BULK_PARSE_SELECTED_CANDIDATE_STORAGE_KEY);

      if (storedSessionResults) {
        const parsedResults = JSON.parse(storedSessionResults) as StoredCandidateRecord[];
        if (Array.isArray(parsedResults) && parsedResults.length > 0) {
          setRecentParsedCandidates(parsedResults);
          setStoredCandidates(parsedResults);
        }
      }

      if (storedSessionIds) {
        const parsedIds = JSON.parse(storedSessionIds) as string[];
        if (Array.isArray(parsedIds)) {
          setSessionCandidateIds(parsedIds);
        }
      }

      if (storedSelectedCandidateId) {
        setSelectedCandidateId(storedSelectedCandidateId);
      }
    } catch {
      // Ignore malformed client-side persistence state.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (recentParsedCandidates.length > 0) {
      window.localStorage.setItem(
        BULK_PARSE_SESSION_STORAGE_KEY,
        JSON.stringify(recentParsedCandidates)
      );
    } else {
      window.localStorage.removeItem(BULK_PARSE_SESSION_STORAGE_KEY);
    }
  }, [recentParsedCandidates]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sessionCandidateIds.length > 0) {
      window.localStorage.setItem(
        BULK_PARSE_SESSION_IDS_STORAGE_KEY,
        JSON.stringify(sessionCandidateIds)
      );
    } else {
      window.localStorage.removeItem(BULK_PARSE_SESSION_IDS_STORAGE_KEY);
    }
  }, [sessionCandidateIds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedCandidateId) {
      window.localStorage.setItem(BULK_PARSE_SELECTED_CANDIDATE_STORAGE_KEY, selectedCandidateId);
    } else {
      window.localStorage.removeItem(BULK_PARSE_SELECTED_CANDIDATE_STORAGE_KEY);
    }
  }, [selectedCandidateId]);

  const loadCandidatesByIds = async (candidateIds: string[]) => {
    if (candidateIds.length === 0) {
      return [] as CandidateApiRecord[];
    }

    const fetchedCandidates = await Promise.all(
      candidateIds.map(async (candidateId) => {
        try {
          return await apiRequest<CandidateApiRecord>({
            path: `/candidates/${candidateId}`,
          });
        } catch {
          return null;
        }
      })
    );

    return fetchedCandidates.filter((candidate): candidate is CandidateApiRecord => candidate !== null);
  };

  const loadStoredCandidates = async (
    selectedVacancyId?: string,
    vacancyRecords?: VacancyApiRecord[],
    preservedIds?: string[],
    fallbackRecords?: StoredCandidateRecord[]
  ) => {
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

      const preservedIdList = preservedIds ?? sessionCandidateIds;
      const missingPreservedIds = preservedIdList.filter(
        (candidateId) => !candidateResponse.some((candidate) => String(candidate.id) === candidateId)
      );
      const fetchedPreservedCandidates = await loadCandidatesByIds(missingPreservedIds);
      const mergedCandidates = [...candidateResponse, ...fetchedPreservedCandidates];

      const vacancy = vacanciesForLookup.find((record) => String(record.id) === vacancyFilter);
      const scopedMatches = matchResponse.map((match) => ({
        ...match,
        vacancy_title: vacancy?.title ?? `Vacancy #${match.vacancy_id}`,
      }));
      const nextCandidates = buildStoredCandidates(
        mergedCandidates,
        applicationResponse,
        scopedMatches,
        vacanciesForLookup,
        vacancyFilter,
        preservedIdList
      );
      const resolvedCandidates = nextCandidates.length > 0 ? nextCandidates : fallbackRecords ?? [];
      setStoredCandidates(resolvedCandidates);
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

  const renderedCandidates = useMemo(() => {
    if (recentParsedCandidates.length > 0) {
      return [...recentParsedCandidates].sort(
        (left, right) => parseApiDate(right.uploadedAt).getTime() - parseApiDate(left.uploadedAt).getTime()
      );
    }

    return visibleCandidates;
  }, [recentParsedCandidates, visibleCandidates]);

  const selectedCandidate = useMemo(
    () => renderedCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [selectedCandidateId, renderedCandidates]
  );
  const selectedCandidateView = useMemo(
    () => buildStoredCandidateViewModel(selectedCandidate),
    [selectedCandidate]
  );

  useEffect(() => {
    if (renderedCandidates.length === 0) {
      if (selectedCandidateId !== null) {
        setSelectedCandidateId(null);
      }
      return;
    }

    if (!selectedCandidateId || !renderedCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(renderedCandidates[0].id);
    }
  }, [selectedCandidateId, renderedCandidates]);

  const handleClearParsingArea = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFiles([]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setBatchFailures([]);
    setRecentParsedCandidates([]);
    setSessionCandidateIds([]);
    setSelectedCandidateId(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BULK_PARSE_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(BULK_PARSE_SESSION_IDS_STORAGE_KEY);
      window.localStorage.removeItem(BULK_PARSE_SELECTED_CANDIDATE_STORAGE_KEY);
    }
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

    const oversizedFile = files.find((file) => file.size > MAX_SINGLE_FILE_BYTES);
    if (oversizedFile) {
      setErrorMessage(
        `${oversizedFile.name} is too large for direct Vercel parsing. Keep each file under ${Math.round(
          MAX_SINGLE_FILE_BYTES / (1024 * 1024)
        )} MB so the request stays below Vercel's 4.5 MB function payload limit.`
      );
      setSuccessMessage(null);
      return;
    }

    setIsUploading(true);
    setUploadProgress(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setBatchFailures([]);

    try {
      const uploadBatches = splitFilesIntoUploadBatches(files);
      const aggregatedResults: CandidateManualImportResponse["results"] = [];
      let processedFiles = 0;

      setUploadProgress({
        processedFiles: 0,
        totalFiles: files.length,
        currentBatch: 1,
        totalBatches: uploadBatches.length,
      });

      const batchResponses = await mapWithConcurrency(
        uploadBatches,
        MAX_PARALLEL_UPLOAD_BATCHES,
        async (batch, index) => {
          setUploadProgress({
            processedFiles,
            totalFiles: files.length,
            currentBatch: index + 1,
            totalBatches: uploadBatches.length,
          });

          const formData = new FormData();
          if (vacancyId) {
            formData.append("vacancy_id", vacancyId);
          }
          for (const file of batch) {
            formData.append("files", file);
          }

          const response = await apiRequest<CandidateManualImportResponse>({
            path: "/candidates/manual-import",
            method: "POST",
            body: formData,
          });

          processedFiles += batch.length;
          setUploadProgress({
            processedFiles,
            totalFiles: files.length,
            currentBatch: Math.min(index + 1, uploadBatches.length),
            totalBatches: uploadBatches.length,
          });

          return response;
        }
      );

      for (const response of batchResponses) {
        aggregatedResults.push(...response.results);
      }

      const failures = aggregatedResults
        .filter((item) => item.error_message)
        .map((item) => ({
          filename: item.filename,
          error: item.error_message ?? "Import failed.",
        }));
      setBatchFailures(failures);
      const parsedCandidateIds = aggregatedResults
        .map((item) => (item.candidate_id ? String(item.candidate_id) : null))
        .filter((value): value is string => value !== null);
      const immediateStoredCandidates = buildImmediateStoredCandidatesFromImport(
        aggregatedResults,
        vacancies,
        vacancyId
      );
      setSessionCandidateIds(parsedCandidateIds);
      setRecentParsedCandidates(immediateStoredCandidates);
      const successCount = aggregatedResults.filter((item) => item.parse_status !== "failed").length;
      const nextSuccessMessage = `${successCount} CV${
        successCount === 1 ? "" : "s"
      } parsed successfully${vacancyId ? " for the selected vacancy" : " without a linked vacancy"} across ${
        uploadBatches.length
      } batch${uploadBatches.length === 1 ? "" : "es"}.`;

      setSuccessMessage(nextSuccessMessage);
      if (immediateStoredCandidates.length > 0) {
        setStoredCandidates(immediateStoredCandidates);
      }
      await loadStoredCandidates(vacancyId, undefined, parsedCandidateIds, immediateStoredCandidates);
      await onCandidatesImported?.();
      if (parsedCandidateIds.length > 0) {
        setSelectedCandidateId(parsedCandidateIds[0]);
      }
      sendBrowserNotification("Resume parsing completed", nextSuccessMessage);
    } catch (error) {
      setSuccessMessage(null);
      const message = error instanceof Error ? error.message : "CV upload failed.";
      setErrorMessage(
        message.includes("Failed to fetch")
          ? "The upload batch was too large for the backend or the network request was interrupted. Try fewer files per run."
          : message
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const progressValue = uploadProgress
    ? Math.max(8, Math.min(92, Math.round((uploadProgress.processedFiles / Math.max(uploadProgress.totalFiles, 1)) * 92)))
    : isUploading
      ? 8
      : successMessage
        ? 100
        : 0;
  const successCount = renderedCandidates.length;
  const primarySkills =
    selectedCandidateView && selectedCandidateView.matchedSkills.length > 0
      ? selectedCandidateView.matchedSkills
      : selectedCandidateView?.skills ?? [];

  return (
    <div className="space-y-8">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes}
        multiple
        className="hidden"
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
      />

      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 rounded-xl border border-white/5 bg-[#182028] p-8 lg:col-span-8">
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#182028]">
            <div className="pointer-events-none absolute right-6 top-6 text-[#2d363e]">
              <CloudUpload className="h-24 w-24" strokeWidth={1.2} />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#3e484c] bg-[#1b232c]/50 px-6 py-14 text-center transition hover:border-[#72d0ed]/50 hover:bg-[#222b33]"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#72d0ed]/10 text-[#a9e9ff] transition group-hover:scale-110">
                <FileUp className="h-8 w-8" />
              </div>
              <h3 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#dae3ee]">
                Drag and drop resumes here
              </h3>
              <p className="mt-2 text-[1rem] text-[#bdc8cd]">
                or <span className="text-[#a9e9ff] underline">browse your files</span>
              </p>
              <div className="mt-7 flex items-center gap-4 text-[0.78rem] font-medium uppercase tracking-[0.16em] text-[#889297]">
                <span>PDF</span>
                <span>•</span>
                <span>DOCX</span>
                <span>•</span>
                <span>RTF</span>
              </div>
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex-1">
              <div className="flex items-start gap-2 text-[#bdc8cd]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-[1rem]">
                  Direct parsing on Vercel works best in small batches. The uploader now sends up to 5 files per request, keeps each request under roughly 4 MB, and runs up to 2 batches in parallel.
                </p>
              </div>
              <p className="mt-3 text-sm text-[#889297]">
                {files.length > 0
                  ? `${files.length} file${files.length === 1 ? "" : "s"} selected for direct parsing.`
                  : "PDF, DOCX and DOC files are supported for direct parsing into the Talent Pool."}
              </p>
              <div className="mt-4 max-w-[340px]">
                <Select value={vacancyId} onChange={(event) => setVacancyId(event.target.value)} className="h-11 rounded-lg border-white/10 bg-[#0f171f]">
                  <option value="">No vacancy / Talent pool</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClearParsingArea}
                disabled={isUploading}
                className="rounded-lg border-[#3e484c] bg-transparent px-6 py-3 text-[#dae3ee] hover:bg-[#2d363e]"
              >
                Clear Section
              </Button>
              <Button
                type="button"
                icon={isUploading ? LoaderCircle : Sparkles}
                onClick={handleUpload}
                disabled={files.length === 0 || isUploading}
                className="rounded-lg bg-[#72d0ed] px-8 py-3 text-[#003642] shadow-[0_20px_30px_rgba(114,208,237,0.14)] hover:bg-[#8adcf4]"
              >
                {isUploading ? "Parsing resumes..." : "Parse Resumes Now"}
              </Button>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-lg border border-[#ffb4ab]/25 bg-[#93000a]/20 px-4 py-4 text-sm text-[#ffdad6]">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-4 text-sm text-green-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                <p>{successMessage}</p>
              </div>
            </div>
          ) : null}

          {batchFailures.length > 0 ? (
            <div className="mt-5 rounded-lg border border-[#ffb4ab]/25 bg-[#93000a]/20 px-4 py-4 text-sm text-[#ffdad6]">
              <p className="font-medium">
                {batchFailures.length} file{batchFailures.length === 1 ? "" : "s"} could not be parsed:
              </p>
              <div className="mt-2 space-y-1">
                {batchFailures.slice(0, 6).map((failure) => (
                  <p key={`${failure.filename}-${failure.error}`}>
                    {failure.filename}: {failure.error}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="col-span-12 space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-white/5 bg-[#182028] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h4 className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-[#dae3ee]">
                Current Activity
              </h4>
              <span className="h-2 w-2 rounded-full bg-[#a9e9ff]" />
            </div>

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between text-[1rem]">
                  <span className="text-[#dae3ee]">
                    {uploadProgress
                      ? `Parsing batch ${uploadProgress.currentBatch}/${uploadProgress.totalBatches} (${uploadProgress.processedFiles}/${uploadProgress.totalFiles} files done)`
                      : isUploading
                        ? `Parsing ${Math.max(files.length, 1)} files...`
                        : successCount > 0
                          ? "Parsing completed"
                          : "Waiting for upload..."}
                  </span>
                  <span className="font-mono text-[#a9e9ff]">{progressValue}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0b141c]">
                  <div
                    className="h-full bg-[#a9e9ff] shadow-[0_0_8px_rgba(114,208,237,0.5)] transition-all duration-500"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                <div>
                  <p className="text-[1.05rem] font-semibold text-green-100">
                    {successCount} CV{successCount === 1 ? "" : "s"} parsed successfully
                  </p>
                  <p className="text-[0.78rem] uppercase tracking-[0.12em] text-green-300/75">
                    Added to Global Talent Pool
                  </p>
                </div>
              </div>

              {batchFailures.length > 0 ? (
                <div className="flex items-start gap-4 rounded-lg border border-[#ffb4ab]/20 bg-[#93000a]/20 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ffb4ab]" />
                  <div>
                    <p className="text-[1.05rem] font-semibold text-[#ffdad6]">
                      {batchFailures.length} file{batchFailures.length === 1 ? "" : "s"} failed
                    </p>
                    <p className="text-[0.78rem] text-[#ffb4ab]/75">
                      {batchFailures[0]?.error ?? "Invalid format"}
                    </p>
                  </div>
                </div>
              ) : null}

              {isUploading ? (
                <div className="rounded-lg border border-[#a9e9ff]/15 bg-[#122433] px-4 py-3 text-sm text-[#d8eef9]">
                  <div className="flex items-center gap-3">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <p>Parsing in progress. This can take a few seconds per CV.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div ref={storedCandidatesSectionRef} />
      <section className="flex min-h-[600px] flex-col overflow-hidden rounded-xl border border-white/5 bg-[#182028] lg:flex-row">
        <div className="flex-1 border-b border-white/5 p-6 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center justify-between gap-4">
            <h3 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#dae3ee]">
              Stored Parsed Candidates
            </h3>
            <div className="flex items-center gap-2 rounded-full border border-white/5 bg-[#0b141c] px-4 py-2 text-[#bdc8cd]">
              <History className="h-4 w-4" />
              <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em]">
                Session Session History
              </span>
            </div>
          </div>

          {detailErrorMessage ? (
            <div className="rounded-lg border border-[#ffb4ab]/25 bg-[#93000a]/20 px-4 py-4 text-sm text-[#ffdad6]">
              {detailErrorMessage}
            </div>
          ) : null}

          {storedCandidatesLoading ? (
            <div className="rounded-lg border border-white/5 bg-[#141c24] px-4 py-5 text-sm text-[#bdc8cd]">
              Loading stored candidates...
            </div>
          ) : renderedCandidates.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-[#141c24] px-4 py-5 text-sm text-[#bdc8cd]">
              No resumes are being shown right now. Parse a new CV batch to display the latest results here.
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_140px] gap-4 border-b border-white/5 px-4 pb-4 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#bdc8cd] md:grid">
                <span>Candidate</span>
                <span>AI Summary</span>
                <span>Timestamp</span>
                <span>Status</span>
              </div>

              <div className="divide-y divide-white/5">
                {renderedCandidates.map((candidate) => (
                  <button
                    key={candidate.rowKey}
                    type="button"
                    onClick={() => setSelectedCandidateId(candidate.id)}
                    className={`group grid w-full gap-4 px-4 py-5 text-left transition md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_140px] ${
                      selectedCandidateId === candidate.id
                        ? "bg-[#222b33]"
                        : "hover:bg-[#1f2830]"
                    }`}
                  >
                    <div className="relative flex items-center gap-3">
                      <div
                        className={`absolute left-[-1rem] top-1/2 h-10 w-0.5 -translate-y-1/2 bg-[#a9e9ff] transition ${
                          selectedCandidateId === candidate.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3e4754] font-semibold text-[#dae3ee]">
                        {getCandidateInitials(candidate.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[1rem] font-semibold text-[#dae3ee]">{candidate.name}</p>
                        <p className="truncate text-[0.74rem] uppercase tracking-[0.08em] text-[#bdc8cd]">
                          {candidate.email}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-1 text-[0.98rem] text-[#bdc8cd]">{candidate.aiSummary}</p>
                    <p className="text-[0.98rem] text-[#bdc8cd]">{formatTimestamp(candidate.uploadedAt)}</p>
                    <div>
                      <span className="inline-flex rounded-full border border-[#a9e9ff]/20 bg-[#a9e9ff]/10 px-3 py-1 text-xs font-medium text-[#a9e9ff]">
                        Talent Pool
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="w-full bg-[#0b141c]/30 p-8 lg:w-[450px]">
          {selectedCandidate && selectedCandidateView ? (
            <div className="flex h-full flex-col gap-8">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#dae3ee]">
                      {selectedCandidateView.name}
                    </h4>
                    <p className="text-[1rem] text-[#bdc8cd]">{selectedCandidateView.vacancyLabelTitle}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 p-3 text-[#a9e9ff] transition hover:border-[#a9e9ff]/40"
                    aria-label="Open candidate details"
                  >
                    <Expand className="h-5 w-5" />
                  </button>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#222b33] p-5">
                  <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                    AI Candidate Summary
                  </h5>
                  <p className="text-[1.02rem] italic leading-8 text-[#dae3ee]/90">
                    "{selectedCandidateView.aiSummary}"
                  </p>
                </div>
              </div>

              <div>
                <h5 className="mb-4 text-[0.74rem] font-medium uppercase tracking-[0.22em] text-[#bdc8cd]">
                  Matched Skills
                </h5>
                <div className="flex flex-wrap gap-2">
                  {primarySkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-white/5 bg-[#2d363e]/60 px-3 py-1 text-[0.72rem] text-[#dae3ee]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Experience</p>
                  <p className="mt-2 text-[1rem] text-[#dae3ee]">{selectedCandidateView.experience}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Education</p>
                  <p className="mt-2 text-[1rem] text-[#dae3ee]">{selectedCandidateView.education}</p>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <h5 className="mb-4 text-[0.74rem] font-medium uppercase tracking-[0.22em] text-[#bdc8cd]">
                  Formatted CV Preview
                </h5>
                <div className="relative flex min-h-[230px] flex-col items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-[#0a1219] px-6 py-8 text-center">
                  <FileUp className="h-10 w-10 text-[#4d5058]" />
                  <p className="mt-4 max-w-[220px] text-[0.92rem] leading-6 text-[#bdc8cd]">
                    Click to expand formatted resume analysis
                  </p>
                  <button
                    type="button"
                    className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#a9e9ff] text-[#003642] transition hover:scale-105"
                    aria-label="Expand formatted CV preview"
                  >
                    <Expand className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-white/5 bg-[#141c24] px-6 text-center text-[#bdc8cd]">
              Parse a CV batch and select a stored candidate to inspect the detail panel.
            </div>
          )}
        </aside>
      </section>

      <button
        type="button"
        className="fixed bottom-8 right-8 z-[100] flex h-16 w-16 items-center justify-center rounded-full bg-[#72d0ed] text-[#003642] shadow-[0_24px_36px_rgba(0,0,0,0.32)] transition hover:rotate-90 hover:brightness-105"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Quick upload"
      >
        <Plus className="h-8 w-8" />
      </button>
    </div>
  );
}
