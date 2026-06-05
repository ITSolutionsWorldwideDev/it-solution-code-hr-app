"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Expand, Filter, Search, X } from "lucide-react";

import { CandidateUploadPanel } from "@/components/recruitment/candidate-upload-panel";
import { useRole } from "@/components/providers/role-provider";
import { apiRequest } from "@/lib/api/client";
import type {
  ApplicationApiRecord,
  CandidateApiRecord,
  CandidateMatchingInsightsApiRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";

type CandidateDatabaseRecord = {
  id: number;
  initials: string;
  name: string;
  email: string;
  phone: string | null;
  rawAddedAt: string | null;
  addedAt: string;
  dedupeKey: string;
  vacancyId: number | null;
  vacancyIds: number[];
  roleTitle: string;
  vacancyTitle: string;
  vacancyLabel: string;
  potentialRole: string | null;
  experienceYears: number | null;
  appliedMatchScore: number | null;
  overallTalentScore: number | null;
  stage: string;
  parseStatus: string | null;
  isPlaceholder: boolean;
  searchBlob: string;
  aiSummary: string;
  skills: string[];
  experience: string;
  education: string;
  parsedData: Record<string, unknown>;
};

const dateFilterOptions = [
  { value: "all", label: "All Time" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "365", label: "Last 12 Months" },
];

const experienceBandOptions = [
  { value: "all", label: "All Levels" },
  { value: "senior", label: "Senior (5+ yr)" },
  { value: "mid", label: "Mid-Level (2-5 yr)" },
  { value: "junior", label: "Junior (0-2 yr)" },
];

const PAGE_SIZE = 25;

const stageLabels: Record<string, string> = {
  parsed: "Parsed",
  ranked: "Ranked",
  primary_shortlist: "Shortlisted",
  reserve_shortlist: "Reserve",
  excluded: "Rejected",
  hr_invite_selected: "HR Invite",
  hr_invite_sent: "Invite Sent",
  hr_interview_scheduled: "Interview",
  hr_in_progress: "In Review",
  hr_passed: "HR Passed",
  hr_rejected: "Rejected",
  technical_interview_scheduled: "Technical",
  technical_in_progress: "In Review",
  technical_passed: "Passed",
  technical_rejected: "Rejected",
  management_interview_scheduled: "Management",
  management_in_progress: "In Review",
  selected: "Selected",
  management_rejected: "Rejected",
  offer_sent: "Offer Sent",
  offer_accepted: "Accepted",
  offer_declined: "Declined",
  hired: "Hired",
};

function parseApiDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAddedDate(value?: string | null) {
  const date = parseApiDate(value);
  if (!date) {
    return "Recently added";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function extractExperienceYears(candidate: CandidateApiRecord) {
  const structuredSources = [
    candidate.parsed_data?.years_experience,
    candidate.parsed_data?.experience_years,
  ];

  for (const source of structuredSources) {
    if (typeof source === "number" && Number.isFinite(source)) {
      return Math.max(0, Math.round(source));
    }

    if (typeof source === "string") {
      const match = source.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        return Math.max(0, Math.round(Number(match[1])));
      }
    }
  }

  if (typeof candidate.experience === "string") {
    const normalized = candidate.experience.trim().toLowerCase();
    const match = normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:years?|yrs?)(?:\s+of\s+experience|\s+experience)?/
    );

    if (!match && /^\d+(?:\.\d+)?$/.test(normalized)) {
      return Math.max(0, Math.round(Number(normalized)));
    }

    if (match) {
      return Math.max(0, Math.round(Number(match[1])));
    }
  }

  return null;
}

function normalizeMatchText(value: string) {
  return value.trim().toLowerCase();
}

