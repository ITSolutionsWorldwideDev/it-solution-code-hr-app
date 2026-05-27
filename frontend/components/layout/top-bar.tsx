"use client";

import Link from "next/link";
import { Bell, MessageSquareMore, Search } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { roleProfiles, roleWorkspaceLabels } from "@/lib/session";

export function TopBar() {
  const { role, name } = useRole();
  const profile = roleProfiles[role];
  const workspaceLabel = roleWorkspaceLabels[role];

  return (
    <div className="border-b border-white/8 bg-[#161d24] px-5 lg:px-10 xl:px-12">
      <div className="flex h-[122px] flex-col justify-center gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[2rem] font-semibold tracking-[-0.05em] text-[#eef2ff]">Recruitment Command Center</p>
          <p className="mt-1 text-sm text-[#95a199]">
            {name} / {profile.title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <div className="inline-flex h-[52px] items-center gap-3 rounded-[18px] border border-white/10 bg-[#10161c] px-5 text-[0.98rem] text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
            <Search className="h-5 w-5 text-[#63e7ff]" />
            <span className="text-white/62">Search candidates</span>
          </div>
          <button
            type="button"
            className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-white/10 bg-[#10161c] text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
          >
            <MessageSquareMore className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="relative inline-flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-white/10 bg-[#10161c] text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
          >
            <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#63e7ff]" />
            <Bell className="h-5 w-5" />
          </button>
          <div className="hidden h-12 w-px bg-white/8 xl:block" />
          <div className="hidden min-w-[140px] text-right xl:block">
            <div className="text-[1.05rem] font-semibold text-[#eef2ff]">{name}</div>
            <div className="text-sm text-[#95a199]">{profile.title}</div>
          </div>
          <div className="inline-flex h-[44px] items-center gap-3 rounded-full border border-white/10 bg-[#10161c] px-4 text-sm font-medium text-white">
            <span className="text-white/60">Workspace</span>
            <span className="rounded-full bg-[#182633] px-3 py-1 text-sm font-semibold text-[#c9f6ff]">
              {workspaceLabel}
            </span>
          </div>
          <Link
            href="/#employee-login"
            className="inline-flex h-[52px] items-center rounded-[16px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-6 text-[1rem] font-semibold text-[#06141c] shadow-[0_18px_34px_rgba(0,0,0,0.18)]"
          >
            Change workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
