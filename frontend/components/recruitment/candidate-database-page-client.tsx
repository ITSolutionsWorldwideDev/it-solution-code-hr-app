"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Search } from "lucide-react";

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
  rawAddedAt: string | null;
  addedAt: string;
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
  searchBlob: string;
};

const dateFilterOptions = [
  { value: "all", label: "All Time" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "365", label: "Last 12 Months" },
];

const stageLabels: Record<string, string> = {
  parsed: "Parsed",
  ranked: "Ranked",
  primary_shortlist: "Shortlisted",
  reserve_shortlist: "Reserve",
  excluded: "Excluded",
  hr_invite_selected: "HR Invite",
  hr_invite_sent: "Invite Sent",
  hr_interview_scheduled: "HR Interview",
  hr_in_progress: "HR In Progress",
  hr_passed: "HR Passed",
  hr_rejected: "HR Rejected",
  technical_interview_scheduled: "Technical Interview",
  technical_in_progress: "Technical In Progress",
  technical_passed: "Technical Passed",
  technical_rejected: "Technical Rejected",
  management_interview_scheduled: "Management Interview",
  management_in_progress: "Management In Progress",
  selected: "Selected",
  management_rejected: "Management Rejected",
  offer_sent: "Offer Sent",
  offer_accepted: "Offer Accepted",
  offer_declined: "Offer Declined",
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

function getStageTone(stage: string) {
  const normalized = stage.toLowerCase();

  if (normalized.includes("rejected") || normalized === "excluded") {
    return "border-[#8f3a47] bg-[#3b1820] text-[#ffb7c2]";
  }

  if (normalized.includes("offer") || normalized === "selected" || normalized === "hired") {
    return "border-[#2f6550] bg-[#102a21] text-[#91e0b7]";
  }

  return "border-[#355c8e] bg-[#11233d] text-[#b8d0ff]";
}

function formatScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not scored";
  }

  return `${Math.round(value)}%`;
}

