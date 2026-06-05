"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Rocket,
  Settings,
  Star,
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
  { label: "Shortlisted", icon: Star, href: "/shortlisted", roles: ["HR"] },
  { label: "Candidate Database", icon: Users, href: "/candidates", roles: ["HR", "Admin"] },
  { label: "Vacancies", icon: Briefcase, href: "/vacancies", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Pipeline", icon: Workflow, href: "/pipeline", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Onboarding", icon: UserPlus, href: "/onboarding", roles: ["HR", "Admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();
  const visibleItems = navItems.filter((item) => item.roles.includes(role as AppRole));

  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-white/5 bg-[rgba(24,32,40,0.8)] backdrop-blur-md lg:block">
      <div className="flex h-full flex-col py-1">
        <div className="px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#72d0ed] text-[#003642]">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[1.95rem] font-semibold tracking-[-0.04em] text-[#a9e9ff]">
                Recruitment Pro
              </h1>
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#bdc8cd]">
                Command Center
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition",
                  isActive
                    ? "border-l-2 border-[#a9e9ff] bg-[#a9e9ff]/5 font-bold text-[#a9e9ff]"
                    : "text-[#bdc8cd] hover:bg-[#2d363e]/50 hover:text-[#a9e9ff]",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[0.98rem]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/5 px-4 py-6">
          <Link href="#" className="flex items-center gap-3 rounded-lg px-4 py-3 text-[#bdc8cd] transition hover:bg-[#2d363e]/50 hover:text-[#a9e9ff]">
            <Settings className="h-5 w-5" />
            <span className="text-[0.98rem]">Settings</span>
          </Link>
          <Link href="#" className="flex items-center gap-3 rounded-lg px-4 py-3 text-[#bdc8cd] transition hover:bg-[#2d363e]/50 hover:text-[#a9e9ff]">
            <HelpCircle className="h-5 w-5" />
            <span className="text-[0.98rem]">Support</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
