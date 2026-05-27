"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  Home,
  Network,
  NotebookPen,
  Rows3,
  Send,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { useRole } from "@/components/providers/role-provider";
import { type AppRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: Home, href: "/dashboard", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Job Description", icon: NotebookPen, href: "/hiring-requests", roles: ["HR", "Admin"] },
  { label: "Shortlisted", icon: Send, href: "/shortlisted", roles: ["HR"] },
  { label: "Candidate Database", icon: Users, href: "/candidates", roles: ["HR", "Admin"] },
  { label: "Vacancies", icon: BriefcaseBusiness, href: "/vacancies", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Pipeline", icon: Rows3, href: "/pipeline", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Onboarding", icon: UserRoundCheck, href: "/onboarding", roles: ["HR", "Admin"] },
  { label: "Organogram", icon: Network, href: "/organogram", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Departments", icon: Building2, href: "/departments", roles: ["HR", "Admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();
  const visibleItems = navItems.filter((item) => item.roles.includes(role as AppRole));

  return (
    <aside className="hidden w-[310px] shrink-0 border-r border-white/8 bg-[#0d1116] lg:block">
      <div className="flex h-full flex-col">
        <div className="flex h-[260px] items-center border-b border-white/8 px-5 py-6">
          <BrandLogo className="w-full" src="/ITSW Neon.png" />
        </div>

        <div className="px-5 py-8">
          <nav className="space-y-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-[18px] px-5 py-4 text-left text-[1.05rem] transition",
                    isActive
                      ? "bg-[#1a2127] text-white shadow-[0_18px_36px_rgba(0,0,0,0.22)] ring-1 ring-[#63e7ff]/28"
                      : "text-[#cad2e7] hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className={cn(isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto px-7 py-8">
          <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#182028] text-[#63e7ff]">
              <Bell className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[1.05rem] font-semibold text-white">Recruitment Updates</p>
            <p className="mt-2 text-sm leading-6 text-[#8fa2b5]">
              Keep hiring requests, candidate movement, and invite activity in one consistent workspace.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
