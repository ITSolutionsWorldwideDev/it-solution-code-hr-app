"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  BriefcaseBusiness,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Plus,
  Settings,
  TerminalSquare,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { type AppRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Job Description", icon: FileText, href: "/hiring-requests", roles: ["HR", "Admin"] },
  { label: "Shortlisted", icon: BadgeCheck, href: "/shortlisted", roles: ["HR"] },
  { label: "Candidate Database", icon: Users, href: "/candidates", roles: ["HR", "Admin"] },
  { label: "Vacancies", icon: BriefcaseBusiness, href: "/vacancies", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Pipeline", icon: Workflow, href: "/pipeline", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Onboarding", icon: UserPlus, href: "/onboarding", roles: ["HR", "Admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();
  const visibleItems = navItems.filter((item) => item.roles.includes(role as AppRole));

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-white/5 bg-[#060f19] lg:sticky lg:top-0 lg:block">
      <div className="flex h-full flex-col">
        <div className="px-5 pb-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded bg-white text-[#006a64]">
              <TerminalSquare className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-white">TalentEngine</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#d0d8d7]">
                Enterprise Recruitment
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-4 rounded-xl px-6 py-4 text-[15px] transition",
                  isActive
                    ? "bg-[#071b23] font-bold text-white"
                    : "text-[#c6d0ce] hover:bg-[#0e1722] hover:text-white",
                )}
              >
                {isActive ? <span className="absolute inset-y-0 left-0 w-1 bg-[#66fcf1]" /> : null}
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 bg-white/[0.03] px-5 py-5">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007774] px-4 py-4 text-lg font-bold text-[#a1fcf7] transition hover:brightness-110"
          >
            <Plus className="h-5 w-5" />
            Post New Job
          </button>
        </div>

        <div className="space-y-1 px-2 pb-4 pt-2">
          <Link
            href="#"
            className="flex items-center gap-4 rounded-xl px-6 py-4 text-[15px] text-[#c6d0ce] transition hover:bg-[#0e1722] hover:text-white"
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
          <Link
            href="#"
            className="flex items-center gap-4 rounded-xl px-6 py-4 text-[15px] text-[#c6d0ce] transition hover:bg-[#0e1722] hover:text-white"
          >
            <HelpCircle className="h-5 w-5" />
            <span>Support</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
