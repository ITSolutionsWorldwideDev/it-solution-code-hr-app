"use client";

import { Bell, Grid2x2, Plus, Search } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { roleProfiles } from "@/lib/session";

export function TopBar() {
  const { role } = useRole();
  const profile = roleProfiles[role];

  return (
    <div className="border-b border-white/5 bg-[rgba(11,20,28,0.8)] px-5 backdrop-blur-md lg:px-8 xl:px-10">
      <div className="flex min-h-16 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between xl:py-0">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex h-12 w-full max-w-[700px] items-center rounded-full border border-white/5 bg-[#060f16] px-5 text-[#dae3ee]">
            <Search className="mr-3 h-5 w-5 text-[#889297]" />
            <span className="text-[0.98rem] text-[#889297]">Search candidates, skills, or roles...</span>
            <span className="ml-auto rounded-md border border-white/10 bg-[#2d363e] px-2 py-1 text-[0.7rem] uppercase tracking-[0.14em] text-[#dae3ee]">
              ⌘ K
            </span>
          </div>
        </div>

        <div className="ml-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 text-[#bdc8cd] transition hover:text-[#a9e9ff]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="p-2 text-[#bdc8cd] transition hover:text-[#a9e9ff]"
              aria-label="Apps"
            >
              <Grid2x2 className="h-5 w-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#72d0ed] px-6 py-2 text-[1rem] font-bold text-[#003642] transition hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Candidate
          </button>

          <div className="flex items-center gap-3 pl-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#a9e9ff]/20 bg-[#182028] text-sm font-semibold text-[#dae3ee]">
              {profile.initials}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
