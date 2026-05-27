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
          className="rounded-3xl border border-line bg-slate-50/70 p-5 transition hover:border-brand-200 hover:bg-white"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{item.title}</span>
              </div>
              <p className="text-sm leading-6 text-muted">
                {item.candidateName} · {item.candidateRole} · {item.status}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Clock3 className="h-4 w-4" />
              <span>{item.timestamp}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
