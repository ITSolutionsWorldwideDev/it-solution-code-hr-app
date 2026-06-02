import Image from "next/image";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, CircleDollarSign, Clock3, MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { PublicApplyForm } from "@/components/recruitment/public-apply-form";
import type { VacancyApiRecord } from "@/lib/recruitment-types";

type ApplyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CandidateFacingContent = {
  shortSummary: string;
  overview: Array<{ label: string; value: string; icon: ReactNode }>;
  aboutRole: string[];
  responsibilities: string[];
};

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://it-solution-code-hr-app-backend.vercel.app/api";

  const response = await fetch(`${apiBaseUrl}/vacancies/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    notFound();
  }

  const vacancy = (await response.json()) as VacancyApiRecord;
  const content = buildCandidateFacingContent(vacancy);

  return (
    <main className="min-h-screen bg-[#0b0d10] px-5 py-5 text-white md:px-8">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(88,122,164,0.12),transparent_28%),linear-gradient(180deg,#111315_0%,#0d0f12_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <header className="border-b border-white/8 px-6 py-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#8cabff]/25 bg-[#8cabff]/10">
                <Image
                  src="/ITSW Neon.png"
                  alt="IT Solutions Worldwide"
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">IT Solutions Worldwide</p>
                <p className="text-xs text-[#92a2b2]">Job details</p>
              </div>
            </div>

            <nav className="flex items-center gap-6 text-sm text-[#97a9bc]">
              <span className="font-semibold text-[#b8ccff]">Job Details</span>
              <span>Application</span>
              <span>Submit</span>
            </nav>
          </div>
        </header>

        <div className="px-6 py-8 md:px-8 md:py-10">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#8cabff]/20 bg-[#8cabff]/10 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#a9c3ff]">
              Open Role
            </span>
            <h1 className="mt-4 text-[2.6rem] font-semibold tracking-[-0.05em] text-white md:text-[3.25rem]">
              {vacancy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[1.02rem] leading-7 text-[#b8c7d5]">
              Join IT SOLUTIONS WORLDWIDE to shape the future of enterprise hiring and digital operations across our
              global technology ecosystem.
            </p>
            <div className="mt-8 h-px w-full max-w-4xl bg-gradient-to-r from-[#a7c1ff] via-white/10 to-transparent" />
          </div>

          <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-8">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
                <h2 className="text-[1.35rem] font-semibold text-white">Short Summary</h2>
                <p className="mt-3 max-w-3xl text-[1rem] leading-8 text-[#c7d4df]">{content.shortSummary}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {content.overview.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] border border-white/10 bg-white/[0.035] px-5 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#9fc0ff]">{item.icon}</div>
                      <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#93a6bb]">
                          {item.label}
                        </p>
                        <p className="mt-1 text-[0.98rem] font-medium leading-6 text-white">{item.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <SectionBlock title="About the Role">
                {content.aboutRole.map((paragraph, index) => (
                  <p key={`about-role-${index}`} className="text-[1rem] leading-8 text-[#c7d4df]">
                    {paragraph}
                  </p>
                ))}
              </SectionBlock>

              <SectionBlock title="Key Responsibilities">
                <ul className="space-y-4">
                  {content.responsibilities.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-3 text-[1rem] leading-8 text-[#c7d4df]">
                      <span className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full border border-[#9db8ff] bg-[#9db8ff]/15" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </SectionBlock>
            </section>

            <aside className="space-y-5">
              <PublicApplyForm vacancy={vacancy} compact />

              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
                <div className="relative h-40 w-full">
                  <Image
                    src="/image_18.png"
                    alt="IT Solutions Worldwide studio"
                    fill
                    className="object-cover opacity-65"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f12] via-transparent to-transparent" />
                </div>
                <div className="px-5 py-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#9db8ff]">
                    Our Team
                  </p>
                  <p className="mt-1 text-sm text-white">IT Solutions Worldwide</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.24)]">
      <h2 className="text-[1.5rem] font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function buildCandidateFacingContent(vacancy: VacancyApiRecord): CandidateFacingContent {
  const parsedData = asRecord(vacancy.parsed_data);
  const rawDescription = typeof vacancy.description === "string" ? vacancy.description.trim() : "";
  const normalizedDescription = normalizeDescription(rawDescription);
  const department = readString(parsedData, "department") ?? "Product";
  const employmentType = readString(parsedData, "employment_type") ?? "Full-time";
  const location = readString(parsedData, "location") ?? "London / Remote Hybrid";
  const compensation =
    readString(parsedData, "compensation") ?? readString(parsedData, "budget") ?? "Up to 50,000 annually (DOE)";
  const reportsTo = readString(parsedData, "reports_to") ?? "Hiring Manager";

  const aboutRole =
    extractParagraphSection(normalizedDescription, ["About the Role"], [
      "Key Responsibilities",
      "What You’ll Bring",
      "What You'll Bring",
      "Nice to Have",
      "Working Arrangements and Benefits",
      "How to Apply",
    ]) ?? [
      "We are seeking a strong candidate who can contribute meaningful expertise, collaborate across teams, and help deliver high-quality outcomes in a fast-moving environment.",
    ];

  const responsibilities =
    extractBulletSection(normalizedDescription, ["Key Responsibilities"], [
      "What You’ll Bring",
      "What You'll Bring",
      "Nice to Have",
      "Working Arrangements and Benefits",
      "How to Apply",
    ]) ?? vacancy.required_skills;

  const whatYouBring =
    extractBulletSection(normalizedDescription, ["What You’ll Bring", "What You'll Bring"], [
      "Nice to Have",
      "Working Arrangements and Benefits",
      "How to Apply",
    ]) ?? vacancy.required_skills;

  const shortSummary =
    extractSingleParagraphSection(normalizedDescription, ["Short Summary"], ["Overview", "About the Role"]) ??
    buildShortSummary(vacancy.title, department, whatYouBring, compensation);

  return {
    shortSummary,
    overview: [
      {
        label: "Job Title",
        value: vacancy.title,
        icon: <BriefcaseBusiness className="h-4 w-4" />,
      },
      {
        label: "Department",
        value: department,
        icon: <UserRound className="h-4 w-4" />,
      },
      {
        label: "Type",
        value: employmentType,
        icon: <Clock3 className="h-4 w-4" />,
      },
      {
        label: "Location",
        value: location,
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        label: "Compensation",
        value: compensation,
        icon: <CircleDollarSign className="h-4 w-4" />,
      },
      {
        label: "Reports To",
        value: reportsTo,
        icon: <UserRound className="h-4 w-4" />,
      },
    ],
    aboutRole,
    responsibilities,
  };
}

function buildShortSummary(title: string, department: string, whatYouBring: string[], compensation: string): string {
  const topSignals = whatYouBring.slice(0, 3).join(", ") || "strong collaboration and role-specific experience";
  return `${title} in the ${department} team with a focus on impact, quality, and strong cross-functional collaboration. Expected strengths include ${topSignals}. Compensation: ${compensation}.`;
}

function normalizeDescription(description: string): string {
  return description
    .replace(/\r\n/g, "\n")
    .replace(
      /(Short Summary|Overview|About the Role|Key Responsibilities|What You’ll Bring|What You'll Bring|Nice to Have|Working Arrangements and Benefits|How to Apply)/gi,
      "\n$1\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    .map((item) => item.trim())
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
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[\-•]\s*/, "").trim())
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

function matchSection(description: string, headings: string[], nextHeadings: string[]): string | null {
  const headingPattern = headings.map(escapeRegExp).join("|");
  const nextPattern = nextHeadings.length > 0 ? nextHeadings.map(escapeRegExp).join("|") : "$";
  const regex = new RegExp(`(?:${headingPattern})\\s*([\\s\\S]*?)(?=\\n(?:${nextPattern})\\b|$)`, "i");
  const match = description.match(regex);
  return match?.[1]?.trim() ?? null;
}

function trimTrailingPeriod(value: string): string {
  return value.replace(/\.+$/, "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
