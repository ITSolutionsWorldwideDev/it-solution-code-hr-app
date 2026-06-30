"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Mail,
  Rows3,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useRole } from "@/components/providers/role-provider";
import { buildVisibleCandidateDatabase, isPlaceholderCandidate } from "@/lib/candidate-utils";
import { roleProfiles } from "@/lib/session";
import type {
  DashboardActivityApiRecord,
  WorkspaceApplicationApiRecord,
  WorkspaceCandidateApiRecord,
  WorkspaceVacancyApiRecord,
} from "@/lib/recruitment-types";
import type { ActivityItem, DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type HRReferenceDashboardProps = {
  data: DashboardData;
  hrActivity: DashboardActivityApiRecord[];
  applications: WorkspaceApplicationApiRecord[];
  candidates: WorkspaceCandidateApiRecord[];
  vacancies: WorkspaceVacancyApiRecord[];
};

const technicalAndBeyondStages = new Set([
  "technical_interview_scheduled",
  "technical_in_progress",
  "technical_passed",
  "technical_rejected",
  "management_interview_scheduled",
  "management_in_progress",
  "management_rejected",
  "selected",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "hired",
]);

const kpiThemes = [
  {
    ring: "#63e7ff",
    glow: "shadow-[0_0_0_1px_rgba(99,231,255,0.18),0_0_26px_rgba(99,231,255,0.16)]",
  },
  {
    ring: "#93efff",
    glow: "shadow-[0_0_0_1px_rgba(147,239,255,0.18),0_0_26px_rgba(147,239,255,0.14)]",
  },
  {
    ring: "#42cbff",
    glow: "shadow-[0_0_0_1px_rgba(66,203,255,0.18),0_0_26px_rgba(66,203,255,0.14)]",
  },
  {
    ring: "#b5f2ff",
    glow: "shadow-[0_0_0_1px_rgba(181,242,255,0.18),0_0_26px_rgba(181,242,255,0.12)]",
  },
] as const;

const acquisitionColors = ["#63e7ff", "#93efff", "#42cbff", "#d8f8ff"] as const;

function toPercent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function formatRelativeDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(date);
}

function getTimeValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getCandidateParsedTime(candidate: WorkspaceCandidateApiRecord) {
  const parsedAt =
    typeof candidate.parsed_data?.parsed_at === "string"
      ? candidate.parsed_data.parsed_at
      : null;
  return getTimeValue(parsedAt);
}

function getCandidateFitScore(candidate: WorkspaceCandidateApiRecord) {
  const rawValue = candidate.parsed_data?.fit_score ?? candidate.match_score ?? null;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string" && rawValue.trim()) {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildCandidateGrowthSeries(candidates: WorkspaceCandidateApiRecord[], numberOfDays = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: numberOfDays }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (numberOfDays - 1 - index));
    const dayStart = day.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const added = candidates.filter((candidate) => {
      const time = getCandidateParsedTime(candidate);
      return time !== null && time >= dayStart && time < dayEnd;
    }).length;

    return {
      label: formatRelativeDate(day),
      added,
    };
  });
}

function countCandidatesWithinWindow(
  candidates: WorkspaceCandidateApiRecord[],
  startOffsetInDays: number,
  endOffsetInDays: number,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - startOffsetInDays);
  const end = new Date(today);
  end.setDate(today.getDate() - endOffsetInDays);

  return candidates.filter((candidate) => {
    const time = getCandidateParsedTime(candidate);
    return time !== null && time >= start.getTime() && time < end.getTime();
  }).length;
}

