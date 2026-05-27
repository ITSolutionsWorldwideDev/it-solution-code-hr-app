"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  Home,
  Network,
  NotebookPen,
  Send,
  UserRoundCheck,
  Rows3,
  Users,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { useRole } from "@/components/providers/role-provider";
import { ProfileCard } from "@/components/ui/profile-card";
import { type AppRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: Home, href: "/dashboard", roles: ["HR", "Technical", "Manager", "Admin"] },
  { label: "Job Description", icon: NotebookPen, href: "/hiring-requests", roles: ["HR", "Admin"] },
  { label: "Shortlisted", icon: Send, href: "/shortlisted", roles: ["HR"] },
  { label: "Candidates", icon: Users, href: "/candidates", roles: ["HR", "Admin"] },
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
    <aside className="hidden w-[250px] shrink-0 border-r border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] lg:block xl:w-[265px]">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/8 bg-[#0a0c10] px-4 py-5 xl:px-6 xl:py-6">
          <BrandLogo className="mx-auto h-[132px] w-[230px] xl:h-[140px] xl:w-[240px]" />
        </div>

        <div className="px-3 py-4 xl:px-4 xl:py-5">
          <nav className="space-y-2">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-[0.98rem] transition xl:px-5 xl:py-3 xl:text-[1.02rem]",
                    isActive
                      ? "border border-[#7eb9df]/25 bg-[#466d8a]/18 text-[#dceaf6] shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                      : "text-[#97aaba] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className={cn(isActive ? "font-semibold" : "font-medium")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <ProfileCard />
        </div>
      </div>
    </aside>
  );
}
