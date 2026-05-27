"use client";

import Link from "next/link";
import { Bell, ChevronDown, MessageSquareMore, Search } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { roleProfiles, roleWorkspaceLabels } from "@/lib/session";

export function TopBar() {
  const { role, name } = useRole();
  const profile = roleProfiles[role];
  const workspaceLabel = roleWorkspaceLabels[role];

  return (
    <div className="flex flex-col gap-4 border-b border-white/8 px-6 py-5 lg:flex-row lg:items-center lg:justify-end lg:px-10 lg:py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex h-[44px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-[#d8e3ec]">
          <span className="text-[#8da1b2]">Workspace</span>
          <span className="rounded-full bg-[#466d8a]/30 px-3 py-1 text-sm font-semibold text-[#9ec5df]">
            {workspaceLabel}
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-[44px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[0.98rem] font-medium text-[#d8e3ec]"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
        <button
          type="button"
          className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#d8e3ec]"
        >
          <MessageSquareMore className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#d8e3ec]"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] pl-1 pr-1 text-left"
        >
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-gradient-to-br from-[#b7cbe3] via-[#5c85b4] to-[#294a74] text-sm font-bold text-white">
            {profile.initials}
          </div>
            <div className="hidden pr-1 text-left sm:block">
              <div className="text-sm font-semibold text-[#edf4fa]">{name}</div>
              <div className="text-xs text-[#8ea2b3]">{profile.title}</div>
            </div>
          <ChevronDown className="h-5 w-5 text-[#cfe0eb]" />
        </button>
        <Link
          href="/#employee-login"
          className="inline-flex h-[44px] items-center rounded-2xl border border-[#7eb9df]/20 bg-[#466d8a]/16 px-4 text-sm font-semibold text-[#b5d1e4]"
        >
          Change workspace
        </Link>
      </div>
    </div>
  );
}