function buildCandidateReadinessBreakdown(candidates: WorkspaceCandidateApiRecord[]) {
  const counts = {
    strongMatch: 0,
    potentialFit: 0,
    needsReview: 0,
    lowFit: 0,
  };

  for (const candidate of candidates) {
    const fitScore = getCandidateFitScore(candidate);
    const parseStatus =
      typeof candidate.parsed_data?.parse_status === "string"
        ? candidate.parsed_data.parse_status.toLowerCase()
        : null;
    const hasSummary = typeof candidate.ai_summary === "string" && candidate.ai_summary.trim().length > 0;

    if (parseStatus === "failed" || parseStatus === "pending" || !hasSummary) {
      counts.needsReview += 1;
      continue;
    }

    if (fitScore !== null && fitScore >= 70) {
      counts.strongMatch += 1;
      continue;
    }

    if (fitScore !== null && fitScore >= 50) {
      counts.potentialFit += 1;
      continue;
    }

    if (fitScore !== null && fitScore > 0) {
      counts.lowFit += 1;
      continue;
    }

    counts.needsReview += 1;
  }

  return [
    { name: "Strong Match", value: counts.strongMatch, color: acquisitionColors[0] },
    { name: "Potential Fit", value: counts.potentialFit, color: acquisitionColors[1] },
    { name: "Needs Review", value: counts.needsReview, color: acquisitionColors[2] },
    { name: "Low Fit", value: counts.lowFit, color: acquisitionColors[3] },
  ];
}

function buildChartSeries(applications: WorkspaceApplicationApiRecord[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const dayStart = day.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const inDay = applications.filter((application) => {
      const time = getTimeValue(application.created_at);
      return time !== null && time >= dayStart && time < dayEnd;
    });

    return {
      label: formatRelativeDate(day),
      applications: inDay.length,
      shortlisted: inDay.filter((application) => ["primary", "reserve"].includes(application.shortlist_bucket)).length,
      rejected: inDay.filter((application) => application.stage.endsWith("_rejected")).length,
    };
  });
}

function buildTopVacancyRows(
  applications: WorkspaceApplicationApiRecord[],
  vacancies: WorkspaceVacancyApiRecord[],
) {
  const counts = new Map<number, number>();

  for (const application of applications) {
    counts.set(application.vacancy_id, (counts.get(application.vacancy_id) ?? 0) + 1);
  }

  return vacancies
    .map((vacancy) => ({
      id: vacancy.id,
      title: vacancy.title,
      applications: counts.get(vacancy.id) ?? 0,
    }))
    .sort((left, right) => right.applications - left.applications)
    .slice(0, 4);
}

function buildTalentPoolChartSeries(candidates: WorkspaceCandidateApiRecord[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const dayStart = day.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const inDay = candidates.filter((candidate) => {
      const time = getCandidateParsedTime(candidate);
      return time !== null && time >= dayStart && time < dayEnd;
    });

    return {
      label: formatRelativeDate(day),
      applications: inDay.length,
      shortlisted: inDay.filter((candidate) => {
        const fitScore = Number(candidate.parsed_data?.fit_score ?? candidate.match_score ?? 0);
        return Number.isFinite(fitScore) && fitScore >= 70;
      }).length,
      rejected: inDay.filter((candidate) => {
        const fitScore = Number(candidate.parsed_data?.fit_score ?? candidate.match_score ?? 0);
        return Number.isFinite(fitScore) && fitScore > 0 && fitScore < 50;
      }).length,
    };
  });
}

function buildTalentPoolVacancyRows(candidates: WorkspaceCandidateApiRecord[]) {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const title =
      typeof candidate.parsed_data?.selected_vacancy_title === "string"
        ? candidate.parsed_data.selected_vacancy_title.trim()
        : "";
    if (!title) {
      continue;
    }
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([title, applications], index) => ({
      id: index + 1,
      title,
      applications,
    }))
    .sort((left, right) => right.applications - left.applications)
    .slice(0, 4);
}

function buildRecentApplicants(
  applications: WorkspaceApplicationApiRecord[],
  candidates: WorkspaceCandidateApiRecord[],
  vacancies: WorkspaceVacancyApiRecord[],
) {
  return [...applications]
    .sort((left, right) => (getTimeValue(right.created_at) ?? 0) - (getTimeValue(left.created_at) ?? 0))
    .map((application) => {
      const candidate = candidates.find((item) => item.id === application.candidate_id) ?? null;
      if (candidate && isPlaceholderCandidate(candidate)) {
        return null;
      }
      const vacancy = vacancies.find((item) => item.id === application.vacancy_id) ?? null;
      const name = candidate?.name?.trim() || `Candidate #${application.candidate_id}`;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

      return {
        id: application.id,
        name,
        initials: initials || "CA",
        vacancyTitle: vacancy?.title ?? `Vacancy #${application.vacancy_id}`,
        createdAt: application.created_at,
      };
    })
    .filter((application): application is NonNullable<typeof application> => application !== null)
    .slice(0, 5);
}

