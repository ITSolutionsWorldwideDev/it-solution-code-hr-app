import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  MapPin,
  UserRound,
} from "lucide-react";

import { LinkedInPreviewCard } from "@/components/recruitment/linkedin-preview-card";
import { WebsitePublishCard } from "@/components/recruitment/website-publish-card";
import { cleanInlineJobText, normalizeJobText } from "@/lib/job-text";
import type { VacancyRecord } from "@/lib/recruitment-types";

type VacancyDetailProps = {
  vacancy: VacancyRecord;
};

type VacancyDetailContent = {
  overview: Array<{ label: string; value: string; icon: React.ReactNode }>;
  aboutRole: string[];
  fullDescription: Array<{ kind: "heading" | "bullet" | "paragraph" | "divider"; text: string }>;
};

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

function normalizeWorkspaceDescription(description: string) {
  const marker = /(?:###\s*\*\*How to Apply\*\*|How to Apply)/i;

  if (marker.test(description)) {
    return description.split(marker)[0].trimEnd();
  }

  return description;
}

export function VacancyDetail({ vacancy }: VacancyDetailProps) {
  const content = buildVacancyDetailContent(vacancy);
  const compensation = extractCompensation(vacancy) ?? "Not specified";

  return (
    <div className="relative mx-auto max-w-[1440px]">
      <div className="pointer-events-none fixed right-[-100px] top-[20%] h-[500px] w-[500px] rounded-full bg-[#62f9ee]/[0.05] blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-100px] left-[17rem] h-[400px] w-[400px] rounded-full bg-[#62f9ee]/[0.05] blur-[120px]" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-[#3c4948]/40 bg-[#17202b] p-9 shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-[#3cdcd1]" />

            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col gap-2">
                  <nav className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.24em] text-[#859491]">
                    <span>Vacancies</span>
                    <span className="text-[#5b6773]">›</span>
                    <span className="text-[#dae3f2]">Active Postings</span>
                  </nav>
                  <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-white">
                    {vacancy.title}
                  </h1>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#3cdcd1]/30 bg-[#62f9ee]/10 px-4 py-2 text-[12px] font-bold text-[#62f9ee]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3cdcd1]" />
                    Open
                  </span>
                  <p className="font-mono text-[12px] text-[#859491]">Uploaded on {formatUploadedDate(vacancy.createdAt)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-10 gap-y-4 border-t border-[#3c4948]/30 pt-6 text-[14px] text-[#dae3f2]">
                <div className="flex items-center gap-2.5">
                  <BriefcaseBusiness className="h-4 w-4 text-[#3cdcd1]" />
                  <span>{vacancy.department}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-[#3cdcd1]" />
                  <span>{vacancy.location}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock3 className="h-4 w-4 text-[#3cdcd1]" />
                  <span>{vacancy.employmentType}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CircleDollarSign className="h-4 w-4 text-[#3cdcd1]" />
                  <span>{compensation}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#3c4948]/40 bg-[#17202b] p-7 shadow-[0_16px_30px_rgba(0,0,0,0.14)]">
            <div className="mb-7 flex items-center gap-3">
              <div className="h-7 w-1.5 rounded-full bg-[#3cdcd1]" />
              <h2 className="text-[18px] font-semibold text-white">Overview</h2>
            </div>

            <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
              {content.overview.slice(0, 4).map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[#859491]">
                    <span className="text-[#859491]">{item.icon}</span>
                    <span className="text-[12px] font-bold uppercase tracking-[0.16em]">{item.label}</span>
                  </div>
                  <p className="text-[16px] font-semibold text-[#dae3f2]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#3c4948]/40 bg-[#17202b] p-7 shadow-[0_16px_30px_rgba(0,0,0,0.14)]">
            <h2 className="text-[18px] font-semibold text-[#3cdcd1]">About the Role</h2>
            <div className="mt-5 space-y-5 text-[16px] leading-10 text-[#bacac7]">
              {content.fullDescription.map((item, index) =>
                item.kind === "heading" ? (
                  <h3 key={`about-role-${index}`} className="pt-3 text-[17px] font-semibold text-white">
                    {item.text}
                  </h3>
                ) : item.kind === "bullet" ? (
                  <div key={`about-role-${index}`} className="flex items-start gap-3">
                    <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-[#3cdcd1]" />
                    <p>{item.text}</p>
                  </div>
                ) : item.kind === "divider" ? (
                  <div key={`about-role-${index}`} className="border-t border-[#3c4948]/30 pt-2" />
                ) : (
                  <p key={`about-role-${index}`}>{item.text}</p>
                ),
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <WebsitePublishCard vacancyId={vacancy.id} vacancy={vacancy} />
          <LinkedInPreviewCard vacancyId={vacancy.id} vacancy={vacancy} />
        </aside>
      </div>
    </div>
  );
}

function buildVacancyDetailContent(vacancy: VacancyRecord): VacancyDetailContent {
  const normalizedDescription = normalizeDescription(normalizeWorkspaceDescription(vacancy.description));
  const aboutRole =
    extractParagraphSection(normalizedDescription, ["About Us", "The Role", "About the Role", "Position Overview"], [
      "Key Responsibilities",
      "Requirements & Qualifications",
      "What You'll Bring",
      "Nice to Have",
      "Working Arrangements and Benefits",
      "What We Offer",
    ]) ?? ["No detailed role overview has been added yet."];

  return {
    overview: [
      {
        label: "Job Title",
        value: vacancy.title,
        icon: <BadgeCheck className="h-3.5 w-3.5" />,
      },
      {
        label: "Department",
        value: vacancy.department,
        icon: <BriefcaseBusiness className="h-3.5 w-3.5" />,
      },
      {
        label: "Employment Type",
        value: vacancy.employmentType,
        icon: <Clock3 className="h-3.5 w-3.5" />,
      },
      {
        label: "Location",
        value: vacancy.location,
        icon: <MapPin className="h-3.5 w-3.5" />,
      },
      {
        label: "Compensation",
        value: extractCompensation(vacancy) ?? "Not specified",
        icon: <CircleDollarSign className="h-3.5 w-3.5" />,
      },
      {
        label: "Reports To",
        value: extractOverviewValue(normalizedDescription, "Reports To") ?? "Not specified",
        icon: <UserRound className="h-3.5 w-3.5" />,
      },
    ],
    aboutRole,
    fullDescription: buildFullDescription(normalizedDescription),
  };
}

function normalizeDescription(description: string) {
  return normalizeJobText(description);
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
    .filter(Boolean)
    .filter((item) => !item.startsWith("-"))
    .filter((item) => !item.startsWith("*"))
    .filter((item) => !/^[A-Za-z ]+:\s.+/.test(item))
    .map((item) => cleanInlineJobText(item))
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : null;
}

function extractOverviewValue(description: string, label: string) {
  const regex = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*(.+)`, "i");
  const line = description
    .split("\n")
    .map((item) => item.trim())
    .find((item) => regex.test(item));

  if (!line) {
    return null;
  }

  return cleanInlineJobText(line.replace(regex, "$1").trim());
}

function matchSection(description: string, headings: string[], nextHeadings: string[]): string | null {
  const headingPattern = headings.map(escapeRegExp).join("|");
  const nextPattern = nextHeadings.length > 0 ? nextHeadings.map(escapeRegExp).join("|") : "$";
  const regex = new RegExp(`(?:${headingPattern})\\s*([\\s\\S]*?)(?=\\n(?:${nextPattern})\\b|$)`, "i");
  const match = description.match(regex);
  return match?.[1]?.trim() ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCompensation(vacancy: VacancyRecord) {
  const normalizedDescription = normalizeDescription(normalizeWorkspaceDescription(vacancy.description));
  const compensationLine =
    extractOverviewValue(normalizedDescription, "Compensation") ??
    extractOverviewValue(normalizedDescription, "Salary Indication");

  if (!compensationLine) {
    return null;
  }

  return compensationLine
    .replace(/^\*+\s*&?\s*Benefits:\s*/i, "")
    .replace(/^&?\s*Benefits:\s*/i, "")
    .trim();
}

function buildFullDescription(description: string) {
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^IT Solutions Worldwide$/i.test(line))
    .filter((line) => !/^Job Title:/i.test(line))
    .filter((line) => !/^Location:/i.test(line))
    .filter((line) => !/^Employment Type:/i.test(line))
    .filter((line) => !/^Compensation:/i.test(line))
    .filter((line) => !/^Start Date:/i.test(line))
    .map((line) => {
      if (line === "---" || line === "--") {
        return { kind: "divider" as const, text: "" };
      }

      if (/^(About Us|The Role|About the Role|Key Responsibilities|Requirements & Qualifications|What We Offer)$/i.test(line)) {
        return { kind: "heading" as const, text: cleanInlineJobText(line) };
      }

      if (/^[*-]\s*/.test(line)) {
        return { kind: "bullet" as const, text: cleanInlineJobText(line) };
      }

      return { kind: "paragraph" as const, text: cleanInlineJobText(line) };
    })
    .filter((item) => item.kind === "divider" || item.text.length > 0);
}
