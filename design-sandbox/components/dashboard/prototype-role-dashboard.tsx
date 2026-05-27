"use client";

import type { ComponentType } from "react";
import { BriefcaseBusiness, Building2, FileText, Network, NotebookPen, ShieldCheck, Users } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Panel } from "@/components/ui/panel";

type PrototypeRoleDashboardProps = {
  title: string;
  description: string;
  roleLabel: string;
  primaryFocus: {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  };
  secondaryFocus: {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  };
};

function FocusCard({
  title,
  description,
  icon: Icon,
}: PrototypeRoleDashboardProps["primaryFocus"]) {
  return (
    <Panel className="rounded-[28px] p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#466d8a]/18 text-[#9fc6e0]">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-[1.45rem] font-semibold text-white">{title}</h2>
      <p className="mt-3 text-[1rem] leading-8 text-[#95a8b8]">{description}</p>
    </Panel>
  );
}

export function PrototypeRoleDashboard({
  title,
  description,
  roleLabel,
  primaryFocus,
  secondaryFocus,
}: PrototypeRoleDashboardProps) {
  return (
    <DashboardShell>
      <div className="space-y-5">
        <div className="pb-1">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8ea2b3]">
            {roleLabel}
          </p>
          <h1 className="mt-2 text-[2.8rem] font-semibold tracking-[-0.04em] text-white xl:text-[3rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-4xl text-[1rem] text-[#95a8b8] xl:text-[1.05rem]">
            {description}
          </p>
        </div>

        <section className="grid gap-4 xl:grid-cols-2">
          <FocusCard {...primaryFocus} />
          <FocusCard {...secondaryFocus} />
        </section>

        <Panel className="rounded-[28px] p-5">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#8fa3b4]">
            Workspace Status
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center gap-3 text-[#9fc6e0]">
                <Network className="h-5 w-5" />
                <p className="text-sm font-semibold text-white">Active role</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-[#95a8b8]">{roleLabel}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center gap-3 text-[#9fc6e0]">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-sm font-semibold text-white">Access mode</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-[#95a8b8]">
                Prototype session persisted through local storage.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center gap-3 text-[#9fc6e0]">
                <Users className="h-5 w-5" />
                <p className="text-sm font-semibold text-white">Workspace focus</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-[#95a8b8]">
                Two high-priority task areas are surfaced for this role.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

const hrDashboardConfig = {
  title: "HR Hiring Workspace",
  description:
    "Review resume intake, candidate flow, and parsing readiness inside the premium recruitment workspace.",
  roleLabel: "HR Dashboard",
  primaryFocus: {
    title: "CV Parsing",
    description:
      "Upload resumes, trigger parsing, and inspect AI-generated candidate summaries for recruitment screening.",
    icon: NotebookPen,
  },
  secondaryFocus: {
    title: "Candidate Lists",
    description:
      "Track candidate availability, shortlist quality, and the next recommended actions for HR review.",
    icon: FileText,
  },
} satisfies PrototypeRoleDashboardProps;

const technicalDashboardConfig = {
  title: "Technical Review Workspace",
  description:
    "Focus the dashboard on engineering evaluation, reviewer throughput, and role-specific technical screening tasks.",
  roleLabel: "Technical Dashboard",
  primaryFocus: {
    title: "Code Reviews",
    description:
      "Surface technical evaluations, review notes, and candidate-specific engineering assessment checkpoints.",
    icon: Network,
  },
  secondaryFocus: {
    title: "Technical Tasks",
    description:
      "Track practical exercises, assignment status, and the next engineering decision points for candidates.",
    icon: BriefcaseBusiness,
  },
} satisfies PrototypeRoleDashboardProps;

const adminDashboardConfig = {
  title: "Admin Control Workspace",
  description:
    "See platform-wide visibility, prototype system status, and the controls needed to manage users and workspace access.",
  roleLabel: "Admin Dashboard",
  primaryFocus: {
    title: "System Overview",
    description:
      "Monitor the health of the recruitment prototype, workspace state, and high-level operational visibility.",
    icon: Building2,
  },
  secondaryFocus: {
    title: "User Management",
    description:
      "Review active user roles, access posture, and internal workspace ownership for the prototype environment.",
    icon: Users,
  },
} satisfies PrototypeRoleDashboardProps;

export function HrPrototypeDashboard() {
  return <PrototypeRoleDashboard {...hrDashboardConfig} />;
}

export function TechnicalPrototypeDashboard() {
  return <PrototypeRoleDashboard {...technicalDashboardConfig} />;
}

export function AdminPrototypeDashboard() {
  return <PrototypeRoleDashboard {...adminDashboardConfig} />;
}
