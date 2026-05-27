import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { vacancies } from "@/lib/mock-data";

export function VacanciesTable() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03]">
      <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_70px] gap-4 border-b border-white/10 px-6 py-4 text-xs uppercase tracking-[0.22em] text-[#7f94a8]">
        <span>Role</span>
        <span>Department</span>
        <span>Setup</span>
        <span>Status</span>
        <span />
      </div>

      {vacancies.map((vacancy) => (
        <Link
          key={vacancy.id}
          href={`/vacancies/${vacancy.id}`}
          className="grid grid-cols-[2.2fr_1fr_1fr_1fr_70px] gap-4 border-b border-white/10 px-6 py-5 transition hover:bg-white/[0.04]"
        >
          <div>
            <p className="text-lg font-semibold text-white">{vacancy.title}</p>
            <p className="mt-2 text-sm leading-6 text-[#9fb2c3]">{vacancy.summary}</p>
          </div>
          <div className="text-sm text-[#d9e5ee]">{vacancy.department}</div>
          <div className="text-sm text-[#d9e5ee]">
            <p>{vacancy.location}</p>
            <p className="mt-2 text-[#8ea1b2]">{vacancy.employmentType}</p>
          </div>
          <div>
            <span className="inline-flex rounded-full border border-[#36556c] bg-[#152531] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#cdeaff]">
              {vacancy.status}
            </span>
          </div>
          <div className="flex items-center justify-end text-[#bfd3e6]">
            <ChevronRight className="h-5 w-5" />
          </div>
        </Link>
      ))}

      <div className="flex items-center justify-between px-6 py-4 text-sm text-[#8ca0b1]">
        <span>Mock data only. Safe to redesign.</span>
        <span className="inline-flex items-center gap-2 text-[#dce8f2]">
          Open prototype detail <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
