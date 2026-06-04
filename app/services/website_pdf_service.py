from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

from app.config import BASE_DIR, settings
from app.models.vacancy import Vacancy


_HEADING_ALIASES: dict[str, tuple[str, ...]] = {
    "about_us": ("About Us",),
    "position_overview": ("Position Overview", "About the Role", "Role Summary"),
    "key_responsibilities": ("Key Responsibilities", "Responsibilities"),
    "skills_requirements": ("Skills & Requirements", "Skills and Requirements", "Qualifications", "What You'll Bring", "What You’ll Bring"),
    "preferred_experience": ("Preferred Experience", "Nice to Have"),
    "what_we_offer": ("What We Offer", "Working Arrangements and Benefits", "Benefits"),
}


def build_website_pdf_for_vacancy(vacancy: Vacancy) -> tuple[Path, str]:
    storage_dir = settings.website_pdf_output_dir
    storage_dir.mkdir(parents=True, exist_ok=True)

    filename = build_website_pdf_filename(vacancy)
    pdf_path = storage_dir / filename

    metadata = _build_metadata(vacancy)
    sections = _build_document_sections(vacancy)
    _render_pdf(
        pdf_path=pdf_path,
        title=vacancy.title,
        metadata=metadata,
        sections=sections,
    )
    return pdf_path, filename


def build_website_pdf_filename(vacancy: Vacancy) -> str:
    return f"{vacancy.id}-{_slugify(vacancy.title)}.pdf"


def build_website_pdf_url(*, filename: str, public_base_url: str) -> str:
    return f"{public_base_url.rstrip('/')}/website-assets/job-pdfs/{filename}"


def _build_metadata(vacancy: Vacancy) -> dict[str, str]:
    parsed = vacancy.parsed_data or {}
    city = str(parsed.get("city") or "").strip()
    country = str(parsed.get("country") or "").strip()
    location = str(parsed.get("location") or "").strip() or ", ".join(part for part in [city, country] if part) or "Location not set"
    employment_type = str(parsed.get("employment_type") or "").strip() or "Full-time"
    work_model = str(parsed.get("work_model") or "").strip()
    work_hours = str(parsed.get("work_hours") or "").strip()
    years_experience = str(parsed.get("years_experience") or "").strip() or str(vacancy.experience_level or "").strip() or "Not specified"
    languages = parsed.get("languages")
    work_authorization = str(parsed.get("work_authorization") or "").strip() or _default_work_authorization(country)

    return {
        "Job Type": _compose_job_type(employment_type, work_model, work_hours),
        "Experience Required": years_experience,
        "Languages Required": _normalize_languages(languages),
        "Work Location": location,
        "Work Authorization": work_authorization,
    }


def _build_document_sections(vacancy: Vacancy) -> list[tuple[str, list[str]]]:
    description = _normalize_description(str(vacancy.description or ""))
    section_map = _extract_sections(description)
    parsed = vacancy.parsed_data or {}

    about_us = section_map.get("about_us") or [_default_about_us()]
    position_overview = section_map.get("position_overview") or _fallback_position_overview(vacancy)
    responsibilities = section_map.get("key_responsibilities") or _fallback_requirements_list(vacancy.required_skills)
    skills_requirements = section_map.get("skills_requirements") or _fallback_requirements_list(vacancy.required_skills)
    preferred_experience = section_map.get("preferred_experience")
    what_we_offer = section_map.get("what_we_offer") or _fallback_perks(parsed)

    sections: list[tuple[str, list[str]]] = [
        ("About Us", about_us),
        ("Position Overview", position_overview),
        ("Key Responsibilities", responsibilities),
        ("Skills & Requirements", skills_requirements),
    ]

    if preferred_experience:
        sections.append(("Preferred Experience", preferred_experience))

    sections.append(("What We Offer", what_we_offer))
    return sections


def _render_pdf(*, pdf_path: Path, title: str, metadata: dict[str, str], sections: list[tuple[str, list[str]]]) -> None:
    try:
        from reportlab.pdfgen import canvas
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ReportLab is not installed on this backend.",
        ) from exc

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="WebsiteBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=18,
            textColor=colors.HexColor("#111111"),
            alignment=TA_LEFT,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="WebsiteHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#111111"),
            spaceBefore=10,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="WebsiteTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#111111"),
            spaceAfter=10,
        )
    )

    document = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=26 * mm,
        rightMargin=26 * mm,
        topMargin=56 * mm,
        bottomMargin=20 * mm,
    )

    story: list[Any] = []
    story.append(Paragraph(_escape(title), styles["WebsiteTitle"]))

    for label, value in metadata.items():
        story.append(
            Paragraph(f"<b>{_escape(label)}:</b> {_escape(value)}", styles["WebsiteBody"])
        )

    story.append(Spacer(1, 8))

    for heading, paragraphs in sections:
        story.append(Paragraph(_escape(heading), styles["WebsiteHeading"]))
        for paragraph in paragraphs:
            if paragraph.strip().startswith("•"):
                story.append(Paragraph(_escape(paragraph), styles["WebsiteBody"]))
            elif paragraph.strip().startswith("-"):
                story.append(Paragraph(f"• {_escape(paragraph.strip().lstrip('- ').strip())}", styles["WebsiteBody"]))
            else:
                story.append(Paragraph(_escape(paragraph), styles["WebsiteBody"]))
        story.append(Spacer(1, 4))

    def draw_branding(page_canvas: canvas.Canvas, _doc) -> None:
        page_width, page_height = A4
        teal = colors.HexColor("#78b8b6")
        slate = colors.HexColor("#5f8492")
        dark = colors.HexColor("#425766")

        page_canvas.saveState()
        page_canvas.setFillColor(teal)
        page_canvas.rect(125 * mm, page_height - 36 * mm, 82 * mm, 24 * mm, fill=1, stroke=0)
        page_canvas.setFillColor(dark)
        page_canvas.rect(172 * mm, page_height - 36 * mm, 38 * mm, 24 * mm, fill=1, stroke=0)
        page_canvas.setFillColor(slate)
        page_canvas.rect(26 * mm, page_height - 48 * mm, 184 * mm, 5 * mm, fill=1, stroke=0)

        logo_path = _resolve_logo_path()
        if logo_path is not None and logo_path.exists():
            logo = Image(str(logo_path), width=34 * mm, height=34 * mm)
            logo.drawOn(page_canvas, 32 * mm, page_height - 42 * mm)

        page_canvas.setFont("Helvetica-Bold", 18)
        page_canvas.setFillColor(colors.HexColor("#111111"))
        page_canvas.drawString(65 * mm, page_height - 24 * mm, "IT Solutions")
        page_canvas.drawString(65 * mm, page_height - 33 * mm, "Worldwide")
        page_canvas.restoreState()

    document.build(story, onFirstPage=draw_branding, onLaterPages=draw_branding)


