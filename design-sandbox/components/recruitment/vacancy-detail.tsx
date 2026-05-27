import { LinkedInPreviewCard } from "@/components/recruitment/linkedin-preview-card";
import { StatusPill } from "@/components/ui/status-pill";
import { VacancyMatchesPanel } from "@/components/recruitment/vacancy-matches-panel";
import type { VacancyRecord } from "@/lib/recruitment-types";

type VacancyDetailProps = {
  vacancy: VacancyRecord;
};

const toneMap = {
  open: "green",
  on_hold: "blue",
  closed: "slate",
} as const;

function formatUploadedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Upload date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function VacancyDetail({ vacancy }: VacancyDetailProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[2rem] font-semibold text-white">{vacancy.title}</h1>
          <StatusPill status={vacancy.status} tone={toneMap[vacancy.status]} />
        </div>
        <p className="mt-3 text-sm text-[#95a8b8]">
          {vacancy.department} · {vacancy.location} · {vacancy.employmentType} ·{" "}
          {vacancy.experienceLevel}
        </p>
        <p className="mt-2 text-sm text-[#7f93a5]">
          Uploaded on {formatUploadedDate(vacancy.createdAt)}
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Short Summary</h2>
            <p className="mt-2 leading-7 text-[#95a8b8]">{vacancy.summary}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">Overview</h2>
            <p className="mt-2 leading-7 text-[#95a8b8]">{vacancy.description}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">Requirements</h2>
            <ul className="mt-3 space-y-3 text-[#95a8b8]">
              {vacancy.requirements.map((requirement) => (
                <li key={requirement} className="rounded-2xl bg-white/[0.04] px-4 py-3">
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <h2 className="text-lg font-semibold text-white">Vacancy Snapshot</h2>
          <dl className="mt-4 space-y-4 text-sm text-[#95a8b8]">
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                Status
              </dt>
              <dd className="mt-1 text-base text-white">{vacancy.status}</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                Department
              </dt>
              <dd className="mt-1 text-base text-white">{vacancy.department}</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
                Uploaded
              </dt>
              <dd className="mt-1 text-base text-white">{formatUploadedDate(vacancy.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <LinkedInPreviewCard vacancyId={vacancy.id} />

        <VacancyMatchesPanel vacancyId={vacancy.id} />
      </aside>
    </div>
  );
}
