"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  FileText,
  GitBranch,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { shellNav } from "@/lib/mock-data";

const iconMap = {
  Dashboard: LayoutDashboard,
  "Job Description": FileText,
  Shortlisted: Users,
  Candidates: Users,
  Vacancies: BriefcaseBusiness,
  Pipeline: GitBranch,
  Onboarding: Users,
  Organogram: Building2,
  Departments: Building2,
} as const;

export function SandboxShell({
  title,
  eyebrow,
  children,
  showFilters = true,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  showFilters?: boolean;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#09070b] px-3 py-3 text-white md:px-4 md:py-4">
      <section className="mx-auto min-h-[calc(100vh-1.5rem)] w-full max-w-[min(1860px,calc(100vw-1.5rem))] rounded-[38px] bg-[#09070b] px-8 py-8 shadow-[0_20px_40px_rgba(98,170,214,0.08)] md:px-10 md:py-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-[210px] items-center rounded-[26px] px-1">
              <Image
                src="/isw-logo.png"
                alt="IT Solutions Worldwide"
                width={760}
                height={210}
                className="h-[196px] w-auto object-contain"
                priority
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className={`flex h-[66px] items-center gap-4 rounded-full px-9 text-[1rem] font-semibold transition ${
                  pathname === "/login"
                    ? "bg-[#1d2c37] text-white ring-1 ring-[#83cfff]/30"
                    : "bg-[#1e1e1e] text-white"
                }`}
              >
                <LayoutDashboard className="h-6 w-6 stroke-[2.2]" />
                <span>Home</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[1rem] font-semibold">Prototype User</p>
              <p className="mt-1 text-[0.92rem] text-[#8b8b8b]">@itsolutions</p>
            </div>
            <div className="relative">
              <div className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-[#292929]">
                <div className="h-[52px] w-[52px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e2f4ff,transparent_25%),linear-gradient(180deg,#87c3ea_0%,#31485b_100%)]" />
              </div>
              <div className="absolute -right-1 top-0 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#d83b35] px-2 text-xs font-bold">
                2
              </div>
            </div>
          </div>
        </header>

        <div className="mt-12 grid gap-10 xl:grid-cols-[290px_1fr]">
          <aside className="flex flex-col gap-6">
            <nav className="space-y-3 rounded-[34px] bg-[#151515] p-6">
              {shellNav.map((item) => {
                const Icon = iconMap[item.label];
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-4 text-[0.98rem] transition ${
                      isActive
                        ? "bg-[#1d2c37] text-white ring-1 ring-[#83cfff]/30"
                        : "text-[#90a2b5] hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-[34px] bg-[#151515] p-6 text-sm text-[#9eb2c4]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#89bfe3]">Prototype</p>
              <p className="mt-3 leading-6">
                This sandbox is separate from the live app. Test layouts here first and copy only the best ideas back later.
              </p>
              <div className="mt-5 rounded-[24px] border border-[#89bfe3]/20 bg-[#0d151c] p-5">
                <p className="text-sm font-semibold text-white">Accent direction</p>
                <p className="mt-2 text-sm text-[#a7bbcb]">Dark shell, light blue highlights, same app structure.</p>
              </div>
            </div>
          </aside>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-[0.82rem] uppercase tracking-[0.24em] text-[#89bfe3]">{eyebrow}</p>
                <h1 className="mt-3 text-[3.6rem] font-black uppercase tracking-[-0.05em] text-white">
                  {title}
                </h1>
              </div>

              {showFilters ? null : null}
            </div>

            <div className="mt-8">{children}</div>
          </section>
        </div>
      </section>
    </main>
  );
}
