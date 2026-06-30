"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HRReferenceDashboard } from "@/components/dashboard/hr-reference-dashboard";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useRole } from "@/components/providers/role-provider";
import { ActivityTable } from "@/components/ui/activity-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Panel } from "@/components/ui/panel";
import { QuickActionCard } from "@/components/ui/quick-action-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest } from "@/lib/api/client";
import { getDashboardData } from "@/lib/mock/dashboard";
import type {
  DashboardActivityApiRecord,
  HRDashboardSummaryApiRecord,
  HRWorkspaceApiRecord,
  WorkspaceApplicationApiRecord,
  WorkspaceCandidateApiRecord,
  WorkspaceVacancyApiRecord,
} from "@/lib/recruitment-types";

export function RoleDashboard() {
  const { role } = useRole();
  const isHr = role === "HR";
  const isTechnical = role === "Technical";
  const data = getDashboardData(role);
  const hrDashboardShell = {
    title: "Dashboard",
    description: "Track intake, vacancy readiness, shortlist quality, and the next HR decisions across the recruitment flow.",
    kpis: [],
    recentActivity: [],
    quickActions: data.quickActions,
    vacancyHighlights: data.vacancyHighlights,
  };
  const roleFocus =
    role === "Technical"
      ? "Technical users focus on interview execution, feedback quality, scoring, and approval into management review."
      : role === "Manager"
        ? "Management reviews technically approved finalists, makes final selections, and controls the offer stage."
        : role === "Admin"
          ? "Admins keep a full cross-functional view of the entire automated recruitment process."
          : "HR owns intake, AI-assisted screening, candidate review, and the handoff into technical evaluation.";
  const [hrSummary, setHrSummary] = useState<HRDashboardSummaryApiRecord | null>(null);
  const [hrActivity, setHrActivity] = useState<DashboardActivityApiRecord[] | null>(null);
  const [hrApplications, setHrApplications] = useState<WorkspaceApplicationApiRecord[]>([]);
  const [hrCandidates, setHrCandidates] = useState<WorkspaceCandidateApiRecord[]>([]);
  const [hrVacancies, setHrVacancies] = useState<WorkspaceVacancyApiRecord[]>([]);

  useEffect(() => {
    if (!isHr && !isTechnical) {
      setHrSummary(null);
      setHrActivity(null);
      setHrApplications([]);
      setHrCandidates([]);
      setHrVacancies([]);
      return;
    }

    let cancelled = false;

    const loadHrDashboard = async () => {
      try {
        const workspace = await apiRequest<HRWorkspaceApiRecord>({
          path: "/dashboard/hr-workspace",
        });
        if (!cancelled) {
          setHrSummary(workspace.summary);
          setHrActivity(workspace.activity);
          setHrApplications(workspace.applications);
          setHrCandidates(workspace.candidates);
          setHrVacancies(workspace.vacancies);
        }
      } catch {
        if (!cancelled) {
          setHrSummary(null);
          setHrActivity(null);
          setHrApplications([]);
          setHrCandidates([]);
          setHrVacancies([]);
        }
      }
    };

    void loadHrDashboard();

    return () => {
      cancelled = true;
    };
  }, [role]);

  const technicalInboxItems = useMemo(() => {
    if (!isTechnical) {
      return [];
    }

    return hrApplications
      .filter((application) => application.stage === "hr_passed")
      .map((application) => {
        const candidate = hrCandidates.find((item) => item.id === application.candidate_id) ?? null;
        const vacancy = hrVacancies.find((item) => item.id === application.vacancy_id) ?? null;

        return {
          id: application.id,
          candidateName: candidate?.name?.trim() || `Candidate #${application.candidate_id}`,
          vacancyTitle: vacancy?.title ?? `Vacancy #${application.vacancy_id}`,
          createdAt: application.created_at,
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [hrApplications, hrCandidates, hrVacancies, isTechnical]);

  const displayData = useMemo(() => {
    if (!isHr) {
      return data;
    }

    if (!hrSummary) {
      return hrDashboardShell;
    }

    return {
      ...hrDashboardShell,
      title: hrSummary.title,
      description: hrSummary.description,
    };
  }, [data, hrDashboardShell, hrSummary, isHr]);

  return (
    <DashboardShell>
      {isHr ? (
        <HRReferenceDashboard
          data={displayData}
          hrActivity={hrActivity ?? []}
          applications={hrApplications}
          candidates={hrCandidates}
          vacancies={hrVacancies}
        />
      ) : (
      <div className="space-y-5">
        <div className="pb-1">
          <h1 className="text-[2.8rem] font-semibold tracking-[-0.04em] text-white xl:text-[3rem]">
            {displayData.title}
          </h1>
          <p className="mt-2 max-w-3xl text-[1rem] text-[#95a8b8] xl:text-[1.05rem]">
            {displayData.description}
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {displayData.kpis.map((item) => (
            <KpiCard key={item.label} {...item} />
          ))}
        </section>

        {isTechnical ? (
          <Panel className="rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[1.3rem] font-semibold text-white">Technical Inbox</h2>
                <p className="mt-1 text-sm text-[#95a8b8]">New candidate for technical interview</p>
              </div>
              <Link
                href="/pipeline"
                className="text-sm font-medium text-[#93efff] transition hover:text-white"
              >
                Open Pipeline
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {technicalInboxItems.length === 0 ? (
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[#95a8b8]">
                  No new candidates are waiting for technical interview.
                </div>
              ) : (
                technicalInboxItems.map((item) => (
                  <Link
                    key={item.id}
                    href="/pipeline"
                    className="block rounded-[20px] border border-[#27414c] bg-[#10171d] px-4 py-4 transition hover:bg-[#182129]"
                  >
                    <p className="text-sm font-semibold text-white">{item.candidateName}</p>
                    <p className="mt-1 text-sm text-[#95a8b8]">{item.vacancyTitle}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#93efff]">
                      New candidate for technical interview
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.78fr_1fr] xl:grid-rows-[auto_auto]">
          <div className="space-y-4 xl:row-span-2">
            <ActivityTable items={displayData.recentActivity} />

            <Panel className="rounded-[28px] px-5 py-4">
              <SectionHeading
                eyebrow={displayData.vacancyHighlights[0]?.title ?? "Workflow"}
                title={displayData.vacancyHighlights[0]?.value ?? "Hiring Workflow"}
                description={displayData.vacancyHighlights[0]?.description ?? ""}
              />
              <div className="mt-4 border-t border-white/8 pt-3">
                <p className="text-[0.95rem] font-medium text-[#95a8b8]">Role focus</p>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#95a8b8]">{roleFocus}</p>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel className="space-y-4 rounded-[28px] p-4">
              <h3 className="text-[1.2rem] font-semibold text-white">
                Quick Actions
              </h3>
              <div className="grid gap-3">
                {displayData.quickActions.map((action) => (
                  <QuickActionCard key={action.title} {...action} />
                ))}
              </div>
            </Panel>

            {displayData.vacancyHighlights[1] ? (
              <Panel className="rounded-[28px] p-5">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#8fa3b4]">
                  {displayData.vacancyHighlights[1].title}
                </p>
                <p className="mt-3 text-[2rem] font-semibold text-white">
                  {displayData.vacancyHighlights[1].value}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#95a8b8]">
                  {displayData.vacancyHighlights[1].description}
                </p>
              </Panel>
            ) : null}
          </div>
        </section>
      </div>
      )}
    </DashboardShell>
  );
}
