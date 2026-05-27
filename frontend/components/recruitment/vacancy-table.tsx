import Link from "next/link";
import { ArrowUpRight, Eye } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import type { VacancyRecord } from "@/lib/recruitment-types";

type VacancyTableProps = {
  items: VacancyRecord[];
  selectedIds?: string[];
  onToggleSelect?: (vacancyId: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
};

const toneMap = {
  open: "green",
  on_hold: "blue",
  closed: "slate",
} as const;

export function VacancyTable({ items, selectedIds = [], onToggleSelect, onToggleAll }: VacancyTableProps) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="grid grid-cols-[0.18fr_1.35fr_0.9fr_0.6fr_0.4fr] gap-4 border-b border-white/8 px-6 py-4 text-sm font-medium text-[#eef5fb]">
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-white/20 bg-transparent accent-[#8fb6ff]"
            checked={allSelected}
            onChange={(event) => onToggleAll?.(event.target.checked)}
          />
        </label>
        <span>Title</span>
        <span>Department</span>
        <span>Status</span>
        <span>View</span>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[0.18fr_1.35fr_0.9fr_0.6fr_0.4fr] gap-4 border-b border-white/6 px-6 py-5 last:border-b-0"
        >
          <label className="flex items-start justify-center pt-1">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-white/20 bg-transparent accent-[#8fb6ff]"
              checked={selectedIds.includes(item.id)}
              onChange={(event) => onToggleSelect?.(item.id, event.target.checked)}
            />
          </label>
          <div>
            <p className="font-semibold text-white">{item.title}</p>
            <p className="mt-1 text-sm text-[#d9e5ee]">
              {item.location} | {item.employmentType}
            </p>
          </div>
          <div className="text-sm text-[#eef5fb]">{item.department}</div>
          <div>
            <StatusPill status={item.status} tone={toneMap[item.status]} />
          </div>
          <div>
            <Link
              href={`/vacancies/${item.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#f4f8fb] transition hover:border-[#7eb9df]/30 hover:bg-[#466d8a]/18 hover:text-white"
              aria-label={`View vacancy ${item.title}`}
            >
              <Eye className="h-4 w-4 text-[#c9e2f2]" />
              <span>View</span>
              <ArrowUpRight className="h-4 w-4 text-[#c9d8e3]" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
