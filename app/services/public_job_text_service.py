from __future__ import annotations

import re


_APPLY_SECTION_PATTERN = re.compile(r"(?is)(?:^|\n)\s*#*\s*\**\s*how to apply\s*\**\s*:?.*$")
_TAIL_APPLY_PATTERN = re.compile(r"(?is)how to apply[\s\S]*$")
_NOISE_LINE_PATTERNS = (
    re.compile(r"^\s*\[?\s*plak hier je url\s*\]?\s*$", re.IGNORECASE),
    re.compile(r"^\s*apply here:?\s*(https?://\S+)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*https?://\S+\s*$", re.IGNORECASE),
    re.compile(
        r"^\s*to apply for this position, please submit your application and cv via the following link:?\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*interested candidates are invited to submit their application directly via the link below:?\s*$",
        re.IGNORECASE,
    ),
)


def sanitize_public_job_description(value: str | None) -> str:
    text = str(value or "").replace("\r\n", "\n")
    text = text.replace("[PLAK HIER JE URL]", "")
    text = _APPLY_SECTION_PATTERN.sub("", text)
    text = _TAIL_APPLY_PATTERN.sub("", text)
    text = text.replace("\u2019", "'").replace("â€™", "'")

    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        line = _clean_markdown(raw_line)
        if not line:
            if cleaned_lines and cleaned_lines[-1]:
                cleaned_lines.append("")
            continue

        if any(pattern.match(line) for pattern in _NOISE_LINE_PATTERNS):
            continue

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def _clean_markdown(value: str) -> str:
    cleaned = value.strip()
    cleaned = re.sub(r"^\s*#+\s*", "", cleaned)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()
