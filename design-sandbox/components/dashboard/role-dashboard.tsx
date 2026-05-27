"use client";

import { useEffect, useMemo, useState } from "react";

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
  HRDashboardActivityResponseApiRecord,
  HRDashboardSummaryApiRecord,
} from "@/lib/recruitment-types";

export function RoleDashboard() {
  const { role } = useRole();
  const data = getDashboardData(role);
  const [hrSummary, setHrSummary] = useState<HRDashboardSummaryApiRecord | null>(null);
  const [hrActivity, setHrActivity] = useState<DashboardActivityApiRecord[] | null>(null);

  useEffect(() => {
    if (role !== "HR") {
      setHrSummary(null);
      setHrActivity(null);
      return;
    }

    let cancelled = false;

    const loadHrDashboard = async () => {
      try {
        const [summaryResponse, activityResponse] = await Promise.all([
          apiRequest<HRDashboardSummaryApiRecord>({
            path: "/dashboard/hr-summary",
          }),
          apiRequest<HRDashboardActivityResponseApiRecord>({
            path: "/dashboard/hr-activity",
          }),
        ]);
        if (!cancelled) {
          setHrSummary(summaryResponse);
          setHrActivity(activityResponse.items);
        }
      } catch {
        if (!cancelled) {
          setHrSummary(null);
          setHrActivity(null);
        }
      }
    };

    void loadHrDashboard();

    return () => {
      cancelled = true;
    };
  }, [role]);

  const displayData = useMemo(() => {
    if (role !== "HR" || !hrSummary) {
      return data;
    }

    const kpis = data.kpis.map((item) => {
      const liveKpi = hrSummary.kpis.find((kpi) => kpi.label === item.label);
      if (!liveKpi) {
        return item;
      }

      return {
        ...item,
        value: liveKpi.value,
        delta: liveKpi.delta,
      };
    });

    return {
      ...data,
      title: hrSummary.title,
      description: hrSummary.description,
      kpis,
      recentActivity:
        hrActivity && hrActivity.length > 0
          ? hrActivity.map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
              timestamp: item.timestamp,
              candidateName: item.candidate_name,
              candidateRole: item.candidate_role,
              candidateInitials: item.candidate_initials,
            }))
          : data.recentActivity,
    };
  }, [data, hrActivity, hrSummary, role]);

  return (
    <DashboardShell>
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
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#95a8b8]">
                  {role === "HR" &&
                    "HR owns intake, AI-assisted screening, candidate review, and the handoff into technical evaluation."}
                  {role === "Technical" &&
                    "Technical users focus on interview execution, feedback quality, scoring, and approval into management review."}
                  {role === "Manager" &&
                    "Management reviews technically approved finalists, makes final selections, and controls the offer stage."}
                  {role === "Admin" &&
                    "Admins keep a full cross-functional view of the entire automated recruitment process."}
                </p>
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
    </DashboardShell>
  );
}
