"use client";

import { Bell, Clock3, HelpCircle, Search } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { roleProfiles } from "@/lib/session";

export function TopBar() {
  const { role } = useRole();
  const profile = roleProfiles[role];

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0b141e] px-6 lg:px-8 xl:px-10">
      <div className="flex min-h-16 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between xl:py-0">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex h-11 w-full max-w-[580px] items-center rounded-full bg-[#222b36] px-5 text-[#dae3f2]">
            <Search className="mr-3 h-5 w-5 text-[#bacac7]" />
            <span className="text-[0.98rem] text-[#859491]">Search across TalentEngine...</span>
          </div>
        </div>

        <div className="ml-6 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full p-2 text-[#bacac7] transition hover:bg-[#17202b] hover:text-white"
              aria-label="History"
            >
              <Clock3 className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="relative rounded-full p-2 text-[#bacac7] transition hover:bg-[#17202b] hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-[#0b141e] bg-[#66fcf1]" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-[#bacac7] transition hover:bg-[#17202b] hover:text-white"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <button
            type="button"
            className="inline-flex items-center rounded-xl bg-[#222b36] px-6 py-2.5 text-[0.98rem] font-bold text-[#dae3f2] transition hover:brightness-110"
          >
            Bulk Import
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-xl bg-white px-6 py-2.5 text-[0.98rem] font-bold text-[#0b141e] transition hover:brightness-95"
          >
            Create Request
          </button>

          <div className="flex items-center gap-3 pl-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#17202b] text-sm font-semibold text-[#dae3f2]">
              {profile.initials}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
