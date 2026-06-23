from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path
from hashlib import sha256
from zlib import adler32

from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader

from app.config import settings
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy


EMAIL_REGEX = re.compile(r"[\w.\-+%]+@[\w.\-]+\.[A-Za-z]{2,}")
PHONE_REGEX = re.compile(r"(?:(?:\+|00)\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?[\d\s\-]{6,15}\d")
SKILL_KEYWORDS = {
    "python",
    "fastapi",
    "sqlalchemy",
    "sqlmodel",
    "postgresql",
    "postgres",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "react",
    "next.js",
    "nextjs",
    "javascript",
    "typescript",
    "java",
    "c#",
    "node.js",
    "nodejs",
    "git",
    "rest",
    "api",
    "machine learning",
    "ai",
    "nlp",
}
EDUCATION_KEYWORDS = ("bachelor", "master", "phd", "university", "college", "education")
EXPERIENCE_KEYWORDS = ("experience", "worked", "years", "engineer", "developer", "manager", "analyst")


def sanitize_text(value: str | None) -> str | None:
    if value is None:
        return None

    sanitized = value.replace("\x00", "")
    sanitized = "".join(
        character
        for character in sanitized
        if character == "\n" or character == "\t" or ord(character) >= 32
    )
    return sanitized.strip()


def sanitize_payload(value):
    if isinstance(value, str):
        return sanitize_text(value) or ""
    if isinstance(value, list):
        return [sanitize_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_payload(item) for key, item in value.items()}
    return value


def extract_pdf_content(file_bytes: bytes) -> dict:
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except Exception as exc:  # pragma: no cover - defensive parser guard
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file could not be read as a valid PDF.",
        ) from exc

    text_parts: list[str] = []
    for page in reader.pages:
        text_parts.append(page.extract_text() or "")

    extracted_text = sanitize_text("\n".join(part.strip() for part in text_parts if part.strip()).strip())
    if not extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No readable text was found in the uploaded PDF.",
        )
    return {
        "extracted_text": extracted_text,
        "page_count": len(reader.pages),
        "file_size_bytes": len(file_bytes),
    }


async def extract_pdf_content_from_upload(file: UploadFile) -> dict:
    upload_data = await store_pdf_upload(file)
    file_bytes = upload_data["file_bytes"]

    pdf_content = extract_pdf_content(file_bytes)
    return {
        **pdf_content,
        "filename": upload_data["filename"],
        "original_filename": upload_data["original_filename"],
        "content_type": upload_data["content_type"],
        "file_checksum": upload_data["file_checksum"],
        "file_bytes": file_bytes,
        "resume_path": upload_data["resume_path"],
    }


async def store_pdf_upload(file: UploadFile) -> dict:
    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF uploads are supported.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    storage_dir = settings.resume_upload_dir
    storage_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "resume.pdf").suffix or ".pdf"
    file_checksum = sha256(file_bytes).hexdigest()
    stored_filename = f"{file_checksum}{suffix.lower()}"
    stored_path = storage_dir / stored_filename
    if not stored_path.exists():
        stored_path.write_bytes(file_bytes)

    return {
        "file_bytes": file_bytes,
        "filename": file.filename,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "file_size_bytes": len(file_bytes),
        "file_checksum": file_checksum,
        "resume_path": str(stored_path),
    }


def extract_pdf_content_from_bytes(
    *,
    file_bytes: bytes,
    filename: str | None,
    content_type: str | None,
) -> dict:
    if content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF uploads are supported.",
        )

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    storage_dir = settings.resume_upload_dir
    storage_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(filename or "resume.pdf").suffix or ".pdf"
    file_checksum = sha256(file_bytes).hexdigest()
    stored_filename = f"{file_checksum}{suffix.lower()}"
    stored_path = storage_dir / stored_filename
    if not stored_path.exists():
        stored_path.write_bytes(file_bytes)

    pdf_content = extract_pdf_content(file_bytes)
    return {
        **pdf_content,
        "filename": filename,
        "original_filename": filename,
        "content_type": content_type,
        "file_checksum": file_checksum,
        "file_bytes": file_bytes,
        "resume_path": str(stored_path),
    }


def parse_candidate_text(cv_text: str) -> dict:
    lines = [line.strip() for line in cv_text.splitlines() if line.strip()]
    lower_text = cv_text.lower()

    email_match = EMAIL_REGEX.search(cv_text)
    phone_match = PHONE_REGEX.search(cv_text)

    name = _extract_name(lines, email_match.group(0) if email_match else None)
    skills = _extract_skills(lower_text)
    experience = _extract_section(lines, EXPERIENCE_KEYWORDS)
    education = _extract_section(lines, EDUCATION_KEYWORDS)

    return {
        "name": _normalize_candidate_name(name),
        "email": email_match.group(0) if email_match else _build_fallback_email(cv_text),
        "phone": _normalize_candidate_phone(phone_match.group(0) if phone_match else None),
        "skills": _normalize_skills(skills),
        "experience": experience,
        "education": education,
    }


def generate_ai_summary(parsed_candidate: dict, vacancy: Vacancy | None = None) -> str:
    skills_text = ", ".join(parsed_candidate.get("skills", [])[:6]) or "no clear technical skills yet"
    base_summary = (
        f"{parsed_candidate.get('name') or 'Candidate'} appears to have experience in {skills_text}. "
        f"Experience notes: {parsed_candidate.get('experience') or 'not clearly identified'}. "
        f"Education: {parsed_candidate.get('education') or 'not clearly identified'}."
    )

    if vacancy:
        vacancy_skills = ", ".join(vacancy.required_skills[:5]) or "the vacancy requirements"
        return f"{base_summary} Initial fit was compared against vacancy skills: {vacancy_skills}."
    return base_summary


