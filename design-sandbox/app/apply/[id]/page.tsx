import Image from "next/image";
import { notFound } from "next/navigation";

import { PublicApplyForm } from "@/components/recruitment/public-apply-form";
import type { VacancyApiRecord } from "@/lib/recruitment-types";

type ApplyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

  const response = await fetch(`${apiBaseUrl}/vacancies/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    notFound();
  }

  const vacancy = (await response.json()) as VacancyApiRecord;
  const parsedData = vacancy.parsed_data ?? {};
  const location =
    typeof parsedData.location === "string" && parsedData.location.trim()
      ? parsedData.location
      : "Location not set";
  const employmentType =
    typeof parsedData.employment_type === "string" && parsedData.employment_type.trim()
      ? parsedData.employment_type
      : "Full-time";
  const descriptionSections = buildDescriptionSections(vacancy.description);
  const introText = descriptionSections.summary ?? vacancy.description;

  return (
    <main className="min-h-screen px-6 py-10 text-[#f5f7fa]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Image
              src="/it-solutions-new.png"
              alt="IT Solutions Worldwide"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-contain"
            />
          </div>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-[#8fa9be]">
              IT Solutions Worldwide
            </p>
            <p className="mt-1 text-sm text-[#c1ced9]">External candidate application portal</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8fa9be]">
              Open role
            </p>
            <h1 className="mt-4 text-[3rem] font-semibold tracking-[-0.05em] text-white">
              {vacancy.title}
            </h1>
            <p className="mt-4 text-[1.05rem] leading-8 text-[#bfd0dd]">
              {introText}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f98ad]">Location</p>
                <p className="mt-2 text-base font-medium text-white">{location}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f98ad]">Employment</p>
                <p className="mt-2 text-base font-medium text-white">{employmentType}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f98ad]">Experience</p>
                <p className="mt-2 text-base font-medium text-white">
                  {vacancy.experience_level ?? "Not specified"}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.04] px-6 py-6">
              {descriptionSections.overview.length > 0 ? (
                <div>
                  <h2 className="text-[1.1rem] font-semibold text-white">Overview</h2>
                  <div className="mt-3 space-y-3 text-[1rem] leading-8 text-[#bfd0dd]">
                    {descriptionSections.overview.map((paragraph, index) => (
                      <p key={`overview-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {descriptionSections.responsibilities.length > 0 ? (
                <div className="mt-8 border-t border-white/10 pt-8">
                  <h2 className="text-[1.1rem] font-semibold text-white">Key Responsibilities</h2>
                  <ul className="mt-4 space-y-3 text-[1rem] leading-8 text-[#bfd0dd]">
                    {descriptionSections.responsibilities.map((item, index) => (
                      <li key={`responsibility-${index}`} className="flex gap-3">
                        <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#86a6bf]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {descriptionSections.qualifications.length > 0 ? (
                <div className="mt-8 border-t border-white/10 pt-8">
                  <h2 className="text-[1.1rem] font-semibold text-white">Qualifications</h2>
                  <ul className="mt-4 space-y-3 text-[1rem] leading-8 text-[#bfd0dd]">
                    {descriptionSections.qualifications.map((item, index) => (
                      <li key={`qualification-${index}`} className="flex gap-3">
                        <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#86a6bf]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {descriptionSections.benefits.length > 0 ? (
                <div className="mt-8 border-t border-white/10 pt-8">
                  <h2 className="text-[1.1rem] font-semibold text-white">Benefits</h2>
                  <ul className="mt-4 space-y-3 text-[1rem] leading-8 text-[#bfd0dd]">
                    {descriptionSections.benefits.map((item, index) => (
                      <li key={`benefit-${index}`} className="flex gap-3">
                        <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#86a6bf]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {descriptionSections.additional.length > 0 ? (
                <div className="mt-8 border-t border-white/10 pt-8">
                  <h2 className="text-[1.1rem] font-semibold text-white">Additional Information</h2>
                  <ul className="mt-4 space-y-3 text-[1rem] leading-8 text-[#bfd0dd]">
                    {descriptionSections.additional.map((item, index) => (
                      <li key={`additional-${index}`} className="flex gap-3">
                        <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#86a6bf]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-8 border-t border-white/10 pt-8">
                <h2 className="text-[1.15rem] font-semibold text-white">Required skills</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                {vacancy.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#d4e1ea]"
                  >
                    {skill}
                  </span>
                ))}
                </div>
              </div>
            </div>
          </section>

          <PublicApplyForm vacancy={vacancy} />
        </div>
      </div>
    </main>
  );
}

type DescriptionSections = {
  summary: string | null;
  overview: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  additional: string[];
};

function buildDescriptionSections(description: string): DescriptionSections {
  const normalized = description.replace(/\r\n/g, "\n").trim();

  const summaryMatch = normalized.match(/Overview\s+([\s\S]*?)(?:Key Responsibilities|Qualifications|Nice to Have|Benefits|Additional Information|$)/i);
  const overview = summaryMatch ? splitParagraphs(summaryMatch[1]) : [];

  return {
    summary: overview[0] ?? null,
    overview: overview.slice(1),
    responsibilities: extractBulletSection(normalized, "Key Responsibilities", [
      "Qualifications",
      "Nice to Have",
      "Benefits",
      "Additional Information",
    ]),
    qualifications: [
      ...extractBulletSection(normalized, "Qualifications", [
        "Nice to Have",
        "Benefits",
        "Additional Information",
      ]),
      ...extractBulletSection(normalized, "Nice to Have", ["Benefits", "Additional Information"]),
    ],
    benefits: extractBulletSection(normalized, "Benefits", ["Additional Information"]),
    additional: extractBulletSection(normalized, "Additional Information", []),
  };
}

function extractBulletSection(description: string, heading: string, nextHeadings: string[]): string[] {
  const escapedHeading = escapeRegExp(heading);
  const nextPattern = nextHeadings.length > 0 ? nextHeadings.map(escapeRegExp).join("|") : "$";
  const regex = new RegExp(`${escapedHeading}\\s*([\\s\\S]*?)(?:${nextPattern}|$)`, "i");
  const match = description.match(regex);

  if (!match) {
    return [];
  }

  return match[1]
    .split(/\s+-\s+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
