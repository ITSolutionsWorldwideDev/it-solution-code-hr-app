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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeJobText(description: string) {
  const sectionPattern = SECTION_TITLES.map(escapeRegExp).join("|");

  return description
    .replace(/\r\n/g, "\n")
    .replace(/â€¢|•/g, "* ")
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
    .replace(/â€¢|•/g, "")
    .replace(/[ \t]*#{1,6}[ \t]*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^[ \t]*[*-]+\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
