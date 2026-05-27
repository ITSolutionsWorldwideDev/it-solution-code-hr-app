import { BriefcaseBusiness, CircleDollarSign, Clock3, MapPin, RotateCw, Sparkles, UserRound } from "lucide-react";

import { LinkedInPreviewCard } from "@/components/recruitment/linkedin-preview-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { HiddenPotentialRecord, VacancyRecord } from "@/lib/recruitment-types";

type VacancyDetailProps = {
  vacancy: VacancyRecord;
  hiddenPotentials: HiddenPotentialRecord[];
  discoveryLoading: boolean;
  discoveryError: string | null;
  onRefreshHiddenPotentials: () => void;
};

type VacancyDetailContent = {
  shortSummary: string;
  overview: Array<{ label: string; value: string; icon: React.ReactNode }>;
  aboutRole: string[];
  responsibilities: string[];
};

const toneMap = {
  open: "green",
  on_hold: "blue",
  closed: "slate",
} as const;

function formatUploadedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Upload date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeWorkspaceDescription(description: string) {
  const marker = /How to Apply/i;

  if (marker.test(description)) {
    return description.split(marker)[0].trimEnd();
  }

  return description;
}

export function VacancyDetail({
  vacancy,
  hiddenPotentials,
  discoveryLoading,
  discoveryError,
  onRefreshHiddenPotentials,
}: VacancyDetailProps) {
  const content = buildVacancyDetailContent(vacancy);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
      <section className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.015)_100%)] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[3rem] font-semibold tracking-[-0.05em] text-white">{vacancy.title}</h1>
            <StatusPill status={vacancy.status} tone={toneMap[vacancy.status]} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 text-[1.02rem] text-[#b8c5d2]">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-[#8ea4b7]" />
              <span>{vacancy.department}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#8ea4b7]" />
              <span>{vacancy.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#8ea4b7]" />
              <span>{vacancy.employmentType}</span>
            </div>
          </div>

          <p className="mt-3 text-[1rem] text-[#8fa1b2]">| Uploaded on {formatUploadedDate(vacancy.createdAt)}</p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <SectionHeading title="Short Summary" />
          <p className="mt-5 max-w-4xl text-[1.15rem] leading-10 text-[#d6dee6]">{content.shortSummary}</p>

          <div className="mt-10">
            <SectionHeading title="Overview" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {content.overview.map((item) => (
                <div key={item.label} className="border-b border-white/10 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-[#3f86ff]">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#7d8da0]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-[1.02rem] leading-7 text-white">{item.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-[1.8rem] font-semibold text-[#3f86ff]">About the Role</h3>
            <div className="mt-5 space-y-4">
              {content.aboutRole.map((paragraph, index) => (
                <p key={`about-role-${index}`} className="max-w-4xl text-[1.1rem] leading-10 text-[#d6dee6]">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-[1.8rem] font-semibold text-[#3f86ff]">Key Responsibilities</h3>
            <ul className="mt-5 space-y-4">
              {content.responsibilities.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-4 text-[1.1rem] leading-10 text-[#d6dee6]">
                  <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-[#3f86ff]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <h2 className="text-[1.65rem] font-semibold uppercase tracking-[0.04em] text-white">Vacancy Snapshot</h2>
          <dl className="mt-8 space-y-8 text-sm text-[#eef5fb]">
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-[#8ea1b4]">Status</dt>
              <dd className="mt-3 flex items-center gap-3 text-[1.6rem] font-medium text-white">
                <span className="h-3 w-3 rounded-full bg-[#1ad05e]" />
                <span className="capitalize">{vacancy.status.replace("_", " ")}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-[#8ea1b4]">Department</dt>
              <dd className="mt-3 text-[1.6rem] font-medium text-white">{vacancy.department}</dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-[#8ea1b4]">Uploaded</dt>
              <dd className="mt-3 text-[1.6rem] font-medium text-white">{formatUploadedDate(vacancy.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-3 text-[1.65rem] font-semibold uppercase tracking-[0.04em] text-white">
                <Sparkles className="h-5 w-5 text-[#79a8ff]" />
                Hidden Potentials
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#8ea1b4]">
                Existing database candidates re-matched against this vacancy.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshHiddenPotentials}
              disabled={discoveryLoading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#d8e1ea] transition hover:border-[#79a8ff]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCw className={`h-4 w-4 ${discoveryLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {discoveryLoading ? (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-sm text-[#9db0c1]">
              Recomputing hidden potentials for this vacancy...
            </div>
          ) : discoveryError ? (
            <div className="mt-6 rounded-[24px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-5 py-4 text-sm text-[#f0b6bf]">
              {discoveryError}
            </div>
          ) : hiddenPotentials.length === 0 ? (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-sm text-[#9db0c1]">
              No strong hidden potentials were found for this vacancy yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {hiddenPotentials.map((candidate, index) => (
                <div
                  key={`${candidate.candidate_name}-${index}`}
                  className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.02)] px-5 py-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{candidate.candidate_name}</h3>
                      <p className="mt-1 text-sm text-[#8ea1b4]">Original role: {candidate.original_role}</p>
                    </div>
                    <div className="rounded-full border border-[#79a8ff]/30 bg-[#79a8ff]/10 px-4 py-1.5 text-sm font-semibold text-[#b8ceff]">
                      {candidate.potential_score}%
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[#d6dee6]">{candidate.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <LinkedInPreviewCard vacancyId={vacancy.id} vacancy={vacancy} />
      </aside>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-8 w-2 rounded-full bg-[#3f86ff]" />
      <h2 className="text-[2rem] font-semibold text-white">{title}</h2>
    </div>
  );
}

function buildVacancyDetailContent(vacancy: VacancyRecord): VacancyDetailContent {
  const normalizedDescription = normalizeDescription(normalizeWorkspaceDescription(vacancy.description));
  const aboutRole =
    extractParagraphSection(normalizedDescription, ["About the Role"], [
      "Key Responsibilities",
      "What You’ll Bring",
      "What You'll Bring",
      "Nice to Have",
      "Working Arrangements and Benefits",
    ]) ?? ["No detailed role overview has been added yet."];

  const responsibilities =
    extractBulletSection(normalizedDescription, ["Key Responsibilities"], [
      "What You’ll Bring",
      "What You'll Bring",
      "Nice to Have",
      "Working Arrangements and Benefits",
    ]) ?? vacancy.requirements;

  return {
    shortSummary: vacancy.summary,
    overview: [
      {
        label: "Job Title",
        value: vacancy.title,
        icon: <BriefcaseBusiness className="h-4 w-4" />,
      },
      {
        label: "Department",
        value: vacancy.department,
        icon: <UserRound className="h-4 w-4" />,
      },
      {
        label: "Employment Type",
        value: vacancy.employmentType,
        icon: <Clock3 className="h-4 w-4" />,
      },
      {
        label: "Location",
        value: vacancy.location,
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        label: "Compensation",
        value: extractOverviewValue(normalizedDescription, "Compensation") ?? "Not specified",
        icon: <CircleDollarSign className="h-4 w-4" />,
      },
      {
        label: "Reports To",
        value: extractOverviewValue(normalizedDescription, "Reports To") ?? "Not specified",
        icon: <UserRound className="h-4 w-4" />,
      },
    ],
    aboutRole,
    responsibilities,
  };
}

function normalizeDescription(description: string) {
  return description
    .replace(/\r\n/g, "\n")
    .replace(
      /(Short Summary|Overview|About the Role|Key Responsibilities|What You’ll Bring|What You'll Bring|Nice to Have|Working Arrangements and Benefits|How to Apply)/gi,
      "\n$1\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractParagraphSection(
  description: string,
  headings: string[],
  nextHeadings: string[],
): string[] | null {
  const content = matchSection(description, headings, nextHeadings);
  if (!content) {
    return null;
  }

  const paragraphs = content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.includes(":"));

  return paragraphs.length > 0 ? paragraphs : null;
}

function extractBulletSection(
  description: string,
  headings: string[],
  nextHeadings: string[],
): string[] | null {
  const content = matchSection(description, headings, nextHeadings);
  if (!content) {
    return null;
  }

  const items = content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[\-•]\s*/, "").trim())
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

function extractOverviewValue(description: string, label: string) {
  const regex = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*(.+)`, "i");
  const line = description
    .split("\n")
    .map((item) => item.trim())
    .find((item) => regex.test(item));

  if (!line) {
    return null;
  }

  return line.replace(regex, "$1").trim();
}

function matchSection(description: string, headings: string[], nextHeadings: string[]): string | null {
  const headingPattern = headings.map(escapeRegExp).join("|");
  const nextPattern = nextHeadings.length > 0 ? nextHeadings.map(escapeRegExp).join("|") : "$";
  const regex = new RegExp(`(?:${headingPattern})\\s*([\\s\\S]*?)(?=\\n(?:${nextPattern})\\b|$)`, "i");
  const match = description.match(regex);
  return match?.[1]?.trim() ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