function scoreCandidateAgainstVacancy(
  candidate: CandidateApiRecord,
  vacancy: VacancyApiRecord
) {
  const normalizedSkills = Array.from(
    new Set((candidate.skills ?? []).map((skill) => normalizeMatchText(skill)).filter(Boolean))
  );
  const vacancySkills = Array.from(
    new Set((vacancy.required_skills ?? []).map((skill) => normalizeMatchText(skill)).filter(Boolean))
  );

  const overlapCount = vacancySkills.filter((skill) => normalizedSkills.includes(skill)).length;
  const overlapScore = vacancySkills.length > 0 ? (overlapCount / vacancySkills.length) * 70 : 0;

  const searchText = normalizeMatchText(
    [vacancy.title, vacancy.description, vacancy.experience_level, ...vacancySkills].join(" ")
  );
  const keywordHits = normalizedSkills.filter((skill) => searchText.includes(skill)).length;
  const keywordScore = Math.min(20, keywordHits * 4);

  const summaryBlob = normalizeMatchText(
    [candidate.ai_summary, candidate.experience, candidate.education]
      .filter(Boolean)
      .join(" ")
  );
  const titleTokens = vacancy.title
    .split(/\s+/)
    .map((token) => normalizeMatchText(token))
    .filter((token) => token.length >= 4);
  const titleMatches = titleTokens.filter((token) => summaryBlob.includes(token)).length;
  const titleScore = Math.min(10, titleMatches * 5);

  return Math.max(0, Math.min(100, Math.round(overlapScore + keywordScore + titleScore)));
}

function inferTalentPoolMatch(candidate: CandidateApiRecord, vacancies: VacancyApiRecord[]) {
  const openVacancies = vacancies.filter((vacancy) => vacancy.status === "open");
  if (openVacancies.length === 0) {
    return null;
  }

  let bestVacancy: VacancyApiRecord | null = null;
  let bestScore: number | null = null;

  for (const vacancy of openVacancies) {
    const score = scoreCandidateAgainstVacancy(candidate, vacancy);
    if (bestScore === null || score > bestScore) {
      bestScore = score;
      bestVacancy = vacancy;
    }
  }

  if (!bestVacancy || bestScore === null) {
    return null;
  }

  return {
    vacancyId: bestVacancy.id,
    vacancyTitle: bestVacancy.title,
    score: bestScore,
  };
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function getCandidateInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "CV";
  }

  return words
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStagePillTone(stage: string) {
  const normalized = stage.toLowerCase();

  if (normalized.includes("rejected") || normalized === "excluded") {
    return "border-[#ffb4ab]/20 bg-[#93000a] text-[#ffdad6]";
  }

  if (
    normalized.includes("shortlist") ||
    normalized.includes("selected") ||
    normalized.includes("offer") ||
    normalized.includes("hired")
  ) {
    return "border-[#a9e9ff]/20 bg-[#a9e9ff]/10 text-[#a9e9ff]";
  }

  if (normalized.includes("interview") || normalized.includes("progress")) {
    return "border-[#72d0ed]/30 bg-[#72d0ed]/12 text-[#72d0ed]";
  }

  return "border-white/10 bg-[#2d363e] text-[#dae3ee]";
}

function getCandidateMatching(candidate: CandidateApiRecord): CandidateMatchingInsightsApiRecord | null {
  const matching = candidate.parsed_data?.matching;
  if (!matching || typeof matching !== "object") {
    return null;
  }

  return matching as CandidateMatchingInsightsApiRecord;
}

function isPlaceholderCandidate(candidate: CandidateApiRecord) {
  const parseStatus =
    typeof candidate.parsed_data?.parse_status === "string"
      ? candidate.parsed_data.parse_status
      : null;

  return (
    candidate.name === "Pending Candidate" ||
    candidate.email.endsWith("@placeholder.local") ||
    parseStatus === "pending"
  );
}

function inferDepartment(roleTitle: string) {
  const normalized = roleTitle.toLowerCase();

  if (
    normalized.includes("engineer") ||
    normalized.includes("developer") ||
    normalized.includes("frontend") ||
    normalized.includes("backend") ||
    normalized.includes("cloud") ||
    normalized.includes("devops") ||
    normalized.includes("architect") ||
    normalized.includes("data") ||
    normalized.includes("ml")
  ) {
    return "Engineering";
  }

  if (normalized.includes("product")) {
    return "Product";
  }

  if (normalized.includes("design") || normalized.includes("ux") || normalized.includes("ui")) {
    return "Design";
  }

  if (normalized.includes("sales") || normalized.includes("account")) {
    return "Sales";
  }

  return "General";
}

