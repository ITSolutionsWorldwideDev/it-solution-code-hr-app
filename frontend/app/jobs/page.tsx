import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Clock3, MapPin } from "lucide-react";

import type { PublishedWebsiteJobApiRecord } from "@/lib/recruitment-types";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://it-solution-code-hr-app-backend.vercel.app/api";

export default async function JobsPage() {
  const response = await fetch(`${apiBaseUrl}/website/jobs/`, {
    cache: "no-store",
  });

  const jobs = response.ok ? ((await response.json()) as PublishedWebsiteJobApiRecord[]) : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(88,122,164,0.12),transparent_28%),linear-gradient(180deg,#111315_0%,#0d0f12_100%)] px-5 py-6 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:px-8">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-[#a9c3ff]">
            Careers
          </p>
          <h1 className="mt-4 text-[2.8rem] font-semibold tracking-[-0.05em] text-white md:text-[3.5rem]">
            Published vacancies
          </h1>
          <p className="mt-4 max-w-3xl text-[1rem] leading-7 text-[#b8c7d5]">
            Explore open opportunities from IT Solutions Worldwide and apply directly through the recruitment portal.
          </p>
        </section>

        {jobs.length === 0 ? (
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-8 text-[#b8c7d5]">
            No published vacancies are visible right now.
          </section>
        ) : (
          <section className="grid gap-5">
            {jobs.map((job) => (
              <article
                key={`${job.vacancy_id}-${job.job_info_id}`}
                className="rounded-[28px] border border-white/10 bg-white/[0.035] px-6 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-white">{job.title}</h2>
                      <p className="mt-3 max-w-3xl text-[0.98rem] leading-7 text-[#c7d4df]">
                        {job.ai_summary || job.description.slice(0, 220)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-[#d8e3ec]">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                        <MapPin className="h-4 w-4 text-[#9fc0ff]" />
                        {job.location || "Location not set"}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                        <Clock3 className="h-4 w-4 text-[#9fc0ff]" />
                        {job.employment_type || "Full-time"}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                        <BriefcaseBusiness className="h-4 w-4 text-[#9fc0ff]" />
                        Published
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <Link
                      href={`/careers/${job.vacancy_id}`}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#adc2ff] px-6 text-sm font-semibold text-[#0d1420] transition hover:bg-[#bfd0ff]"
                    >
                      View & Apply
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