function buildRecentTalentPoolCandidates(candidates: WorkspaceCandidateApiRecord[]) {
  return [...candidates]
    .sort((left, right) => (getCandidateParsedTime(right) ?? 0) - (getCandidateParsedTime(left) ?? 0))
    .slice(0, 5)
    .map((candidate) => {
      const name = candidate.name?.trim() || `Candidate #${candidate.id}`;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

      return {
        id: candidate.id,
        name,
        initials: initials || "CA",
        vacancyTitle:
          (typeof candidate.parsed_data?.selected_vacancy_title === "string" &&
          candidate.parsed_data.selected_vacancy_title.trim()) ||
          "Talent Pool",
        createdAt:
          (typeof candidate.parsed_data?.parsed_at === "string" && candidate.parsed_data.parsed_at) ||
          new Date().toISOString(),
      };
    });
}

function buildReminders(
  applications: WorkspaceApplicationApiRecord[],
  vacancies: WorkspaceVacancyApiRecord[],
) {
  const shortlistQueue = applications.filter((application) =>
    ["ranked", "primary_shortlist", "reserve_shortlist", "hr_invite_selected"].includes(application.stage),
  ).length;
  const inviteWaiting = applications.filter((application) =>
    ["hr_invite_sent", "hr_interview_scheduled"].includes(application.stage),
  ).length;
  const technicalReady = applications.filter((application) => application.stage === "hr_passed").length;
  const openVacancies = vacancies.filter((vacancy) => vacancy.status === "open").length;

  return [
    {
      id: "queue",
      icon: Clock3,
      title: `${shortlistQueue} candidates are waiting for an HR decision.`,
      accent: "text-[#63e7ff]",
    },
    {
      id: "invite",
      icon: Mail,
      title: `${inviteWaiting} invite flows are waiting for candidate action.`,
      accent: "text-[#93efff]",
    },
    {
      id: "handoff",
      icon: CheckCircle2,
      title: `${technicalReady} candidates are ready for the technical handoff.`,
      accent: "text-[#42cbff]",
    },
    {
      id: "vacancy",
      icon: BriefcaseBusiness,
      title: `${openVacancies} vacancies are currently open and recruiting.`,
      accent: "text-[#b5f2ff]",
    },
  ];
}

