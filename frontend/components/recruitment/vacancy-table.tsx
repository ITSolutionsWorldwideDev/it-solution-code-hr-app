"use client";

import Link from "next/link";
import { ArrowUpRight, Eye, Trash2 } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import type { VacancyRecord } from "@/lib/recruitment-types";

type VacancyTableProps = {
  items: VacancyRecord[];
  selectedIds?: string[];
  onToggleSelect?: (vacancyId: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
  onDeleteVacancy?: (vacancyId: string) => void;
};

const toneMap = {
  open: "green",
  on_hold: "blue",
  closed: "slate",
} as const;

type PostedPortal = {
  key: string;
  label: string;
  color: string;
  dotColor: string;
};

function getPostedPortals(parsedData?: Record<string, unknown>): PostedPortal[] {
  if (!parsedData) return [];

  const target = String(
    parsedData.target_portal ||
    parsedData.targetPortal ||
    ""
  ).toLowerCase().trim();

  const isPublished =
    parsedData.published === 1 ||
    parsedData.published === true ||
    Boolean(parsedData.itww_job_info_id || parsedData.ish_job_info_id || parsedData.dinel_job_info_id);

  if (!isPublished && (!target || target === "none")) {
    return [];
  }

  const portals: PostedPortal[] = [];

  const hasItww =
    target === "all" ||
    target === "all_portals" ||
    target === "both" ||
    target.includes("itww") ||
    target.includes("worldwide") ||
    Boolean(parsedData.itww_job_info_id);

  const hasIsh =
    target === "all" ||
    target === "all_portals" ||
    target === "both" ||
    target.includes("ish") ||
    target.includes("hub") ||
    target.includes("itsh") ||
    Boolean(parsedData.ish_job_info_id);

  const hasDinel =
    target === "all" ||
    target === "all_portals" ||
    target.includes("dinel") ||
    target.includes("staff") ||
    target.includes("outsourcing") ||
    Boolean(parsedData.dinel_job_info_id);

  if (hasItww) {
    portals.push({
      key: "itww",
      label: "ITWW",
      color: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      dotColor: "bg-sky-400",
    });
  }
  if (hasIsh) {
    portals.push({
      key: "itsh",
      label: "ITSH",
      color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
      dotColor: "bg-indigo-400",
    });
  }
  if (hasDinel) {
    portals.push({
      key: "dinel",
      label: "Staff Outsourcing",
      color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      dotColor: "bg-emerald-400",
    });
  }

  if (portals.length === 0 && isPublished) {
    portals.push(
      { key: "itww", label: "ITWW", color: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotColor: "bg-sky-400" },
      { key: "itsh", label: "ITSH", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", dotColor: "bg-indigo-400" },
      { key: "dinel", label: "Staff Outsourcing", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotColor: "bg-emerald-400" }
    );
  }

  return portals;
}

export function VacancyTable({
  items,
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  onDeleteVacancy,
}: VacancyTableProps) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="grid grid-cols-[0.18fr_1.45fr_0.8fr_0.6fr_0.5fr] gap-4 border-b border-white/8 px-6 py-4 text-sm font-medium text-[#eef5fb]">
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-white/20 bg-transparent accent-[#8fb6ff]"
            checked={allSelected}
            onChange={(event) => onToggleAll?.(event.target.checked)}
          />
        </label>
        <span>Title & Portals</span>
        <span>Department</span>
        <span>Status</span>
        <span>Actions</span>
      </div>

      {items.map((item) => {
        const portals = getPostedPortals(item.parsedData);

        return (
          <div
            key={item.id}
            className="grid grid-cols-[0.18fr_1.45fr_0.8fr_0.6fr_0.5fr] items-center gap-4 border-b border-white/6 px-6 py-5 last:border-b-0"
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
              <p className="mt-0.5 text-xs text-[#9bb0bf]">
                {item.location} • {item.employmentType}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#728696]">Sites:</span>
                {portals.length > 0 ? (
                  portals.map((p) => (
                    <span
                      key={p.key}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${p.color}`}
                      title={`Live on ${p.label}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${p.dotColor}`} />
                      {p.label}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[#728696]">
                    Not Posted
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-[#eef5fb]">{item.department}</div>
            <div>
              <StatusPill status={item.status} tone={toneMap[item.status]} />
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/vacancies/${item.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#f4f8fb] transition hover:border-[#7eb9df]/30 hover:bg-[#466d8a]/18 hover:text-white"
                aria-label={`View vacancy ${item.title}`}
              >
                <Eye className="h-3.5 w-3.5 text-[#c9e2f2]" />
                <span>View</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[#c9d8e3]" />
              </Link>
              {onDeleteVacancy ? (
                <button
                  type="button"
                  onClick={() => onDeleteVacancy(item.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-300 transition hover:border-red-500/50 hover:bg-red-500/25 hover:text-white"
                  title={`Delete ${item.title}`}
                  aria-label={`Delete vacancy ${item.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
