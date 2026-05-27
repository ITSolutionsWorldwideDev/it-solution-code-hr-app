import { FileText } from "lucide-react";

import { AvatarBadge } from "@/components/ui/avatar-badge";
import type { ActivityItem } from "@/lib/types";

type ActivityTableProps = {
  items: ActivityItem[];
};

export function ActivityTable({ items }: ActivityTableProps) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)]">
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
        <h3 className="text-[1.25rem] font-semibold text-white">Recent Activity</h3>
        <button
          type="button"
          className="rounded-xl bg-[#466d8a]/18 px-4 py-1.5 text-sm font-semibold text-[#a9cde4]"
        >
          View all
        </button>
      </div>

      <div className="grid grid-cols-[1.75fr_0.78fr_0.37fr] gap-4 border-b border-white/8 px-6 py-3 text-sm text-[#8ea2b3]">
        <span>Activity</span>
        <span>Candidate</span>
        <span>Time</span>
      </div>

      <div>
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1.75fr_0.78fr_0.37fr] gap-4 border-b border-white/6 px-6 py-4 last:border-b-0"
          >
            <div>
              <p className="text-[0.99rem] font-medium leading-7 text-[#edf4fa]">{item.title}</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-[#8ea2b3]">
                <FileText className="h-3 w-3" />
                <span>{item.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AvatarBadge initials={item.candidateInitials} />
              <div className="leading-tight">
                <p className="font-medium text-[#edf4fa]">{item.candidateName}</p>
                <p className="mt-1 text-sm text-[#8ea2b3]">{item.candidateRole}</p>
              </div>
            </div>

            <div className="text-sm leading-6 text-[#8ea2b3]">{item.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
