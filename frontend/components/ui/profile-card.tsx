"use client";

import { AvatarBadge } from "@/components/ui/avatar-badge";
import { useRole } from "@/components/providers/role-provider";
import { getInitialsFromName, roleProfiles } from "@/lib/session";

export function ProfileCard() {
  const { role, name } = useRole();
  const profile = roleProfiles[role];

  return (
    <div className="mt-auto rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,17,38,0.98)_0%,rgba(16,24,47,0.94)_100%)] px-4 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-3">
        <AvatarBadge initials={getInitialsFromName(name)} />
        <div>
          <p className="text-[1.05rem] font-semibold text-[#edf4fa]">{name}</p>
          <p className="text-sm text-[#8ea2b3]">{profile.title}</p>
        </div>
      </div>
    </div>
  );
}
