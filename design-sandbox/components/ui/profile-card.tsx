"use client";

import { AvatarBadge } from "@/components/ui/avatar-badge";
import { useRole } from "@/components/providers/role-provider";
import { roleProfiles } from "@/lib/session";

export function ProfileCard() {
  const { role, name } = useRole();
  const profile = roleProfiles[role];

  return (
    <div className="mt-auto rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-3">
        <AvatarBadge initials={profile.initials} />
        <div>
          <p className="text-[1.05rem] font-semibold text-[#edf4fa]">{name}</p>
          <p className="text-sm text-[#8ea2b3]">{profile.title}</p>
        </div>
      </div>
    </div>
  );
}