function getCandidateMatching(candidate: CandidateApiRecord): CandidateMatchingInsightsApiRecord | null {
  const matching = candidate.parsed_data?.matching;
  if (!matching || typeof matching !== "object") {
    return null;
  }

  return matching as CandidateMatchingInsightsApiRecord;
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
      const matchedVacancyTitle =
        matching?.applied_match?.role_name ??
        matching?.potential_match?.role_name ??
        String(candidate.parsed_data?.role_title ?? candidate.parsed_data?.job_title ?? "Candidate Profile");
      const roleTitle =
        linkedVacancy?.title ??
        matchedVacancyTitle;
      const vacancyTitle = linkedVacancy?.title ?? matchedVacancyTitle;
      const vacancyLabel = linkedVacancy ? "Applied vacancy" : "Best vacancy match";
      const potentialRole = matching?.potential_match?.role_name ?? null;
      const stage = latestApplication?.stage ?? "parsed";
      const addedAt = latestApplication?.created_at ?? null;
      const experienceYears = extractExperienceYears(candidate);
      const appliedMatchScore =
        matching?.applied_match?.score ??
        latestApplication?.ranking_score ??
        latestApplication?.match_score ??
        candidate.match_score ??
        null;
      const overallTalentScore = matching?.talent_insights?.overall_score ?? null;
      const searchBlob = [
        candidate.name,
        candidate.email,
        roleTitle,
        vacancyTitle,
        potentialRole ?? "",
        candidate.skills.join(" "),
        candidate.ai_summary ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return {
        id: candidate.id,
        initials: getCandidateInitials(candidate.name),
        name: candidate.name,
        rawAddedAt: addedAt,
        addedAt: formatAddedDate(addedAt),
        vacancyId: latestApplication?.vacancy_id ?? null,
        vacancyIds: linkedApplications.map((application) => application.vacancy_id),
        roleTitle,
        vacancyTitle,
        vacancyLabel,
        potentialRole,
        experienceYears,
        appliedMatchScore,
        overallTalentScore,
        stage,
        searchBlob,
      };
    })
    .sort((left, right) => {
      const stageDiff = (right.experienceYears ?? -1) - (left.experienceYears ?? -1);
      if (stageDiff !== 0) {
        return stageDiff;
      }
      return left.name.localeCompare(right.name);
    });

  const dedupedByEmail = new Map<string, CandidateDatabaseRecord>();
  for (const record of records) {
    const dedupeKey = record.name.trim().toLowerCase() + "|" + record.id;
    const emailKey = `${dedupeKey}|${record.vacancyId ?? "no-vacancy"}`;
    const existing = dedupedByEmail.get(emailKey);
    if (!existing) {
      dedupedByEmail.set(emailKey, record);
      continue;
    }

    const existingTime = parseApiDate(existing.rawAddedAt)?.getTime() ?? 0;
    const recordTime = parseApiDate(record.rawAddedAt)?.getTime() ?? 0;
    if (recordTime >= existingTime) {
      dedupedByEmail.set(emailKey, record);
    }
  }

  const dedupedByCandidate = new Map<string, CandidateDatabaseRecord>();
  for (const record of dedupedByEmail.values()) {
    const candidateKey = record.id.toString();
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

  return [...dedupedByCandidate.values()];
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
  const [roleFilter, setRoleFilter] = useState("");
  const [maxExperience, setMaxExperience] = useState(20);
  const [experienceFilterEnabled, setExperienceFilterEnabled] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");

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

  const filteredRecords = useMemo(() => {
    const roleQuery = roleFilter.trim().toLowerCase();
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

      if (roleQuery && !record.roleTitle.toLowerCase().includes(roleQuery)) {
        return false;
      }

      if (freeTextQuery && !record.searchBlob.includes(freeTextQuery)) {
        return false;
      }

      if (experienceFilterEnabled && (record.experienceYears ?? 0) > maxExperience) {
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
  }, [databaseRecords, dateFilter, maxExperience, roleFilter, searchQuery, selectedVacancyId, vacancies]);

  const handleResetFilters = () => {
    setSelectedVacancyId("all");
    setRoleFilter("");
    setMaxExperience(20);
    setExperienceFilterEnabled(false);
    setDateFilter("all");
    setSearchInput("");
    setSearchQuery("");
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <h1 className="text-[2.9rem] font-semibold tracking-[-0.05em] text-white">
            Candidate Database
          </h1>
          <p className="max-w-[860px] text-[1.05rem] leading-8 text-[#97aaba]">
            Manage your global talent pipeline. Filter through parsed qualifications and historical
            candidate data in one clean database view.
          </p>
        </div>

        <div className="flex w-full max-w-[760px] flex-col gap-3 xl:items-end">
          <div className="flex w-full flex-col gap-3 rounded-[24px] border border-white/10 bg-[#151b22] p-2 sm:flex-row sm:items-center sm:justify-between xl:max-w-[760px]">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveTab("database")}
                className={`rounded-[18px] border px-4 py-3 text-left transition ${
                  activeTab === "database"
                    ? "border-[#7eb9df]/35 bg-[#1b2734] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-transparent bg-transparent text-[#a7bbcb] hover:border-white/10 hover:text-white"
                }`}
              >
                <p className="text-[1rem] font-semibold">Candidate Database</p>
                <p className="mt-1 text-sm text-inherit/80">Browse and filter stored candidates</p>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bulk_parse")}
                className={`rounded-[18px] border px-4 py-3 text-left transition ${
                  activeTab === "bulk_parse"
                    ? "border-[#7eb9df]/35 bg-[#1b2734] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-transparent bg-transparent text-[#a7bbcb] hover:border-white/10 hover:text-white"
                }`}
              >
                <p className="text-[1rem] font-semibold">Bulk Parse CVs</p>
                <p className="mt-1 text-sm text-inherit/80">Upload and parse new CVs</p>
              </button>
            </div>

            {role === "HR" || role === "Admin" ? (
              <div className="flex shrink-0 items-center justify-between gap-3 rounded-[18px] border border-[#7eb9df]/14 bg-[#131a22] px-4 py-3 sm:min-w-[290px]">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fb6d3]">
                    Refresh Matches
                  </p>
                  <p className="mt-1 text-xs text-[#9ab0c2]">
                    Re-score stored candidates
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBackfill}
                  disabled={backfillLoading}
                  className="shrink-0 rounded-[16px] border-[#7eb9df]/20 px-4"
                >
                  {backfillLoading ? "Refreshing..." : "Run"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {activeTab === "bulk_parse" ? <CandidateUploadPanel /> : null}

      {activeTab !== "database" ? null : (
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

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel className="rounded-[28px] border-white/12 bg-[#171717] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.1rem] font-medium text-white">Filters</h2>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[0.98rem] text-[#b8cbff] transition hover:text-white"
              >
                Reset All
              </button>
            </div>

            <div className="mt-7 space-y-7">
              <div className="space-y-3">
                <label className="text-[0.98rem] text-[#cbd8e2]">Vacancy</label>
                <Select value={selectedVacancyId} onChange={(event) => setSelectedVacancyId(event.target.value)}>
                  <option value="all">All Vacancies</option>
                  <option value="no_vacancy">No vacancy / Talent pool</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={String(vacancy.id)}>
                      {vacancy.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-[0.98rem] text-[#cbd8e2]">Role / Job Title</label>
                <Input
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  placeholder="e.g. Developer"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[0.98rem] text-[#cbd8e2]">Experience (Years)</label>
                  <span className="text-sm text-[#8ea2b4]">
                    {experienceFilterEnabled ? `0 - ${maxExperience}+ yrs` : "All experience levels"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={maxExperience}
                  onChange={(event) => {
                    setMaxExperience(Number(event.target.value));
                    setExperienceFilterEnabled(true);
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#a7bbf7]"
                />
                <div className="flex items-center justify-between text-sm text-[#8ea2b4]">
                  <span>0 yrs</span>
                  <span>20+ yrs</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[0.98rem] text-[#cbd8e2]">Date Added</label>
                <Select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                  {dateFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Panel>

          <Panel className="rounded-[28px] border-white/12 bg-[#171717] p-5">
            <p className="text-[0.95rem] uppercase tracking-[0.26em] text-[#9ba9d6]">
              Active Database
            </p>
            <p className="mt-5 text-[2.55rem] font-semibold tracking-[-0.04em] text-[#b8cbff]">
              {databaseRecords.length.toLocaleString("en-US")}
            </p>
            <p className="mt-2 text-[0.98rem] text-[#c7d4df]">Total Parsed Profiles</p>
          </Panel>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/12 bg-[#171717] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#aabce0]" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by name, skill, or keyword across the entire database..."
                  className="h-14 border-white/12 bg-transparent pl-14 text-[1.02rem]"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSearchQuery(searchInput);
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                onClick={() => setSearchQuery(searchInput)}
                className="h-14 min-w-[150px] justify-center rounded-[20px] bg-[#a9bcf3] text-[#10203a] hover:bg-[#b8c9f6]"
              >
                Search
              </Button>
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_140px_140px_150px_160px_48px] gap-6 px-5 text-[0.95rem] uppercase tracking-[0.12em] text-[#cfd6df] xl:grid">
            <div>Candidate</div>
            <div>Role / Applied Vacancy</div>
            <div>Experience</div>
            <div>Applied Match</div>
            <div>Overall Talent</div>
            <div>Status</div>
            <div />
          </div>

          <div className="space-y-4">
            {loading ? (
              <Panel className="rounded-[28px] border-white/12 bg-[#171717] p-6 text-[#97aaba]">
                Loading candidate database...
              </Panel>
            ) : filteredRecords.length === 0 ? (
              <Panel className="rounded-[28px] border-white/12 bg-[#171717] p-6 text-[#97aaba]">
                No candidates matched the current filters.
              </Panel>
            ) : (
              filteredRecords.map((candidate) => (
                <Panel
                  key={candidate.id}
                  className="rounded-[26px] border-white/12 bg-[#171717] px-5 py-5 md:px-6"
                >
                  <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_140px_140px_150px_160px_48px] xl:items-center xl:gap-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#32415a] text-[1rem] font-semibold text-[#dce7ff]">
                        {candidate.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[1.02rem] font-medium text-white xl:truncate">
                          {candidate.name}
                        </p>
                        <p className="mt-1 text-[0.98rem] text-[#aab8c6]">
                          Added: {candidate.addedAt}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[1rem] text-white">{candidate.roleTitle}</p>
                      <p className="mt-1 truncate text-[0.82rem] uppercase tracking-[0.16em] text-[#7f93a5]">
                        {candidate.vacancyLabel}
                      </p>
                      <p className="mt-1 truncate text-[0.98rem] text-[#9db7ef]">
                        {candidate.vacancyTitle}
                      </p>
                      {candidate.potentialRole ? (
                        <p className="mt-1 truncate text-[0.92rem] text-[#8ea2b4]">
                          Potential: {candidate.potentialRole}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-[1rem] text-white">
                      {candidate.experienceYears !== null ? `${candidate.experienceYears} Years` : "Not set"}
                    </div>

                    <div className="text-[1rem] font-medium text-[#b8cbff]">
                      {formatScore(candidate.appliedMatchScore)}
                    </div>

                    <div className="text-[1rem] font-medium text-[#9fd0be]">
                      {formatScore(candidate.overallTalentScore)}
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center rounded-full border px-4 py-2 text-[0.95rem] font-medium ${getStageTone(
                          candidate.stage
                        )}`}
                      >
                        {stageLabels[candidate.stage] ?? candidate.stage}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-full p-2 text-[#b6c4d4] transition hover:bg-white/5 hover:text-white"
                        aria-label={`Open actions for ${candidate.name}`}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </Panel>
              ))
            )}
          </div>

          <div className="flex flex-col gap-4 px-1 pb-2 text-[1rem] text-[#b9c5d2] md:flex-row md:items-center md:justify-between">
            <p>
              Showing 1-{Math.min(filteredRecords.length, 10)} of {filteredRecords.length.toLocaleString("en-US")} candidates
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-2xl border border-white/10 px-5 py-3 text-[#657483] opacity-55"
                disabled
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/12 px-5 py-3 text-white transition hover:bg-white/5"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
