"use client";

import { useEffect, useMemo, useState } from "react";

import { useRole } from "@/components/providers/role-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/api/client";
import type {
  ApplicationApiRecord,
  CandidateApiRecord,
  CandidateRoleSuggestionApiRecord,
  UserApiRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";

const roleToUserRole = {
  HR: "HR",
  Technical: "Technical",
  Manager: "Manager",
  Admin: "Admin",
} as const;

type ShortlistedCandidateRecord = {
  application: ApplicationApiRecord;
  candidate: CandidateApiRecord | null;
};

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "Not available";
  }

  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
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

function formatMatchScore(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "No score";
  }

  const bucketed = Math.max(0, Math.min(100, Math.round(value / 10) * 10));
  return `${bucketed}%`;
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

function shortlistLabel(bucket: ApplicationApiRecord["shortlist_bucket"]) {
  if (bucket === "primary") {
    return "Primary shortlist";
  }
  if (bucket === "reserve") {
    return "Reserve shortlist";
  }
  return "Not shortlisted";
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);

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
              ["primary", "reserve"].includes(application.shortlist_bucket) && application.invite_selected,
          )
          .map((application) => application.id),
      );
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
        await loadVacancyShortlist(selectedVacancyId, true);
      } catch (error) {
        setApplications([]);
        setCandidates([]);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load shortlisted candidates.");
      } finally {
        setLoading(false);
      }
    };

    void loadApplications();
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

  const shortlistedCandidates = useMemo<ShortlistedCandidateRecord[]>(() => {
    return applications
      .filter((application) => ["primary", "reserve"].includes(application.shortlist_bucket))
      .sort((left, right) => {
        const leftBucket = left.shortlist_bucket === "primary" ? 0 : 1;
        const rightBucket = right.shortlist_bucket === "primary" ? 0 : 1;
        if (leftBucket !== rightBucket) {
          return leftBucket - rightBucket;
        }
        return (left.ranking_position ?? 999) - (right.ranking_position ?? 999);
      })
      .map((application) => ({
        application,
        candidate: candidates.find((candidate) => candidate.id === application.candidate_id) ?? null,
      }));
  }, [applications, candidates]);

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
      selectedApplicationId == null ||
      !shortlistedCandidates.some(({ application }) => application.id === selectedApplicationId)
    ) {
      setSelectedApplicationId(shortlistedCandidates[0]?.application.id ?? null);
    }
  }, [selectedApplicationId, shortlistedCandidates]);

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

  const handleGenerateShortlist = async () => {
    if (!selectedVacancyId) {
      return;
    }

    setBusy(true);
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
    }
  };

  const handleToggle = async (applicationId: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, applicationId])] : current.filter((id) => id !== applicationId),
    );
  };

  const handleSendSelectedEmails = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);

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
        await apiRequest<ApplicationApiRecord>({
          path: `/applications/${applicationId}/mark-invite-sent`,
          method: "POST",
          body: JSON.stringify({
            sent_by_id: user.id,
          }),
        });
      }

      await loadVacancyShortlist(selectedVacancyId, true);
      setSuccessMessage(
        `${selectedIds.length} HR invitation email(s) were marked as sent. Only those candidates now move toward the HR meeting flow.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send selected invitation emails.");
    } finally {
      setBusy(false);
    }
  };

  if (role !== "HR") {
    return (
      <Panel className="rounded-[30px] p-6">
        <h2 className="text-[1.5rem] font-semibold text-white">Shortlisting stays in the HR workspace</h2>
        <p className="mt-3 max-w-3xl text-[1rem] leading-7 text-[#95a8b8]">
          HR decides who from the top 10 gets the invitation email. Technical and Management only join after the
          candidate moves into the interview pipeline.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="rounded-[30px] p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.35rem] font-semibold text-white">Top 10 shortlist</h2>
          <p className="text-sm text-[#95a8b8]">
            Generate the shortlist from ranking, then decide candidate-by-candidate who receives the HR invitation
            email. Only invited candidates move toward the HR pipeline.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Select value={selectedVacancyId} onChange={(event) => setSelectedVacancyId(event.target.value)}>
            <option value="" disabled>
              Select vacancy
            </option>
            {vacancies.map((vacancy) => (
              <option key={vacancy.id} value={vacancy.id}>
                {vacancy.title}
              </option>
            ))}
          </Select>

          <Button type="button" variant="secondary" onClick={handleGenerateShortlist} disabled={!selectedVacancyId || busy}>
            {busy ? "Generating..." : "Generate Top 10"}
          </Button>

          <Button type="button" onClick={handleSendSelectedEmails} disabled={selectedIds.length === 0 || busy}>
            {busy ? "Sending..." : "Send Selected Emails"}
          </Button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[18px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-4 py-3 text-sm text-[#f0b6bf]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-[18px] border border-[#7eb9df]/20 bg-[#466d8a]/16 px-4 py-3 text-sm text-[#dbe8f2]">
            {successMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-[#95a8b8]">
            Loading shortlist...
          </div>
        ) : shortlistedCandidates.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-[#95a8b8]">
            No shortlisted candidates yet. Generate the Top 10 shortlist for the selected vacancy first.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {shortlistedCandidates.map(({ application, candidate }) => {
                const checked = selectedIds.includes(application.id);
                const alreadySent = Boolean(application.invite_sent_at);
                const selected = selectedApplicationId === application.id;

                return (
                  <div
                    key={application.id}
                    className={`rounded-[24px] border px-5 py-4 transition ${
                      selected ? "border-[#7eb9df]/35 bg-[#466d8a]/15" : "border-white/8 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <label
                        className={`flex items-start gap-4 ${alreadySent ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[#7eb9df]"
                          checked={checked}
                          disabled={alreadySent}
                          onChange={(event) => handleToggle(application.id, event.target.checked)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedApplicationId(application.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[1rem] font-semibold text-white">
                              {candidate?.name ?? `Candidate #${application.candidate_id}`}
                            </p>
                            <p className="mt-1 text-sm text-[#95a8b8]">
                              {shortlistLabel(application.shortlist_bucket)} · Rank #{application.ranking_position ?? "-"} ·
                              Vacancy score {(application.ranking_score ?? application.match_score ?? 0).toFixed(2)}%
                            </p>
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#9fc6e0]">
                            {alreadySent ? "Invite sent" : checked ? "Will send" : "Do not send"}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[#d6e1ea]">
                          {candidate?.ai_summary ?? application.ai_summary ?? "No AI summary available yet."}
                        </p>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Panel className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
              {!selectedRecord || !parsedDetail ? (
                <div className="rounded-[18px] border border-dashed border-white/10 bg-[#121212] px-4 py-5 text-sm text-[#95a8b8]">
                  Select a shortlisted candidate to inspect parsed results, vacancy score, and alternative role
                  suggestions.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[2rem] font-semibold text-white">
                        {selectedRecord.candidate?.name ?? `Candidate #${selectedRecord.application.candidate_id}`}
                      </h3>
                      <p className="mt-2 text-[1rem] text-[#95a8b8]">
                        {selectedRecord.candidate?.email ?? "No email stored"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[2rem] font-semibold text-[#9fc6e0]">{formatMatchScore(parsedDetail.vacancyScore)}</p>
                      <p className="mt-2 text-sm text-[#95a8b8]">Vacancy-specific shortlist score</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Applied to</p>
                      <p className="mt-3 text-[1.5rem] font-medium text-white">
                        {vacancies.find((vacancy) => vacancy.id === selectedRecord.application.vacancy_id)?.title ??
                          "Unknown vacancy"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Parsed on</p>
                      <p className="mt-3 text-[1.5rem] font-medium text-white">
                        {formatTimestamp(selectedRecord.application.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Summary</p>
                    <p className="mt-4 text-[1rem] leading-8 text-[#d6e1ea]">{parsedDetail.summary}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Experience</p>
                      <p className="mt-4 text-[1rem] leading-8 text-[#d6e1ea]">{parsedDetail.experience}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Education</p>
                      <p className="mt-4 text-[1rem] leading-8 text-[#d6e1ea]">{parsedDetail.education}</p>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Matched skills</p>
                    {parsedDetail.matchedSkills.length ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {parsedDetail.matchedSkills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-white/10 bg-[#232730] px-4 py-2 text-sm font-semibold text-[#cfe2f7]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[#95a8b8]">No matched skills stored yet.</p>
                    )}
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">
                      Vacancy fit explanation
                    </p>
                    <p className="mt-4 text-[1rem] leading-8 text-[#d6e1ea]">{parsedDetail.fitExplanation}</p>
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">
                        Role suggestions
                      </p>
                      {detailErrorMessage ? <span className="text-xs text-[#f0a3a3]">{detailErrorMessage}</span> : null}
                    </div>
                    {selectedRoleSuggestions.length ? (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-[18px] border border-[#7eb9df]/15 bg-[#466d8a]/12 px-4 py-3 text-sm leading-7 text-[#cfe2f7]">
                          Vacancy score is the shortlist score for the selected job. Role suggestion scores show how
                          strongly the CV matches other possible functions, so they can be higher than the vacancy
                          score.
                        </div>
                        {selectedRoleSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className="rounded-[20px] border border-white/8 bg-[#20242c] px-5 py-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[1.4rem] font-semibold text-white">{suggestion.role_title}</p>
                                <p className="mt-1 text-sm text-[#95a8b8]">{suggestion.department ?? "General"}</p>
                              </div>
                              <p className="text-[1.8rem] font-semibold text-[#9fc6e0]">
                                {formatMatchScore(suggestion.confidence_score)}
                              </p>
                            </div>
                            <p className="mt-4 text-sm leading-7 text-[#d6e1ea]">
                              {suggestion.reason ?? "No explanation stored for this role suggestion."}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[#95a8b8]">
                        No role suggestions are available yet for this candidate.
                      </p>
                    )}
                  </div>

                  {parsedDetail.resumePreviewBlocks.length > 0 ? (
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">
                        Formatted CV Preview
                      </p>
                      <div className="mt-4 space-y-4 text-sm leading-8 text-[#d6e1ea]">
                        {parsedDetail.resumePreviewBlocks.map((block) => (
                          <div
                            key={block}
                            className="whitespace-pre-wrap rounded-[16px] border border-white/6 bg-black/10 px-4 py-3"
                          >
                            {block}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Panel>
          </div>
        )}
      </Panel>
    </div>
  );
}