function buildDatabaseRecords(
  candidates: CandidateApiRecord[],
  applications: ApplicationApiRecord[],
  vacancies: VacancyApiRecord[]
) {
  const vacancyById = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]));
  const applicationsByCandidate = new Map<number, ApplicationApiRecord[]>();

  for (const application of applications) {
    const existing = applicationsByCandidate.get(application.candidate_id) ?? [];
    existing.push(application);
    applicationsByCandidate.set(application.candidate_id, existing);
  }

  const records = candidates
    .map<CandidateDatabaseRecord>((candidate) => {
      const parsedData = candidate.parsed_data ?? {};
      const linkedApplications = [...(applicationsByCandidate.get(candidate.id) ?? [])].sort((left, right) => {
        const leftTime = parseApiDate(left.created_at)?.getTime() ?? 0;
        const rightTime = parseApiDate(right.created_at)?.getTime() ?? 0;
        return rightTime - leftTime;
      });
      const latestApplication = linkedApplications[0];
      const linkedVacancy = latestApplication
        ? vacancyById.get(latestApplication.vacancy_id)
        : null;
      const matching = getCandidateMatching(candidate);
      const inferredTalentPoolMatch = inferTalentPoolMatch(candidate, vacancies);
      const selectedVacancyId = asNumber(parsedData.selected_vacancy_id);
      const selectedVacancyTitle = asString(parsedData.selected_vacancy_title);
      const selectedVacancy =
        (selectedVacancyId ? vacancyById.get(selectedVacancyId) : null) ??
        (inferredTalentPoolMatch ? vacancyById.get(inferredTalentPoolMatch.vacancyId) ?? null : null);
      const hasAppliedVacancy = Boolean(linkedVacancy);
      const talentPoolPotentialTitle =
        selectedVacancy?.title ??
        selectedVacancyTitle ??
        matching?.potential_match?.role_name ??
        inferredTalentPoolMatch?.vacancyTitle ??
        null;
      const matchedVacancyTitle =
        matching?.applied_match?.role_name ??
        matching?.potential_match?.role_name ??
        (typeof parsedData.role_title === "string" ? parsedData.role_title : null) ??
        (typeof parsedData.job_title === "string" ? parsedData.job_title : null);
      const roleTitle =
        linkedVacancy?.title ??
        talentPoolPotentialTitle ??
        matchedVacancyTitle ??
        "No linked vacancy";
      const vacancyTitle = roleTitle;
      const vacancyLabel = hasAppliedVacancy
          ? "Applied vacancy"
          : talentPoolPotentialTitle
            ? "Talent pool best match"
            : "Best vacancy match";
      const potentialRole =
        talentPoolPotentialTitle ??
        matching?.potential_match?.role_name ??
        null;
      const stage = latestApplication?.stage ?? "parsed";
      const addedAt = asString(parsedData.parsed_at) ?? latestApplication?.created_at ?? null;
      const experienceYears = extractExperienceYears(candidate);
      const appliedMatchScore =
        matching?.applied_match?.score ??
        (hasAppliedVacancy ? latestApplication?.ranking_score : null) ??
        latestApplication?.match_score ??
        (hasAppliedVacancy ? candidate.match_score : null) ??
        null;
      const overallTalentScore =
        asNumber(parsedData.fit_score) ??
        matching?.talent_insights?.overall_score ??
        matching?.potential_match?.score ??
        candidate.match_score ??
        inferredTalentPoolMatch?.score ??
        appliedMatchScore;
      const parseStatus =
        typeof parsedData.parse_status === "string"
          ? parsedData.parse_status
          : null;
      const dedupeKey =
        asString(parsedData.file_checksum)?.toLowerCase() ??
        candidate.email.trim().toLowerCase() ??
        candidate.name.trim().toLowerCase();
      const searchBlob = [
        candidate.name,
        candidate.email,
        roleTitle,
        vacancyTitle,
        potentialRole ?? "",
        candidate.skills.join(" "),
        candidate.ai_summary ?? "",
        asString(parsedData.executive_summary) ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return {
        id: candidate.id,
        initials: getCandidateInitials(candidate.name),
        name: candidate.name,
        email: candidate.email,
        phone: asString(parsedData.phone) ?? candidate.phone ?? null,
        rawAddedAt: addedAt,
        addedAt: formatAddedDate(addedAt),
        dedupeKey,
        vacancyId: hasAppliedVacancy
          ? latestApplication?.vacancy_id ?? null
          : selectedVacancyId ?? inferredTalentPoolMatch?.vacancyId ?? null,
        vacancyIds: Array.from(new Set([
          ...linkedApplications.map((application) => application.vacancy_id),
          ...(selectedVacancyId ? [selectedVacancyId] : []),
          ...(inferredTalentPoolMatch ? [inferredTalentPoolMatch.vacancyId] : []),
        ])),
        roleTitle,
        vacancyTitle,
        vacancyLabel,
        potentialRole,
        experienceYears,
        appliedMatchScore,
        overallTalentScore,
        stage,
        parseStatus,
        isPlaceholder: isPlaceholderCandidate(candidate),
        searchBlob,
        aiSummary:
          candidate.ai_summary ??
          asString(parsedData.executive_summary) ??
          "No parsed summary available yet.",
        skills: candidate.skills,
        experience: candidate.experience ?? "No experience parsed yet.",
        education: candidate.education ?? "No education parsed yet.",
        parsedData,
      };
    })
    .sort((left, right) => {
      const rightTime = parseApiDate(right.rawAddedAt)?.getTime() ?? 0;
      const leftTime = parseApiDate(left.rawAddedAt)?.getTime() ?? 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      const stageDiff = (right.experienceYears ?? -1) - (left.experienceYears ?? -1);
      if (stageDiff !== 0) {
        return stageDiff;
      }
      return left.name.localeCompare(right.name);
    });

  const dedupedByIdentity = new Map<string, CandidateDatabaseRecord>();
  for (const record of records) {
    const identityKey = `${record.dedupeKey}|${record.vacancyId ?? "no-vacancy"}`;
    const existing = dedupedByIdentity.get(identityKey);
    if (!existing) {
      dedupedByIdentity.set(identityKey, record);
      continue;
    }

    const existingTime = parseApiDate(existing.rawAddedAt)?.getTime() ?? 0;
    const recordTime = parseApiDate(record.rawAddedAt)?.getTime() ?? 0;
    if (recordTime >= existingTime) {
      dedupedByIdentity.set(identityKey, record);
    }
  }

  const dedupedByCandidate = new Map<string, CandidateDatabaseRecord>();
  for (const record of dedupedByIdentity.values()) {
    const candidateKey = record.dedupeKey;
    const existing = dedupedByCandidate.get(candidateKey);
    if (!existing) {
      dedupedByCandidate.set(candidateKey, record);
      continue;
    }

    const existingTime = parseApiDate(existing.rawAddedAt)?.getTime() ?? 0;
    const recordTime = parseApiDate(record.rawAddedAt)?.getTime() ?? 0;
    if (recordTime >= existingTime) {
      dedupedByCandidate.set(candidateKey, record);
    }
  }

  return [...dedupedByCandidate.values()].filter((record) => !record.isPlaceholder);
}

