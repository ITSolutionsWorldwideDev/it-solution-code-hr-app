import type { CandidateApiRecord } from "@/lib/recruitment-types";

function parseCandidateDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPlaceholderCandidate(candidate: CandidateApiRecord) {
  const parseStatus =
    typeof candidate.parsed_data?.parse_status === "string"
      ? candidate.parsed_data.parse_status.toLowerCase()
      : null;

  return (
    candidate.name === "Pending Candidate" ||
    candidate.email.endsWith("@placeholder.local") ||
    parseStatus === "pending"
  );
}

export function getCandidateIdentityKey(candidate: CandidateApiRecord) {
  const parsedData = candidate.parsed_data ?? {};
  const checksum =
    typeof parsedData.file_checksum === "string" && parsedData.file_checksum.trim()
      ? parsedData.file_checksum.trim().toLowerCase()
      : null;
  const email = candidate.email.trim().toLowerCase();
  const name = candidate.name.trim().toLowerCase();

  return checksum ?? email ?? name;
}

export function getCandidateSortTime(candidate: CandidateApiRecord) {
  const parsedAt =
    typeof candidate.parsed_data?.parsed_at === "string" ? candidate.parsed_data.parsed_at : null;
  return parseCandidateDate(parsedAt)?.getTime() ?? 0;
}

export function buildVisibleCandidateDatabase(candidates: CandidateApiRecord[]) {
  const deduped = new Map<string, CandidateApiRecord>();

  for (const candidate of candidates) {
    if (isPlaceholderCandidate(candidate)) {
      continue;
    }

    const key = getCandidateIdentityKey(candidate);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      continue;
    }

    if (getCandidateSortTime(candidate) >= getCandidateSortTime(existing)) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()];
}