def _resolve_logo_path() -> Path | None:
    candidates = [
        BASE_DIR / "frontend" / "public" / "it_solutions_worldwide_logo_transparent.png",
        BASE_DIR / "frontend" / "public" / "ITSW Neon.png",
        BASE_DIR / "ITSW Neon.png",
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _normalize_description(description: str) -> str:
    return (
        description.replace("\r\n", "\n")
        .replace("How to Apply", "\nHow to Apply\n")
        .replace("[PLAK HIER JE URL]", "")
        .strip()
    )


def _extract_sections(description: str) -> dict[str, list[str]]:
    section_values: dict[str, list[str]] = {}
    lines = [line.strip() for line in description.splitlines()]
    current_key: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer, current_key
        if current_key and buffer:
            cleaned = [item.strip() for item in buffer if item.strip()]
            if cleaned:
                section_values[current_key] = cleaned
        buffer = []

    heading_lookup = {
        alias.lower(): key
        for key, aliases in _HEADING_ALIASES.items()
        for alias in aliases
    }

    for line in lines:
        normalized = line.strip().rstrip(":")
        matched_key = heading_lookup.get(normalized.lower())
        if matched_key:
            flush()
            current_key = matched_key
            continue

        if normalized.lower() == "apply here":
            flush()
            current_key = None
            continue

        if current_key:
            buffer.append(line)

    flush()
    return section_values


def _fallback_position_overview(vacancy: Vacancy) -> list[str]:
    summary = str(vacancy.ai_summary or "").strip()
    description = _remove_apply_section(str(vacancy.description or "").strip())
    if summary:
        return [summary, description] if description and summary not in description else [summary]
    if description:
        paragraphs = [item.strip() for item in re.split(r"\n{2,}", description) if item.strip()]
        return paragraphs[:3] if paragraphs else [description]
    return ["This role is open for qualified candidates who can contribute strong execution, communication, and professional ownership."]


def _fallback_requirements_list(skills: list[str]) -> list[str]:
    if skills:
        return [f"• {skill}" for skill in skills]
    return [
        "• Strong professional communication and teamwork.",
        "• Relevant role-specific expertise and ownership.",
        "• Ability to work in a structured, quality-focused environment.",
    ]


def _fallback_perks(parsed_data: dict[str, Any]) -> list[str]:
    perks = str(parsed_data.get("perks") or "").strip()
    if perks:
        items = [item.strip(" -") for item in re.split(r"[\n,;]+", perks) if item.strip(" -")]
        if items:
            return [f"• {item}" for item in items]
    return [
        "• Competitive compensation package based on experience.",
        "• Learning and development opportunities.",
        "• Flexible work arrangements where relevant.",
        "• A collaborative and professional working environment.",
    ]


def _default_about_us() -> str:
    return (
        "At IT Solutions Worldwide BV, we provide specialized recruitment and technical staffing "
        "solutions for international business and IT projects. We work with experienced professionals "
        "across data management, ERP, supply chain, procurement, and operations environments."
    )


def _normalize_languages(value: Any) -> str:
    if isinstance(value, list):
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        if cleaned:
            return " & ".join(cleaned)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return "English"


def _default_work_authorization(country: str) -> str:
    if country:
        return f"Must be authorized to work in {country}"
    return "Must be authorized to work in the relevant location"


def _compose_job_type(employment_type: str, work_model: str, work_hours: str) -> str:
    parts = [employment_type]
    if work_model:
        parts.append(work_model)
    joined = "/".join(parts)
    if work_hours:
        return f"{joined} ({work_hours})"
    return joined


def _slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-").lower()
    return slug or "vacancy"


def _remove_apply_section(value: str) -> str:
    cleaned = re.sub(r"How to Apply[\s\S]*$", "", value, flags=re.IGNORECASE).strip()
    cleaned = cleaned.replace("[PLAK HIER JE URL]", "").strip()
    return cleaned


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
