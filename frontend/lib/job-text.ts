const SECTION_TITLES = [
  "Short Summary",
  "Overview",
  "About Us",
  "The Role",
  "About the Role",
  "Position Overview",
  "Key Responsibilities",
  "Requirements & Qualifications",
  "What You'll Bring",
  "Nice to Have",
  "Working Arrangements and Benefits",
  "What We Offer",
  "How to Apply",
] as const;

export type ParsedJobSections = {
  preamble: string[];
  sections: Partial<Record<(typeof SECTION_TITLES)[number], string[]>>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeJobText(description: string) {
  const sectionPattern = SECTION_TITLES.map(escapeRegExp).join("|");

  return description
    .replace(/\r\n/g, "\n")
    .replace(/Ã¢â‚¬Â¢|â€¢/g, "* ")
    .replace(/[ \t]*#{1,6}[ \t]*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^[ \t]*[*-]{2,}[ \t]*$/gm, "")
    .replace(/^[ \t]*[-][ \t]+/gm, "* ")
    .replace(/^[ \t]*\*[ \t]*\*[ \t]*$/gm, "")
    .replace(/^[ \t]*\*[ \t]*$/gm, "")
    .replace(
      new RegExp(`(^|\\n)\\s*(${sectionPattern})\\s*(?=\\n|$)`, "gi"),
      (_match, prefix: string, heading: string) => `${prefix}\n${heading}\n`,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanInlineJobText(value: string) {
  return value
    .replace(/Ã¢â‚¬Â¢|â€¢/g, "")
    .replace(/[ \t]*#{1,6}[ \t]*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^[ \t]*[*-]+\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseJobSections(description: string): ParsedJobSections {
  const normalized = normalizeJobText(description);
  const sections: ParsedJobSections["sections"] = {};
  const preamble: string[] = [];
  let currentHeading: (typeof SECTION_TITLES)[number] | null = null;

  for (const rawLine of normalized.split("\n")) {
    const line = cleanInlineJobText(rawLine);
    if (!line) {
      continue;
    }

    const heading = SECTION_TITLES.find((title) => title.toLowerCase() === line.toLowerCase()) ?? null;
    if (heading) {
      currentHeading = heading;
      sections[currentHeading] ??= [];
      continue;
    }

    if (currentHeading) {
      sections[currentHeading] ??= [];
      sections[currentHeading]?.push(line);
      continue;
    }

    preamble.push(line);
  }

  return { preamble, sections };
}