function KpiRingCard({
  label,
  value,
  helper,
  percent,
  color,
  glow,
  className,
}: {
  label: string;
  value: string;
  helper: string;
  percent: number;
  color: string;
  glow: string;
  className?: string;
}) {
  const strokeDashoffset = 282.6 - (282.6 * percent) / 100;

  return (
    <div className={cn("rounded-[26px] bg-[#151b21] px-6 py-5 shadow-[0_18px_34px_rgba(0,0,0,0.32)]", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</p>
          <p className="mt-4 text-[2.25rem] font-semibold tracking-[-0.05em] text-white">{value}</p>
          <p className="mt-2 text-sm text-white/55">{helper}</p>
        </div>

        <div className={cn("relative h-[68px] w-[68px] shrink-0 rounded-full", glow)}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="282.6"
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[0.82rem] font-semibold text-white">
            {percent}%
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateVolumeCard({
  totalCandidates,
  recentCandidates,
  strongFitShare,
  growthSeries,
}: {
  totalCandidates: number;
  recentCandidates: number;
  strongFitShare: number;
  growthSeries: { label: string; added: number }[];
}) {
  return (
    <div className="rounded-[26px] bg-[#151b21] px-6 py-5 shadow-[0_18px_34px_rgba(0,0,0,0.32)] md:col-span-2 2xl:col-span-2">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-white/45">
            Candidates In Database
          </p>
          <p className="mt-4 text-[2.7rem] font-semibold tracking-[-0.06em] text-white">
            {totalCandidates.toLocaleString("en-US")}
          </p>
          <p className="mt-2 text-sm text-white/55">
            {recentCandidates} added in the last 30 days
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-[#27414c] bg-[#12202a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#93efff]">
            Live pool
          </span>
          <span className="text-sm text-white/55">
            {strongFitShare}% strong fit
          </span>
        </div>
      </div>

      <div className="mt-5 h-[92px] rounded-[20px] border border-white/6 bg-[#10171d] px-3 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={growthSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="candidateGrowthArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#63e7ff" stopOpacity={0.36} />
                <stop offset="100%" stopColor="#63e7ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#121a33",
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="added"
              stroke="#63e7ff"
              strokeWidth={2.8}
              fill="url(#candidateGrowthArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] text-white/40">
        <span>{growthSeries[0]?.label ?? ""}</span>
        <span>Growth Momentum</span>
        <span>{growthSeries[growthSeries.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

export function HRReferenceDashboard({
  data,
  hrActivity,
  applications,
  candidates,
  vacancies,
}: HRReferenceDashboardProps) {
  const { name } = useRole();
  const profile = roleProfiles.HR;
  const profileInitials = name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const visibleCandidates = buildVisibleCandidateDatabase(candidates);
  const totalCandidates = candidates.length;
  const totalApplications = applications.length;
  const hasTalentPoolOnly = applications.length === 0 && visibleCandidates.length > 0;
  const openVacancies = vacancies.filter((vacancy) => vacancy.status === "open").length;
  const shortlisted = hasTalentPoolOnly
    ? visibleCandidates.filter((candidate) => Number(candidate.parsed_data?.fit_score ?? candidate.match_score ?? 0) >= 70).length
    : applications.filter((application) => ["primary", "reserve"].includes(application.shortlist_bucket)).length;
  const rejected = hasTalentPoolOnly
    ? visibleCandidates.filter((candidate) => {
        const fitScore = Number(candidate.parsed_data?.fit_score ?? candidate.match_score ?? 0);
        return Number.isFinite(fitScore) && fitScore > 0 && fitScore < 50;
      }).length
    : applications.filter((application) => application.stage.endsWith("_rejected")).length;
  const sentToPipeline = hasTalentPoolOnly
    ? visibleCandidates.filter((candidate) => {
        const fitScore = Number(candidate.parsed_data?.fit_score ?? candidate.match_score ?? 0);
        return Number.isFinite(fitScore) && fitScore >= 80;
      }).length
    : applications.filter((application) =>
        [
          "hr_invite_sent",
          "hr_interview_scheduled",
          "hr_in_progress",
          "hr_passed",
          "hr_rejected",
        ].includes(application.stage) || technicalAndBeyondStages.has(application.stage),
      ).length;
  const reviewQueue = hasTalentPoolOnly
    ? visibleCandidates.filter((candidate) => {
        const parseStatus =
          typeof candidate.parsed_data?.parse_status === "string"
            ? candidate.parsed_data.parse_status.toLowerCase()
            : null;
        return parseStatus === "pending" || parseStatus === "failed" || !candidate.ai_summary;
      }).length
    : applications.filter((application) =>
        ["ranked", "primary_shortlist", "reserve_shortlist", "hr_invite_selected"].includes(application.stage),
      ).length;

  const chartSeries = hasTalentPoolOnly ? buildTalentPoolChartSeries(visibleCandidates) : buildChartSeries(applications);
  const topVacancies = hasTalentPoolOnly ? buildTalentPoolVacancyRows(visibleCandidates) : buildTopVacancyRows(applications, vacancies);
  const recentApplicants = hasTalentPoolOnly
    ? buildRecentTalentPoolCandidates(visibleCandidates)
    : buildRecentApplicants(applications, candidates, vacancies);
  const reminders = buildReminders(applications, vacancies);
  const activityFeed = hrActivity;
  const candidateGrowthSeries = buildCandidateGrowthSeries(visibleCandidates);
  const recentCandidates = countCandidatesWithinWindow(visibleCandidates, 30, 0);
  const strongFitCount = visibleCandidates.filter((candidate) => {
    const fitScore = getCandidateFitScore(candidate);
    return fitScore !== null && fitScore >= 70;
  }).length;
  const potentialFitCount = visibleCandidates.filter((candidate) => {
    const fitScore = getCandidateFitScore(candidate);
    return fitScore !== null && fitScore >= 50 && fitScore < 70;
  }).length;
  const candidateReadinessBreakdown = buildCandidateReadinessBreakdown(visibleCandidates);
  const strongFitShare = toPercent(strongFitCount, Math.max(totalCandidates, 1));
  const reviewQueuePercent = toPercent(reviewQueue, Math.max(totalApplications || totalCandidates, 1));
  const potentialFitShare = toPercent(potentialFitCount, Math.max(totalCandidates, 1));
  const openVacancyShare = toPercent(openVacancies, Math.max(vacancies.length, 1));

  const kpis = [
    {
      label: "Open Vacancies",
      value: String(openVacancies),
      helper: `${openVacancyShare}% of tracked vacancies are open`,
      percent: openVacancyShare,
      theme: kpiThemes[1],
    },
    {
      label: "Strong Matches",
      value: String(strongFitCount),
      helper: `${strongFitShare}% of database scored 70%+`,
      percent: strongFitShare,
      theme: kpiThemes[2],
    },
    {
      label: "Potential Fits",
      value: String(potentialFitCount),
      helper: `${potentialFitShare}% are promising but not top-tier yet`,
      percent: potentialFitShare,
      theme: kpiThemes[3],
    },
    {
      label: "Needs Review",
      value: String(reviewQueue),
      helper: `${reviewQueuePercent}% of the active pool still needs HR review`,
      percent: reviewQueuePercent,
      theme: kpiThemes[0],
    },
  ];

  return (
    <div className="space-y-6 rounded-[34px] bg-[#161d24] p-5 shadow-[0_34px_80px_rgba(0,0,0,0.32)] xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[2rem] font-semibold tracking-[-0.04em] text-white">Dashboard</p>
          <p className="mt-2 text-sm text-[#96abc0]">{data.description}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-[18px] bg-[#1b232b] px-4 py-3 text-sm font-medium text-[#d8f2ff]">
            {formatLongDate(new Date())}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#1a2731] text-[#63e7ff]">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2.45fr)_320px]">
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
            <CandidateVolumeCard
              totalCandidates={totalCandidates}
              recentCandidates={recentCandidates}
              strongFitShare={strongFitShare}
              growthSeries={candidateGrowthSeries}
            />
            {kpis.map((kpi) => (
              <KpiRingCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                helper={kpi.helper}
                percent={kpi.percent}
                color={kpi.theme.ring}
                glow={kpi.theme.glow}
                className="2xl:col-span-1"
              />
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_300px]">
            <div className="rounded-[30px] bg-[#151b21] px-5 py-5 shadow-[0_20px_36px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[1.5rem] font-semibold text-white">Top Active Jobs</p>
                  <p className="mt-1 text-sm text-white/45">Last 7 days of HR intake activity</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#63e7ff]" />
                    Applications
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#93efff]" />
                    Shortlisted
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#b5f2ff]" />
                    Rejected
                  </div>
                </div>
              </div>

              <div className="mt-5 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartSeries} margin={{ top: 18, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="applicationsArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#63e7ff" stopOpacity={0.38} />
                        <stop offset="100%" stopColor="#63e7ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="shortlistedArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#93efff" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#93efff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#7f8ab0", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#637094", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "#121a33",
                        color: "#fff",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stroke="#63e7ff"
                      strokeWidth={3}
                      fill="url(#applicationsArea)"
                    />
                    <Area
                      type="monotone"
                      dataKey="shortlisted"
                      stroke="#93efff"
                      strokeWidth={3}
                      fill="url(#shortlistedArea)"
                    />
                    <Area
                      type="monotone"
                      dataKey="rejected"
                      stroke="#b5f2ff"
                      strokeWidth={2.5}
                      fillOpacity={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] border border-white/8">
                <div className="grid grid-cols-[minmax(0,1fr)_120px_52px] gap-4 border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  <span>Job Title</span>
                  <span>Applications</span>
                  <span />
                </div>
                {topVacancies.map((vacancy) => (
                  <div
                    key={vacancy.id}
                    className="grid grid-cols-[minmax(0,1fr)_120px_52px] gap-4 border-b border-white/6 px-4 py-3 text-sm text-white/80 last:border-b-0"
                  >
                    <span className="truncate">{vacancy.title}</span>
                    <span>{vacancy.applications}</span>
                    <span className="flex justify-end">
                      <Link
                        href={`/vacancies/${vacancy.id}`}
                        aria-label={`Open vacancy ${vacancy.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#27414c] bg-[#15222b] text-[#93efff] transition hover:border-[#4f7d8f] hover:bg-[#1a2a34]"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[30px] bg-[#151b21] px-5 py-5 shadow-[0_20px_36px_rgba(0,0,0,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[1.35rem] font-semibold text-white">Candidate Readiness</p>
                  <span className="text-sm text-[#92afc1]">This month</span>
                </div>
                <div className="mt-4 h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={candidateReadinessBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {candidateReadinessBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: "#121a33",
                          color: "#fff",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-3">
                  {candidateReadinessBreakdown.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 text-sm text-white/78">
                      <span className="flex items-center gap-3">
                        <span className="h-3 w-5 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                      </span>
                      <span>{toPercent(entry.value, Math.max(totalCandidates, 1))}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] bg-[#151b21] px-5 py-5 shadow-[0_20px_36px_rgba(0,0,0,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[1.35rem] font-semibold text-white">New Applicants</p>
                  <span className="text-sm text-[#92afc1]">Today</span>
                </div>
                <div className="mt-4 space-y-4">
                  {recentApplicants.map((applicant) => (
                    <div key={applicant.id} className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1c2630] text-sm font-semibold text-white">
                        {applicant.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{applicant.name}</p>
                        <p className="truncate text-xs text-[#92afc1]">Applied for {applicant.vacancyTitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[30px] bg-[#131a20] px-5 py-6 shadow-[0_20px_36px_rgba(0,0,0,0.32)]">
          <div className="flex justify-end">
            <Link
              href="/#employee-login"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#93efff] transition hover:text-white"
            >
              <Send className="h-4 w-4" />
              Change workspace
            </Link>
          </div>

          <div className="mt-8 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ebfdff_0%,#93efff_52%,#42cbff_100%)] text-[2rem] font-semibold text-[#102938] shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              {profileInitials || profile.initials}
            </div>
            <p className="mt-5 text-[1.2rem] font-semibold text-white">{name}</p>
            <p className="mt-1 text-sm text-[#96abc0]">{profile.title}</p>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[1.35rem] font-semibold text-white">Quick Actions</p>
              <Rows3 className="h-4 w-4 text-[#93efff]" />
            </div>
            <div className="mt-4 space-y-3">
              {data.quickActions.map((action) => {
                const Icon =
                  action.href === "/hiring-requests"
                    ? Sparkles
                    : action.href === "/vacancies"
                      ? BriefcaseBusiness
                      : Users;

                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="flex items-center justify-between rounded-[18px] bg-[#10171d] px-4 py-3 transition hover:bg-[#182129]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#1a2731] text-[#93efff]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-white">{action.buttonLabel}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[#93efff]" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[1.35rem] font-semibold text-white">Activity</p>
              <Activity className="h-4 w-4 text-[#93efff]" />
            </div>
            <div className="mt-4 space-y-4">
              {activityFeed.length > 0 ? (
                activityFeed.slice(0, 4).map((item: ActivityItem | DashboardActivityApiRecord) => (
                  <div key={item.id} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#10171d] text-[#b8f5ff]">
                        <Mail className="h-4 w-4" />
                      </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-6 text-white/90">{item.title}</p>
                      <p className="mt-1 text-xs text-[#92afc1]">{item.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-white/8 bg-[#10171d] px-4 py-4 text-sm text-[#92afc1]">
                  No live HR activity yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[1.35rem] font-semibold text-white">Reminders</p>
              <CheckCircle2 className="h-4 w-4 text-[#93efff]" />
            </div>
            <div className="mt-4 space-y-4">
              {reminders.map((reminder) => {
                const Icon = reminder.icon;
                return (
                  <div key={reminder.id} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#10171d]">
                      <Icon className={cn("h-4 w-4", reminder.accent)} />
                    </div>
                    <p className="text-sm leading-6 text-white/82">{reminder.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
