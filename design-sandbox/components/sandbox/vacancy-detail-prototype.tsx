import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { publicApplyVacancy, type SandboxVacancy } from "@/lib/mock-data";

export function VacancyDetailPrototype({ vacancy }: { vacancy: SandboxVacancy }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#7f94a8]">Prototype vacancy detail</p>
            <h2 className="mt-3 text-[2.1rem] font-semibold tracking-[-0.04em] text-white">{vacancy.title}</h2>
            <p className="mt-3 text-sm text-[#a9bbc9]">
              {vacancy.department} · {vacancy.location} · {vacancy.employmentType} · {vacancy.experienceLevel}
            </p>
          </div>
          <span className="inline-flex rounded-full border border-[#36556c] bg-[#152531] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#cdeaff]">
            {vacancy.status}
          </span>
        </div>

        <div className="mt-8 rounded-[26px] border border-white/10 bg-[#0d141c] p-6">
          <h3 className="text-lg font-semibold text-white">Overview</h3>
          <div className="mt-4 space-y-4 text-[1rem] leading-8 text-[#b7c8d5]">
            {vacancy.overview.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-lg font-semibold text-white">Responsibilities</h3>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[#b7c8d5]">
              {vacancy.responsibilities.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#8fd7ff]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-lg font-semibold text-white">Qualifications</h3>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[#b7c8d5]">
              {vacancy.qualifications.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#8fd7ff]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-[#7f94a8]">Public flow</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Candidate apply page</h3>
          <p className="mt-3 text-sm leading-7 text-[#b7c8d5]">
            Use this screen to explore a cleaner public candidate experience before bringing it into the main app.
          </p>
          <Link
            href={`/apply/${publicApplyVacancy.id}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#36556c] bg-[#152531] px-4 py-3 text-sm font-semibold text-[#dce8f2]"
          >
            Open apply prototype
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-[#0d141c] p-6">
          <h3 className="text-lg font-semibold text-white">Required skills</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {vacancy.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#dce8f2]"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