function ScoreRing({ value, tone = "primary" }: { value: number | null; tone?: "primary" | "muted" }) {
  const hasValue = value !== null && Number.isFinite(value);
  const numeric = hasValue ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (numeric / 100) * circumference;
  const strokeColor = tone === "primary" ? "#a9e9ff" : "rgba(169,233,255,0.7)";

  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        {hasValue ? (
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <span className={`absolute text-[10px] font-bold ${tone === "primary" ? "text-[#a9e9ff]" : "text-[#8bcce2]"}`}>
        {hasValue ? `${numeric}%` : "--"}
      </span>
    </div>
  );
}

export function CandidateDatabasePageClient() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<"database" | "bulk_parse">("database");
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [applications, setApplications] = useState<ApplicationApiRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedVacancyId, setSelectedVacancyId] = useState("all");
  const [experienceBand, setExperienceBand] = useState("all");
  const [matchScoreFilter, setMatchScoreFilter] = useState<0 | 60 | 80>(0);
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [candidateResponse, applicationResponse, vacancyResponse] = await Promise.all([
        apiRequest<CandidateApiRecord[]>({ path: "/candidates/" }),
        apiRequest<ApplicationApiRecord[]>({ path: "/applications/" }),
        apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" }),
      ]);

      setCandidates(candidateResponse);
      setApplications(applicationResponse);
      setVacancies(vacancyResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the candidate database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const databaseRecords = useMemo(
    () => buildDatabaseRecords(candidates, applications, vacancies),
    [applications, candidates, vacancies]
  );
  const openVacancies = useMemo(
    () => vacancies.filter((vacancy) => vacancy.status === "open"),
    [vacancies]
  );

  const filteredRecords = useMemo(() => {
    const freeTextQuery = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const maxAgeDays = Number(dateFilter);

    return databaseRecords.filter((record) => {
      if (selectedVacancyId === "no_vacancy") {
        if (record.vacancyIds.length > 0) {
          return false;
        }
      } else if (selectedVacancyId !== "all") {
        if (!record.vacancyIds.includes(Number(selectedVacancyId))) {
          return false;
        }
      }

      if (freeTextQuery && !record.searchBlob.includes(freeTextQuery)) {
        return false;
      }

      const years = record.experienceYears ?? 0;
      if (experienceBand === "senior" && years < 5) {
        return false;
      }
      if (experienceBand === "mid" && (years < 2 || years > 5)) {
        return false;
      }
      if (experienceBand === "junior" && years > 2) {
        return false;
      }

      const effectiveScore = record.appliedMatchScore ?? record.overallTalentScore ?? 0;
      if (effectiveScore < matchScoreFilter) {
        return false;
      }

      if (Number.isFinite(maxAgeDays)) {
        const candidateDate = parseApiDate(record.rawAddedAt);
        if (candidateDate) {
          const ageInDays = (now - candidateDate.getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays > maxAgeDays) {
            return false;
          }
        }
      }

      return true;
    });
  }, [databaseRecords, dateFilter, experienceBand, matchScoreFilter, searchQuery, selectedVacancyId]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedCandidate = useMemo(
    () => databaseRecords.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [databaseRecords, selectedCandidateId]
  );
  const showingFrom = filteredRecords.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredRecords.length);
  const visiblePageNumbers = Array.from(new Set([1, 2, 3, totalPages].filter((page) => page <= totalPages)));

  const handleResetFilters = () => {
    setSelectedVacancyId("all");
    setExperienceBand("all");
    setMatchScoreFilter(0);
    setDateFilter("all");
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleBackfill = async () => {
    setBackfillLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<{
        processed_count: number;
        skipped_count: number;
        skipped: Array<{ candidate_id: number; reason: string }>;
      }>({
        path: "/candidates/backfill-hidden-potentials",
        method: "POST",
      });

      setSuccessMessage(
        `Hidden potentials refreshed for ${response.processed_count} candidate${response.processed_count === 1 ? "" : "s"}.`
      );
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to recompute hidden potentials.");
    } finally {
      setBackfillLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVacancyId, experienceBand, matchScoreFilter, dateFilter, searchQuery]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-[2.8rem] font-semibold tracking-[-0.04em] text-[#dae3ee]">Candidate Database</h2>
          <p className="mt-1 text-[1.05rem] text-[#bdc8cd]">
            Manage and evaluate your talent pool with precision.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleBackfill()}
            disabled={backfillLoading || openVacancies.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-[#72d0ed]/20 bg-[#72d0ed]/10 px-4 py-2 text-[#a9e9ff] transition hover:bg-[#72d0ed]/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-[1rem]">
              {backfillLoading ? "Re-scoring..." : "Re-score Talent Pool"}
            </span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-white/5 bg-[#222b33] px-4 py-2 text-[#bdc8cd] transition hover:text-[#a9e9ff]"
          >
            <Filter className="h-4 w-4" />
            <span className="text-[1rem]">Filters</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-white/5 bg-[#222b33] px-4 py-2 text-[#bdc8cd] transition hover:text-[#a9e9ff]"
          >
            <Download className="h-4 w-4" />
            <span className="text-[1rem]">Export</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bulk_parse")}
            className="inline-flex items-center rounded-lg border border-[#72d0ed]/20 bg-[#72d0ed]/10 px-4 py-2 text-[#a9e9ff] transition hover:bg-[#72d0ed]/15"
          >
            Bulk Parse CVs
          </button>
        </div>
      </div>

      {activeTab === "bulk_parse" ? (
        <CandidateUploadPanel onCandidatesImported={load} />
      ) : (
        <>
          {errorMessage ? (
            <Panel className="border-[#8f3a47] bg-[rgba(77,19,28,0.55)] text-[#ffd0d7]">
              {errorMessage}
            </Panel>
          ) : null}

          {successMessage ? (
            <Panel className="border-[#2f6550] bg-[rgba(16,42,33,0.72)] text-[#b8efcf]">
              {successMessage}
            </Panel>
          ) : null}

          {openVacancies.length === 0 ? (
            <Panel className="border-[#7b5c2e] bg-[rgba(74,54,18,0.45)] text-[#f5dfb1]">
              No open vacancies are currently available. Talent-pool candidates can only receive a potential role and score after at least one vacancy is marked as <span className="font-semibold">open</span>.
            </Panel>
          ) : null}

          <div className="rounded-xl border border-white/5 bg-[rgba(24,32,40,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-6 overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#bdc8cd]">Vacancy:</span>
                <Select
                  value={selectedVacancyId}
                  onChange={(event) => setSelectedVacancyId(event.target.value)}
                  className="h-9 rounded-md border-none bg-[#060f16] py-1 pr-8 text-[#a9e9ff]"
                >
                  <option value="all">All open vacancies</option>
                  <option value="no_vacancy">No linked vacancy / Talent pool</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={String(vacancy.id)}>
                      {vacancy.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="h-6 w-px shrink-0 bg-white/10" />

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#bdc8cd]">Experience:</span>
                <Select
                  value={experienceBand}
                  onChange={(event) => setExperienceBand(event.target.value)}
                  className="h-9 rounded-md border-none bg-[#060f16] py-1 pr-8 text-[#a9e9ff]"
                >
                  {experienceBandOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="h-6 w-px shrink-0 bg-white/10" />

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#bdc8cd]">Match Score:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchScoreFilter(0)}
                    className={`rounded px-3 py-1 text-xs font-bold ${
                      matchScoreFilter === 0
                        ? "border border-[#a9e9ff]/20 bg-[#a9e9ff]/10 text-[#a9e9ff]"
                        : "border border-white/5 bg-[#060f16] text-[#bdc8cd]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchScoreFilter(60)}
                    className={`rounded px-3 py-1 text-xs ${
                      matchScoreFilter === 60
                        ? "border border-[#a9e9ff]/20 bg-[#a9e9ff]/10 text-[#a9e9ff]"
                        : "border border-white/5 bg-[#060f16] text-[#bdc8cd]"
                    }`}
                  >
                    60%+
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchScoreFilter(80)}
                    className={`rounded px-3 py-1 text-xs ${
                      matchScoreFilter === 80
                        ? "border border-[#a9e9ff]/20 bg-[#a9e9ff]/10 text-[#a9e9ff]"
                        : "border border-white/5 bg-[#060f16] text-[#bdc8cd]"
                    }`}
                  >
                    80%+
                  </button>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="inline-flex rounded bg-[#a9e9ff]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-[#a9e9ff]">
                  Active: {filteredRecords.length.toLocaleString("en-US")} Candidates
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-12 px-6 py-2 text-[11px] uppercase tracking-[0.22em] text-[#bdc8cd]">
              <div className="col-span-3">Candidate Information</div>
              <div className="col-span-3 text-center">Applied Match &amp; Role</div>
              <div className="col-span-3 text-center">Potential Match &amp; Role</div>
              <div className="col-span-1">Exp.</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#182028] p-3 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#889297]" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search candidates, skills, or roles..."
                    className="h-12 rounded-full border-white/5 bg-[#060f16] pl-12 pr-16"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setSearchQuery(searchInput);
                      }
                    }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-[#2d363e] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#bdc8cd]">
                    ⌘ K
                  </div>
                </div>

                <Select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-12 min-w-[200px] rounded-full border-white/5 bg-[#060f16]"
                >
                  {dateFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {loading ? (
              <Panel className="rounded-xl border-white/5 bg-[#182028] p-6 text-[#97aaba]">
                Loading candidate database...
              </Panel>
            ) : paginatedRecords.length === 0 ? (
              <Panel className="rounded-xl border-white/5 bg-[#182028] p-6 text-[#97aaba]">
                No candidates matched the current filters.
              </Panel>
            ) : (
              paginatedRecords.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  className="grid w-full grid-cols-12 items-center rounded-xl border border-white/5 bg-[rgba(24,32,40,0.7)] px-6 py-4 text-left backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#a9e9ff]/40 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
                >
                  <div className="col-span-3 flex items-center gap-4">
                    <div>
                      <h4 className="text-[1.05rem] text-[#dae3ee]">{candidate.name}</h4>
                      <p className="text-sm text-[#bdc8cd]">{candidate.email}</p>
                    </div>
                  </div>

                  <div className="col-span-3 flex flex-col items-center gap-1">
                    <ScoreRing value={candidate.appliedMatchScore} tone="primary" />
                    <p className="text-center text-[10px] text-[#dae3ee]">
                      Applied: {candidate.appliedMatchScore !== null ? candidate.roleTitle : "Not matched yet"}
                    </p>
                  </div>

                  <div className="col-span-3 flex flex-col items-center gap-1">
                    <ScoreRing value={candidate.overallTalentScore ?? candidate.appliedMatchScore} tone="muted" />
                    <p className="text-center text-[10px] text-[#bdc8cd]">
                      Potential: {candidate.potentialRole ?? "No potential role yet"}
                    </p>
                  </div>

                  <div className="col-span-1">
                    <p className="text-[1rem] text-[#dae3ee]">
                      {candidate.experienceYears !== null ? `${candidate.experienceYears}y` : "-"}
                    </p>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a9e9ff]">
                      View Profile
                    </span>
                    <Expand className="h-4 w-4 text-[#a9e9ff]" />
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStagePillTone(
                        candidate.stage
                      )}`}
                    >
                      {candidate.parseStatus === "failed"
                        ? "Needs Review"
                        : stageLabels[candidate.stage] ?? candidate.stage}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-8">
            <p className="text-sm text-[#bdc8cd]">
              Showing {showingFrom} to {showingTo} of {filteredRecords.length.toLocaleString("en-US")} candidates
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 text-[#bdc8cd] transition hover:bg-[#2d363e] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {visiblePageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                    currentPage === page
                      ? "border-[#72d0ed] bg-[#72d0ed] font-bold text-[#003642]"
                      : "border-white/5 text-[#dae3ee] hover:bg-[#2d363e]"
                  }`}
                >
                  {page}
                </button>
              ))}

              {totalPages > 3 ? <span className="px-2 text-[#bdc8cd]">...</span> : null}

              {totalPages > 3 && !visiblePageNumbers.includes(totalPages) ? (
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 text-[#dae3ee] transition hover:bg-[#2d363e]"
                >
                  {totalPages}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 text-[#bdc8cd] transition hover:bg-[#2d363e] disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {(role === "HR" || role === "Admin") && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleBackfill}
                disabled={backfillLoading}
                className="rounded-xl border-[#7eb9df]/14 bg-[#222b33] px-4 py-2 text-[#bdc8cd] hover:text-[#a9e9ff]"
              >
                {backfillLoading ? "Refreshing..." : "Refresh Matches"}
              </Button>
            </div>
          )}
        </>
      )}

      {selectedCandidate ? (
        <div className="fixed inset-0 z-[140] bg-[#060f16]/90 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
              <div>
                <h3 className="text-[1.8rem] font-semibold tracking-[-0.03em] text-[#dae3ee]">
                  {selectedCandidate.name}
                </h3>
                <p className="mt-1 text-[0.98rem] text-[#bdc8cd]">
                  {selectedCandidate.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateId(null)}
                className="rounded-lg border border-white/10 p-3 text-[#dae3ee] transition hover:border-[#a9e9ff]/40 hover:text-[#a9e9ff]"
                aria-label="Close parsed profile"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[420px_minmax(0,1fr)]">
              <aside className="overflow-y-auto border-b border-white/5 bg-[#101922] p-6 lg:border-b-0 lg:border-r">
                <div className="space-y-6">
                  <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                    <h5 className="mb-4 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                      Parsed Candidate Profile
                    </h5>
                    <div className="space-y-4 text-[0.98rem] text-[#dae3ee]">
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Name</p>
                        <p className="mt-1 break-words">
                          {asString(asRecord(selectedCandidate.parsedData?.parsed_fields)?.name) ?? selectedCandidate.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Email</p>
                        <p className="mt-1 break-all">
                          {asString(asRecord(selectedCandidate.parsedData?.parsed_fields)?.email) ?? selectedCandidate.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Phone</p>
                        <p className="mt-1 break-words">
                          {asString(asRecord(selectedCandidate.parsedData?.parsed_fields)?.phone) ?? selectedCandidate.phone ?? "No phone parsed"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Best Open Vacancy</p>
                        <p className="mt-1 break-words">
                          {asString(selectedCandidate.parsedData?.selected_vacancy_title) ?? selectedCandidate.potentialRole ?? "No best vacancy stored"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Potential Role Score</p>
                        <p className="mt-1">
                          {selectedCandidate.overallTalentScore !== null
                            ? `${Math.max(0, Math.min(100, Math.round(selectedCandidate.overallTalentScore)))}%`
                            : "No talent-pool score stored yet"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Parsed At</p>
                        <p className="mt-1">
                          {selectedCandidate.rawAddedAt ? formatAddedDate(selectedCandidate.rawAddedAt) : "No parse timestamp stored"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                    <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                      Matched Skills
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {(asStringArray(selectedCandidate.parsedData?.matched_skills).length > 0
                        ? asStringArray(selectedCandidate.parsedData?.matched_skills)
                        : selectedCandidate.skills
                      ).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md border border-white/5 bg-[#2d363e]/60 px-3 py-1 text-[0.78rem] text-[#dae3ee]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>

              <main className="overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                    <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                      AI Candidate Summary
                    </h5>
                    <p className="text-[1rem] italic leading-8 text-[#dae3ee]/90">
                      "{selectedCandidate.aiSummary}"
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                      <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                        Experience
                      </h5>
                      <p className="text-[0.98rem] leading-7 text-[#dae3ee]">
                        {asString(asRecord(selectedCandidate.parsedData?.parsed_fields)?.experience) ?? selectedCandidate.experience}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                      <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                        Education
                      </h5>
                      <p className="text-[0.98rem] leading-7 text-[#dae3ee]">
                        {asString(asRecord(selectedCandidate.parsedData?.parsed_fields)?.education) ?? selectedCandidate.education}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                      <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                        Key Strengths
                      </h5>
                      <div className="space-y-2">
                        {asStringArray(selectedCandidate.parsedData?.pros).length > 0 ? asStringArray(selectedCandidate.parsedData?.pros).map((item) => (
                          <p key={item} className="text-[0.96rem] text-[#dae3ee]">{item}</p>
                        )) : <p className="text-[0.96rem] text-[#bdc8cd]">No strengths were stored.</p>}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                      <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                        Attention Points
                      </h5>
                      <div className="space-y-2">
                        {asStringArray(selectedCandidate.parsedData?.cons).length > 0 ? asStringArray(selectedCandidate.parsedData?.cons).map((item) => (
                          <p key={item} className="text-[0.96rem] text-[#dae3ee]">{item}</p>
                        )) : <p className="text-[0.96rem] text-[#bdc8cd]">No attention points were stored.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#182028] p-5">
                    <h5 className="mb-3 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-[#a9e9ff]">
                      Parsing Details
                    </h5>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Parse Status</p>
                        <p className="mt-2 text-[0.96rem] text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.parse_status) ?? selectedCandidate.parseStatus ?? "Not stored"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Match Status</p>
                        <p className="mt-2 text-[0.96rem] text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.match_status) ?? "Not stored"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Source</p>
                        <p className="mt-2 text-[0.96rem] text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.source) ?? "Unknown source"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Source File</p>
                        <p className="mt-2 break-words text-[0.96rem] text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.filename) ??
                            asString(selectedCandidate.parsedData?.original_file_name) ??
                            "No file name stored"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Content Type</p>
                        <p className="mt-2 text-[0.96rem] text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.content_type) ?? "Not stored"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Page Count</p>
                        <p className="mt-2 text-[0.96rem] text-[#dae3ee]">
                          {asNumber(selectedCandidate.parsedData?.page_count) ?? "Not stored"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4 md:col-span-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">File Checksum</p>
                        <p className="mt-2 break-all text-[0.96rem] text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.file_checksum) ?? "Not stored"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-[#0b141c] p-4 md:col-span-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#bdc8cd]">Latest Parser Note</p>
                        <p className="mt-2 text-[0.96rem] leading-7 text-[#dae3ee]">
                          {asString(selectedCandidate.parsedData?.last_error) ?? "No parser errors were stored for this candidate."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
