import { Clock3 } from "lucide-react";

import type { ActivityItem } from "@/lib/types";

type RecentActivityListProps = {
  items: ActivityItem[];
};

export function RecentActivityList({ items }: RecentActivityListProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,17,38,0.98)_0%,rgba(16,24,47,0.94)_100%)] p-5 transition hover:border-[#79dff0]/18 hover:bg-[#18213f]"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{item.title}</span>
              </div>
              <p className="text-sm leading-6 text-[#95a2c7]">
                {item.candidateName} · {item.candidateRole} · {item.status}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#95a2c7]">
              <Clock3 className="h-4 w-4" />
              <span>{item.timestamp}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
