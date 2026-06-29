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

const CANDIDATE_FACING_HIDDEN_PATTERNS = [
  /\[\s*plak hier je url\s*\]/i,
  /^plak hier je url$/i,
  /^apply here:?(\s*https?:\/\/\S+)?$/i,
  /^how to apply$/i,
  /^https?:\/\/\S+$/i,
  /^it solutions worldwide$/i,
  /^excellence in execution\.?\s*consistency in results\.?$/i,
  /^to apply for this position, please submit your application and cv via the following link:?$/i,
  /^interested candidates are invited to submit their application directly via the link below:?$/i,
];

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
    .replace(/\[PLAK HIER JE URL\]/gi, "")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢/g, "* ")
    .replace(/[ \t]*#{1,6}[ \t]*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^[ \t]*[*-]{2,}[ \t]*$/gm, "")
    .replace(/^[ \t]*[-][ \t]+/gm, "* ")
    .replace(/^[ \t]*\*[ \t]*\*[ \t]*$/gm, "")
    .replace(/^[ \t]*\*[ \t]*$/gm, "")
    .replace(
      new RegExp(`([.!?])\\s+(${sectionPattern})\\s*(?=[:\\n]|[A-Z]|\\*)`, "gi"),
      (_match, punctuation: string, heading: string) => `${punctuation}\n\n${heading}\n`,
    )
    .replace(
      new RegExp(`(^|\\n)\\s*(${sectionPattern})\\s*:?[ \\t]*(?=\\n|\\*|[A-Z]|$)`, "gi"),
      (_match, prefix: string, heading: string) => `${prefix}\n${heading}\n`,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanInlineJobText(value: string) {
  return value
    .replace(/\[PLAK HIER JE URL\]/gi, "")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢/g, "")
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

export function sanitizeCandidateFacingLines(values: string[]) {
  return values
    .flatMap((value) => splitCompoundLabeledLine(value))
    .map((value) => cleanInlineJobText(value))
    .filter(Boolean)
    .filter((value) => !isSectionTitle(value))
    .filter((value) => !CANDIDATE_FACING_HIDDEN_PATTERNS.some((pattern) => pattern.test(value)));
}

export function isCandidateFacingNoise(value: string) {
  const cleaned = cleanInlineJobText(value);
  return !cleaned || isSectionTitle(cleaned) || CANDIDATE_FACING_HIDDEN_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function splitCompoundLabeledLine(value: string) {
  const cleaned = cleanInlineJobText(value);
  const matches = Array.from(
    cleaned.matchAll(/([A-Z][A-Za-z0-9/&(),'\- ]{2,40}):\s*([^:]+?)(?=(?:\s+[A-Z][A-Za-z0-9/&(),'\- ]{2,40}:)|$)/g),
  )
    .map((match) => `${match[1]}: ${match[2]}`.trim())
    .filter(Boolean);

  return matches.length >= 2 ? matches : [cleaned];
}

function isSectionTitle(value: string) {
  return SECTION_TITLES.some((title) => title.toLowerCase() === value.toLowerCase());
}
