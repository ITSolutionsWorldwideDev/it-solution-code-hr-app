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

import { roleProfiles } from "@/lib/session";
import type {
  ApplicationApiRecord,
  CandidateApiRecord,
  DashboardActivityApiRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";
import type { ActivityItem, DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type HRReferenceDashboardProps = {
  data: DashboardData;
  hrActivity: DashboardActivityApiRecord[];
  applications: ApplicationApiRecord[];
  candidates: CandidateApiRecord[];
  vacancies: VacancyApiRecord[];
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

function buildChartSeries(applications: ApplicationApiRecord[]) {
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

function buildTopVacancyRows(applications: ApplicationApiRecord[], vacancies: VacancyApiRecord[]) {
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

function buildRecentApplicants(applications: ApplicationApiRecord[], candidates: CandidateApiRecord[], vacancies: VacancyApiRecord[]) {
  return [...applications]
    .sort((left, right) => (getTimeValue(right.created_at) ?? 0) - (getTimeValue(left.created_at) ?? 0))
    .slice(0, 5)
    .map((application) => {
      const candidate = candidates.find((item) => item.id === application.candidate_id) ?? null;
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
    });
}

function buildReminders(applications: ApplicationApiRecord[], vacancies: VacancyApiRecord[]) {
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
}: {
  label: string;
  value: string;
  helper: string;
  percent: number;
  color: string;
  glow: string;
}) {
  const strokeDashoffset = 282.6 - (282.6 * percent) / 100;

  return (
    <div className="rounded-[26px] bg-[#151b21] px-6 py-5 shadow-[0_18px_34px_rgba(0,0,0,0.32)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</p>
          <p className="mt-4 text-[2.25rem] font-semibold tracking-[-0.05em] text-white">{value}</p>
          <p className="mt-2 text-sm text-white/55">{helper}</p>
        </div>

        <div className={cn("relative h-[84px] w-[84px] shrink-0 rounded-full", glow)}>
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
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
            {percent}%
          </div>
        </div>
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
  const profile = roleProfiles.HR;
  const totalApplications = applications.length;
  const openVacancies = vacancies.filter((vacancy) => vacancy.status === "open").length;
  const shortlisted = applications.filter((application) => ["primary", "reserve"].includes(application.shortlist_bucket)).length;
  const rejected = applications.filter((application) => application.stage.endsWith("_rejected")).length;
  const sentToPipeline = applications.filter((application) =>
    [
      "hr_invite_sent",
      "hr_interview_scheduled",
      "hr_in_progress",
      "hr_passed",
      "hr_rejected",
    ].includes(application.stage) || technicalAndBeyondStages.has(application.stage),
  ).length;
  const inviteQueue = applications.filter((application) =>
    ["hr_invite_selected", "hr_invite_sent", "hr_interview_scheduled", "hr_in_progress"].includes(application.stage),
  ).length;

  const chartSeries = buildChartSeries(applications);
  const topVacancies = buildTopVacancyRows(applications, vacancies);
  const recentApplicants = buildRecentApplicants(applications, candidates, vacancies);
  const reminders = buildReminders(applications, vacancies);
  const activityFeed = hrActivity.length > 0 ? hrActivity : data.recentActivity;
  const chartBreakdown = [
    { name: "Applications", value: totalApplications, color: acquisitionColors[0] },
    { name: "Shortlisted", value: shortlisted, color: acquisitionColors[1] },
    { name: "Sent To Pipeline", value: sentToPipeline, color: acquisitionColors[2] },
    { name: "Rejected", value: rejected, color: acquisitionColors[3] },
  ];

  const kpis = [
    {
      label: "Applications",
      value: String(totalApplications),
      helper: data.kpis.find((item) => item.label === "Top Ranked")?.delta ?? "Current applicant volume",
      percent: toPercent(totalApplications, Math.max(totalApplications, 1)),
      theme: kpiThemes[0],
    },
    {
      label: "Shortlisted",
      value: String(shortlisted),
      helper: data.kpis.find((item) => item.label === "Shortlisted")?.delta ?? "Ready for recruiter action",
      percent: toPercent(shortlisted, totalApplications),
      theme: kpiThemes[1],
    },
      {
        label: "Approved",
        value: String(sentToPipeline),
        helper:
          data.kpis.find((item) => item.label === "Candidates Sent To Pipeline")?.delta ??
          "Moved into the pipeline",
        percent: toPercent(sentToPipeline, totalApplications),
        theme: kpiThemes[2],
      },
    {
      label: "Review Queue",
      value: String(inviteQueue || openVacancies),
      helper: `${openVacancies} active vacancies currently recruiting`,
      percent: toPercent(inviteQueue, totalApplications || openVacancies || 1),
      theme: kpiThemes[3],
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
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiRingCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                helper={kpi.helper}
                percent={kpi.percent}
                color={kpi.theme.ring}
                glow={kpi.theme.glow}
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
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#27414c] bg-[#15222b] text-[#93efff]">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[30px] bg-[#151b21] px-5 py-5 shadow-[0_20px_36px_rgba(0,0,0,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[1.35rem] font-semibold text-white">Acquisitions</p>
                  <span className="text-sm text-[#92afc1]">This month</span>
                </div>
                <div className="mt-4 h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {chartBreakdown.map((entry) => (
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
                  {chartBreakdown.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 text-sm text-white/78">
                      <span className="flex items-center gap-3">
                        <span className="h-3 w-5 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                      </span>
                      <span>{toPercent(entry.value, Math.max(totalApplications, 1))}%</span>
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
              {profile.initials}
            </div>
            <p className="mt-5 text-[1.2rem] font-semibold text-white">{profile.name}</p>
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
              {activityFeed.slice(0, 4).map((item: ActivityItem | DashboardActivityApiRecord) => (
                <div key={item.id} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#10171d] text-[#b8f5ff]">
                      <Mail className="h-4 w-4" />
                    </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-6 text-white/90">{item.title}</p>
                    <p className="mt-1 text-xs text-[#92afc1]">{item.timestamp}</p>
                  </div>
                </div>
              ))}
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
