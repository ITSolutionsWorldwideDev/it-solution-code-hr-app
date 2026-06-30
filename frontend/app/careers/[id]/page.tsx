import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Clock3,
  MapPin,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { PublicApplyForm } from "@/components/recruitment/public-apply-form";
import {
  cleanInlineJobText,
  isCandidateFacingNoise,
  normalizeJobText,
  parseJobSections,
  sanitizeCandidateFacingLines,
  type ParsedJobSections,
} from "@/lib/job-text";
import type { PublishedWebsiteJobApiRecord, VacancyApiRecord } from "@/lib/recruitment-types";

type ApplyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CandidateFacingContent = {
  department: string;
  location: string;
  compensation: string;
  shortSummary: string;
  summaryHighlights: string[];
  intro: string;
  techStack: string;
  employmentType: string;
  responsibilities: Array<{ title: string; description: string }>;
  requirements: string[];
  offerItems: Array<{ title: string; description: string }>;
};

type DepartmentApiRecord = {
  id: number;
  name: string;
};

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://it-solution-code-hr-app-backend.vercel.app/api";

  const vacancy = await loadPublicVacancy(apiBaseUrl, id);
  const departmentName = await loadDepartmentName(apiBaseUrl, vacancy.department_id);
  const content = buildCandidateFacingContent(vacancy, departmentName);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b141e] text-[#d4e4fa] selection:bg-[#8aebff]/30">
      <header className="sticky top-0 z-50 border-b border-[#3c494c] bg-[#0b141e]/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#8aebff]/20 bg-[#8aebff]/10 shadow-[0_18px_36px_rgba(47,217,244,0.12)]">
              <Image
                src="/final-logo.png"
                alt="Talent Genie AI"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-['Hanken_Grotesk'] text-[2rem] font-semibold tracking-[-0.03em] text-white">
                Talent Genie AI
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8aebff]">
                Intelligent Precision
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-10 text-sm text-[#bbc9cd] md:flex">
            <Link href="/jobs" className="transition-colors hover:text-[#8aebff]">
              Jobs
            </Link>
            <span className="transition-colors hover:text-[#8aebff]">Companies</span>
            <span className="transition-colors hover:text-[#8aebff]">Resources</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-6 py-10 lg:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <section className="lg:col-span-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded bg-[#00799e]/20 px-3 py-1 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-[#8aebff] ring-1 ring-inset ring-[#8aebff]/30">
                Open Role
              </span>
              <span className="text-sm text-[#bbc9cd]">{formatPostedLabel(vacancy.created_at)}</span>
            </div>

            <h1 className="font-['Hanken_Grotesk'] text-[4.6rem] font-bold lowercase leading-none tracking-[-0.05em] text-[#8aebff]">
              {vacancy.title}
            </h1>

            <div className="mt-6 flex flex-wrap gap-4 text-[#d4e4fa]">
              <MetadataItem
                icon={<BriefcaseBusiness className="h-4 w-4" />}
                emoji="\uD83D\uDCBC"
                label="Department"
                value={content.department}
              />
              <MetadataItem
                icon={<MapPin className="h-4 w-4" />}
                emoji="\uD83D\uDCCD"
                label="Location"
                value={content.location}
              />
              <MetadataItem
                icon={<CircleDollarSign className="h-4 w-4" />}
                emoji="\uD83D\uDCB6"
                label="Compensation"
                value={content.compensation}
              />
            </div>

            <p className="mt-8 max-w-3xl text-[1.08rem] leading-9 text-[#bbc9cd]">{content.intro}</p>
          </section>

          <aside className="space-y-5 lg:col-span-4 lg:row-span-2 lg:self-start lg:sticky lg:top-24">
            <PublicApplyForm vacancy={{ id: vacancy.vacancy_id, title: vacancy.title }} compact />

            <div className="rounded-2xl border border-[#3c494c] bg-[#122131] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#8aebff]/25 bg-[#8aebff]/10">
                  <Building2 className="h-5 w-5 text-[#8aebff]" />
                </div>
                <span className="font-semibold text-white">IT Solutions Worldwide</span>
              </div>
              <p className="text-sm leading-7 text-[#bbc9cd]">
                A global technology leader specializing in enterprise AI integration and scalable digital
                infrastructure.
              </p>
              <div className="mt-5 text-sm font-medium text-[#8aebff]">View Company Profile</div>
            </div>
          </aside>

          <div className="space-y-8 lg:col-span-8">
            <section className="rounded-2xl border border-[#3c494c] bg-[#122131] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
              <SectionTitle title="Short Summary" />
              <p className="text-[1.02rem] leading-8 text-[#cbd7e6]">{content.shortSummary}</p>

              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {content.summaryHighlights.map((item, index) => (
                  <BulletCard key={`${item}-${index}`} tone="accent">
                    {item}
                  </BulletCard>
                ))}
              </ul>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoTile icon={<Sparkles className="h-4 w-4" />} label="Tech Stack" value={content.techStack} />
                <InfoTile icon={<Clock3 className="h-4 w-4" />} label="Type" value={content.employmentType} />
              </div>
            </section>

            <section className="rounded-2xl border border-[#3c494c]/60 bg-[#122131] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
              <SectionTitle title="Key Responsibilities" />
              <div className="grid gap-4 md:grid-cols-2">
                {content.responsibilities.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="rounded-2xl border border-[#3c494c]/60 bg-[#0f1c2b] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]"
                  >
                    <h3 className="flex items-center gap-3 text-[1.05rem] font-semibold text-white">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#8aebff]/12 text-[#8aebff] ring-1 ring-inset ring-[#8aebff]/20">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="mt-3 pl-11 text-[0.98rem] leading-8 text-[#bbc9cd]">{item.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#3c494c]/60 bg-[#122131] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
              <SectionTitle title="Skills & Requirements" />
              <ul className="grid gap-4 md:grid-cols-2">
                {content.requirements.map((item, index) => (
                  <BulletCard key={`${item}-${index}`}>{item}</BulletCard>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-[#3c494c]/60 bg-[#122131] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
              <SectionTitle title="What We Offer" />
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {content.offerItems.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="rounded-2xl border border-[#3c494c]/60 bg-[#0f1c2b] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]"
                  >
                    <p className="flex items-center gap-3 text-[1rem] font-semibold text-white">
                      <span className="text-[1.05rem]" aria-hidden="true">
                        *
                      </span>
                      {item.title}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[#bbc9cd]">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="mt-24 border-t border-[#3c494c] bg-[#010f1f]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col justify-between gap-6 px-6 py-10 lg:flex-row lg:px-10">
          <div>
            <p className="font-['Hanken_Grotesk'] text-[2rem] font-semibold text-white">Talent Genie AI</p>
            <p className="mt-2 text-sm text-[#bbc9cd]">(c) 2024 Talent Genie AI. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm text-[#bbc9cd]">
            <span className="hover:text-[#8aebff]">Privacy Policy</span>
            <span className="hover:text-[#8aebff]">Terms of Service</span>
            <span className="hover:text-[#8aebff]">Security</span>
            <span className="hover:text-[#8aebff]">Cookie Settings</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

async function loadPublicVacancy(apiBaseUrl: string, id: string): Promise<PublishedWebsiteJobApiRecord> {
  const publishedResponse = await fetch(`${apiBaseUrl}/website/jobs/${id}`, {
    cache: "no-store",
  });

  if (publishedResponse.ok) {
    return (await publishedResponse.json()) as PublishedWebsiteJobApiRecord;
  }

  const vacancyResponse = await fetch(`${apiBaseUrl}/vacancies/${id}`, {
    cache: "no-store",
  });

  if (!vacancyResponse.ok) {
    notFound();
  }

  const vacancy = (await vacancyResponse.json()) as VacancyApiRecord;
  return mapVacancyToPublishedWebsiteJob(vacancy);
}

async function loadDepartmentName(apiBaseUrl: string, departmentId: number): Promise<string | null> {
  const response = await fetch(`${apiBaseUrl}/departments/${departmentId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const department = (await response.json()) as DepartmentApiRecord;
  return department.name;
}

function mapVacancyToPublishedWebsiteJob(vacancy: VacancyApiRecord): PublishedWebsiteJobApiRecord {
  const parsedData = asRecord(vacancy.parsed_data);

  return {
    vacancy_id: vacancy.id,
    job_info_id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    required_skills: vacancy.required_skills,
    experience_level: vacancy.experience_level,
    department_id: vacancy.department_id,
    hiring_request_id: vacancy.hiring_request_id,
    ai_summary: vacancy.ai_summary,
    match_score: vacancy.match_score,
    parsed_data: parsedData,
    created_at: vacancy.created_at,
    published_at: vacancy.created_at,
    location: readString(parsedData, "location"),
    employment_type: readString(parsedData, "employment_type"),
    pdf_url: readString(parsedData, "pdf_url"),
  };
}

function MetadataItem({
  icon,
  emoji,
  label,
  value,
}: {
  icon: ReactNode;
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-[#3c494c]/70 bg-[#102031]/78 px-4 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.14)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#8aebff]/20 bg-[#8aebff]/10 text-[1.15rem] shadow-[0_10px_24px_rgba(47,217,244,0.12)]">
        <span aria-hidden="true">{emoji}</span>
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#89a7bb]">
          <span className="text-[#8aebff]">{icon}</span>
          {label}
        </span>
        <span className="truncate text-[1rem] font-semibold text-[#f3f8ff]">{value}</span>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-[#3c494c]/40 bg-[#132538] p-4">
      <div className="mt-0.5 text-[#7bd1fa]">{icon}</div>
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#bbc9cd]">{label}</p>
        <p className="mt-1 font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-6 border-b border-[#8aebff]/15 pb-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8aebff]">Section</p>
      <h2 className="mt-2 flex items-center gap-4 font-['Hanken_Grotesk'] text-[2rem] font-semibold tracking-[-0.03em] text-white">
        <span className="h-2.5 w-2.5 rounded-full bg-[#8aebff] shadow-[0_0_18px_rgba(138,235,255,0.55)]" />
        {title}
      </h2>
    </div>
  );
}

function BulletCard({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent";
}) {
  const bulletTone = tone === "accent" ? "bg-[#8aebff]" : "bg-[#7bd1fa]";
  const borderTone = tone === "accent" ? "border-[#8aebff]/30 bg-[#132538]" : "border-[#3c494c]/60 bg-[#0f1c2b]";

  return (
    <li className={`flex items-start gap-4 rounded-2xl border p-5 text-[1rem] leading-8 text-[#d4e4fa] ${borderTone}`}>
      <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${bulletTone}`} />
      <span className="text-[#c7d7e4]">{children}</span>
    </li>
  );
}

function buildCandidateFacingContent(
  vacancy: PublishedWebsiteJobApiRecord,
  departmentName: string | null,
): CandidateFacingContent {
  const parsedData = asRecord(vacancy.parsed_data);
  const rawDescription = typeof vacancy.description === "string" ? vacancy.description.trim() : "";
  const normalizedDescription = normalizeJobText(rawDescription);
  const parsedSections = parseJobSections(rawDescription);
  const department = departmentName ?? readString(parsedData, "department") ?? "Department not specified";
  const employmentType = vacancy.employment_type ?? readString(parsedData, "employment_type") ?? "Full-time";
  const location = vacancy.location ?? readString(parsedData, "location") ?? "Location not specified";
  const compensation =
    readString(parsedData, "compensation") ?? readString(parsedData, "budget") ?? "Compensation not specified";

  const aboutRoleParagraphs =
    firstSectionLines(parsedSections, ["About the Role", "The Role", "About Us", "Position Overview"]) ??
    extractParagraphSection(normalizedDescription, ["About the Role", "The Role", "About Us"], [
      "Key Responsibilities",
      "Requirements & Qualifications",
      "What You'll Bring",
      "Nice to Have",
      "Working Arrangements and Benefits",
      "What We Offer",
      "How to Apply",
    ]) ??
    [];

  const responsibilities = normalizeLabeledItems(
    sanitizeCandidateFacingLines(
      firstSectionLines(parsedSections, ["Key Responsibilities"]) ??
        extractBulletSection(normalizedDescription, ["Key Responsibilities"], [
          "Requirements & Qualifications",
          "What You'll Bring",
          "Nice to Have",
          "Working Arrangements and Benefits",
          "What We Offer",
          "How to Apply",
        ]) ??
        vacancy.required_skills,
    ),
  );

  const requirements = sanitizeCandidateFacingLines(
    firstSectionLines(parsedSections, ["Requirements & Qualifications", "What You'll Bring"]) ??
      extractBulletSection(normalizedDescription, ["Requirements & Qualifications", "What You'll Bring"], [
        "Nice to Have",
        "Working Arrangements and Benefits",
        "What We Offer",
        "How to Apply",
      ]) ??
      vacancy.required_skills,
  );

  const offerItems = normalizeLabeledItems(
    sanitizeCandidateFacingLines(
      firstSectionLines(parsedSections, ["What We Offer", "Working Arrangements and Benefits"]) ??
        extractBulletSection(normalizedDescription, ["What We Offer", "Working Arrangements and Benefits"], [
          "How to Apply",
        ]) ??
        [],
    ),
  );

  const shortSummary =
    firstSectionParagraph(parsedSections, ["Short Summary", "Overview"]) ??
    extractSingleParagraphSection(normalizedDescription, ["Short Summary", "Overview"], ["About the Role", "The Role"]) ??
    buildShortSummary(vacancy.title, department, vacancy.required_skills, compensation);
  const summaryHighlights = buildSummaryHighlights(shortSummary, vacancy.required_skills, employmentType, location);

  const intro =
    aboutRoleParagraphs[0] ??
    `Join IT SOLUTIONS WORLDWIDE to shape the future of enterprise hiring and digital operations across our global technology ecosystem.`;

  return {
    department,
    location,
    compensation,
    shortSummary,
    summaryHighlights,
    intro,
    techStack: vacancy.required_skills.slice(0, 4).join(", ") || "Not specified",
    employmentType,
    responsibilities:
      responsibilities.length > 0
        ? responsibilities
        : [
            {
              title: "Role Contribution",
              description: "Support the team with strong execution, communication, and domain expertise.",
            },
          ],
    requirements: requirements.map(cleanInlineJobText).filter(Boolean),
    offerItems:
      offerItems.length > 0
        ? offerItems
        : [
            {
              title: "Compensation & Benefits",
              description: compensation,
            },
          ],
  };
}

function firstSectionLines(parsedSections: ParsedJobSections, sectionNames: string[]): string[] | null {
  for (const sectionName of sectionNames) {
    const lines = parsedSections.sections[sectionName as keyof ParsedJobSections["sections"]];
    if (lines && lines.length > 0) {
      return lines.map(cleanInlineJobText).filter(Boolean);
    }
  }

  return null;
}

function firstSectionParagraph(parsedSections: ParsedJobSections, sectionNames: string[]): string | null {
  const lines = firstSectionLines(parsedSections, sectionNames);
  return lines ? lines.join(" ") : null;
}

function buildShortSummary(title: string, department: string, skills: string[], compensation: string): string {
  const topSignals = skills.slice(0, 4).join(", ") || "strong collaboration and role-specific experience";
  return `The ${title} in the ${department} team will focus on high-impact delivery, strong cross-functional collaboration, and clear business outcomes. Expected strengths include ${topSignals}. Compensation: ${compensation}.`;
}

function buildSummaryHighlights(summary: string, skills: string[], employmentType: string, location: string): string[] {
  const normalized = summary
    .split(/(?<=[.!?])\s+/)
    .map((item) => cleanInlineJobText(item))
    .filter(Boolean)
    .slice(0, 2);

  const highlights = [
    ...normalized,
    skills.length > 0 ? `Core stack: ${skills.slice(0, 4).join(", ")}.` : "",
    employmentType ? `Working model: ${employmentType}.` : "",
    location ? `Location: ${location}.` : "",
  ]
    .map((item) => cleanInlineJobText(item))
    .filter(Boolean);

  return Array.from(new Set(highlights)).slice(0, 4);
}

function extractParagraphSection(
  description: string,
  headings: string[],
  nextHeadings: string[],
): string[] | null {
  const content = matchSection(description, headings, nextHeadings);
  if (!content) {
    return null;
  }

  const paragraphs = content
    .split(/\n+/)
    .map((item) => cleanInlineJobText(item))
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : null;
}

function extractSingleParagraphSection(
  description: string,
  headings: string[],
  nextHeadings: string[],
): string | null {
  const paragraphs = extractParagraphSection(description, headings, nextHeadings);
  return paragraphs ? paragraphs.join(" ") : null;
}

function extractBulletSection(
  description: string,
  headings: string[],
  nextHeadings: string[],
): string[] | null {
  const content = matchSection(description, headings, nextHeadings);
  if (!content) {
    return null;
  }

  const items = content
    .split(/\n+/)
    .map((item) => cleanInlineJobText(item))
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

function normalizeLabeledItems(items: string[]) {
  return items
    .map((item) => {
      const cleaned = cleanInlineJobText(item);
      const match = cleaned.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        return {
          title: match[1].trim(),
          description: match[2].trim(),
        };
      }

      return {
        title: cleaned,
        description: "",
      };
    })
    .filter((item) => item.title.length > 0)
    .filter((item) => !isCandidateFacingNoise(item.title))
    .filter((item) => !item.description || !isCandidateFacingNoise(item.description))
    .filter((item) => item.description.trim().toLowerCase() !== item.title.trim().toLowerCase());
}

function matchSection(description: string, headings: string[], nextHeadings: string[]): string | null {
  const headingPattern = headings.map(escapeRegExp).join("|");
  const nextPattern = nextHeadings.length > 0 ? nextHeadings.map(escapeRegExp).join("|") : "$";
  const regex = new RegExp(`(?:${headingPattern})\\s*([\\s\\S]*?)(?=\\n(?:${nextPattern})\\b|$)`, "i");
  const match = description.match(regex);
  return match?.[1]?.trim() ?? null;
}

function formatPostedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently posted";
  }

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays <= 0) {
    return "Posted today";
  }
  if (diffDays === 1) {
    return "Posted 1 day ago";
  }
  if (diffDays < 8) {
    return `Posted ${diffDays} days ago`;
  }

  return `Posted ${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