def calculate_match_score(parsed_candidate: dict, vacancy: Vacancy | None = None) -> float:
    if vacancy is None:
        return 0.0

    candidate_skills = {skill.lower() for skill in parsed_candidate.get("skills", [])}
    vacancy_skills = {skill.lower() for skill in (vacancy.required_skills or [])}
    if not vacancy_skills:
        return 0.0

    overlap = candidate_skills.intersection(vacancy_skills)
    score = (len(overlap) / len(vacancy_skills)) * 100
    return round(score, 2)


def build_parsed_data(pdf_content: dict, parsed_candidate: dict, vacancy: Vacancy | None = None) -> dict:
    return sanitize_payload({
        "source": "pdf_cv_upload",
        "resume_path": pdf_content.get("resume_path"),
        "filename": pdf_content.get("filename"),
        "original_file_name": pdf_content.get("original_filename") or pdf_content.get("filename"),
        "file_checksum": pdf_content.get("file_checksum"),
        "content_type": pdf_content.get("content_type"),
        "page_count": pdf_content.get("page_count"),
        "file_size_bytes": pdf_content.get("file_size_bytes"),
        "extracted_text": pdf_content.get("extracted_text"),
        "openai_response_version": "responses_api_v1",
        "fit_explanation": parsed_candidate.get("fit_explanation"),
        "executive_summary": parsed_candidate.get("ai_summary"),
        "fit_score": parsed_candidate.get("match_score"),
        "pros": parsed_candidate.get("pros", []),
        "cons": parsed_candidate.get("cons", []),
        "experience_years": parsed_candidate.get("experience_years", 0),
        "years_experience": parsed_candidate.get("experience_years", 0),
        "selected_vacancy_id": parsed_candidate.get("selected_vacancy_id"),
        "selected_vacancy_title": parsed_candidate.get("selected_vacancy_title"),
        "matched_skills": parsed_candidate.get("matched_skills", []),
        "parsed_fields": {
            "name": parsed_candidate.get("name"),
            "email": parsed_candidate.get("email"),
            "phone": parsed_candidate.get("phone"),
            "skills": parsed_candidate.get("skills", []),
            "experience": parsed_candidate.get("experience"),
            "education": parsed_candidate.get("education"),
            "experience_years": parsed_candidate.get("experience_years", 0),
        },
        "vacancy_context": {
            "vacancy_id": vacancy.id,
            "required_skills": vacancy.required_skills,
            "title": vacancy.title,
            "experience_level": vacancy.experience_level,
        }
        if vacancy
        else None,
    })


def apply_parsed_data_to_candidate(
    candidate: Candidate,
    parsed_candidate: dict,
    ai_summary: str,
    match_score: float | None,
    parsed_data: dict,
) -> Candidate:
    candidate.name = sanitize_text(parsed_candidate["name"]) or candidate.name
    candidate.email = sanitize_text(parsed_candidate["email"]) or candidate.email
    candidate.phone = sanitize_text(parsed_candidate["phone"])
    candidate.skills = [skill for skill in sanitize_payload(parsed_candidate["skills"]) if isinstance(skill, str) and skill]
    candidate.experience = sanitize_text(parsed_candidate["experience"])
    candidate.education = sanitize_text(parsed_candidate["education"])
    candidate.ai_summary = sanitize_text(ai_summary)
    candidate.match_score = match_score
    candidate.parsed_data = sanitize_payload(parsed_data)
    return candidate


def _extract_name(lines: list[str], email: str | None) -> str:
    for line in lines[:5]:
        cleaned = line.strip(":-| ")
        if not cleaned:
            continue
        if email and email.lower() in cleaned.lower():
            continue
        cleaned = _normalize_candidate_name(cleaned)
        if len(cleaned.split()) in {2, 3} and "@" not in cleaned and len(cleaned) <= 60:
            return cleaned
    return _normalize_candidate_name(lines[0]) if lines else "Unknown Candidate"


def _extract_skills(lower_text: str) -> list[str]:
    matches = []
    for skill in sorted(SKILL_KEYWORDS):
        if skill in lower_text:
            matches.append(skill)
    return matches


def _extract_section(lines: list[str], keywords: tuple[str, ...]) -> str | None:
    matched_lines = []
    for line in lines:
        if any(keyword in line.lower() for keyword in keywords):
            matched_lines.append(line)
    if not matched_lines:
        return None
    return " ".join(matched_lines[:3])


def _build_fallback_email(cv_text: str) -> str:
    checksum = adler32(cv_text.encode("utf-8")) & 0xFFFFFFFF
    return f"candidate-{checksum}@placeholder.local"


def _normalize_candidate_name(value: str | None) -> str | None:
    cleaned = sanitize_text(value)
    if not cleaned:
        return None

    cleaned = re.sub(
        r"^(candidate\s+name|full\s+name|name|contact\s+details?|personal\s+information)\s*[:\-]\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"^(mr|mrs|ms|dr)\.?\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(":-| ")
    return cleaned or None


def _normalize_candidate_phone(value: str | None) -> str | None:
    cleaned = sanitize_text(value)
    if not cleaned:
        return None

    digit_count = sum(character.isdigit() for character in cleaned)
    if digit_count < 8:
        return None

    if re.fullmatch(r"[\d\s\-]+", cleaned) and "+" not in cleaned and digit_count <= 5:
        return None

    return cleaned


def _normalize_skills(skills: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for skill in skills:
        cleaned = sanitize_text(skill.lower()) if skill else None
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)

    return normalized
