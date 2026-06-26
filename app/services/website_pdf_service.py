from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

from app.config import BASE_DIR, settings
from app.models.vacancy import Vacancy


_HEADING_ALIASES: dict[str, tuple[str, ...]] = {
    "about_us": ("About Us",),
    "position_overview": ("Position Overview", "About the Role", "Role Summary", "The Role"),
    "key_responsibilities": ("Key Responsibilities", "Responsibilities"),
    "skills_requirements": (
        "Skills & Requirements",
        "Skills and Requirements",
        "Qualifications",
        "Requirements & Qualifications",
        "What You'll Bring",
        "What You’ll Bring",
    ),
    "preferred_experience": ("Preferred Experience", "Nice to Have"),
    "what_we_offer": ("What We Offer", "Working Arrangements and Benefits", "Benefits"),
}
_PDF_AUTHOR = "IT Solutions Worldwide"
_PDF_CREATOR = "IT Solutions Worldwide Recruitment Platform"
_PDF_KEYWORDS = "IT Solutions Worldwide, vacancy, recruitment, job description"


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
    location = str(parsed.get("location") or "").strip() or ", ".join(
        part for part in [city, country] if part
    ) or "Location not set"
    employment_type = str(parsed.get("employment_type") or "").strip() or "Full-time"
    work_model = str(parsed.get("work_model") or "").strip()
    work_hours = str(parsed.get("work_hours") or "").strip()
    years_experience = (
        str(parsed.get("years_experience") or "").strip()
        or str(vacancy.experience_level or "").strip()
        or "Not specified"
    )
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
            fontName="Times-Roman",
            fontSize=11.5,
            leading=19,
            textColor=colors.HexColor("#111111"),
            alignment=TA_LEFT,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="WebsiteHeading",
            parent=styles["Heading2"],
            fontName="Times-Bold",
            fontSize=17,
            leading=22,
            textColor=colors.HexColor("#111111"),
            spaceBefore=14,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="WebsiteTitle",
            parent=styles["Heading1"],
            fontName="Times-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#111111"),
            spaceAfter=12,
        )
    )

    story: list[Any] = []
    story.append(Paragraph(_escape(_clean_markdown_text(title)), styles["WebsiteTitle"]))

    for label, value in metadata.items():
        story.append(
            Paragraph(
                f"<b>{_escape(_clean_markdown_text(label))}:</b> {_escape(_clean_markdown_text(value))}",
                styles["WebsiteBody"],
            )
        )

    story.append(Spacer(1, 8))

    for heading, paragraphs in sections:
        story.append(Paragraph(_escape(_clean_markdown_text(heading)), styles["WebsiteHeading"]))
        for paragraph in paragraphs:
            cleaned_paragraph = _clean_markdown_text(paragraph)
            if not cleaned_paragraph:
                continue

            if _is_bullet_line(paragraph):
                bullet_text = _strip_bullet_prefix(cleaned_paragraph)
                if bullet_text:
                    story.append(Paragraph(f"&bull; {_escape(bullet_text)}", styles["WebsiteBody"]))
            else:
                story.append(Paragraph(_escape(cleaned_paragraph), styles["WebsiteBody"]))
        story.append(Spacer(1, 4))

    def apply_pdf_metadata(page_canvas: canvas.Canvas) -> None:
        page_canvas.setTitle(f"{title} | IT Solutions Worldwide")
        page_canvas.setAuthor(_PDF_AUTHOR)
        page_canvas.setCreator(_PDF_CREATOR)
        page_canvas.setSubject(f"Vacancy PDF for {title}")
        page_canvas.setKeywords(_PDF_KEYWORDS)

    def draw_branding(page_canvas: canvas.Canvas, _doc) -> None:
        page_width, page_height = A4
        teal = colors.HexColor("#78b8b6")
        slate = colors.HexColor("#5f8492")
        dark = colors.HexColor("#425766")
        background_asset_path = _ensure_template_background_asset()
        header_asset_path, footer_asset_path = _ensure_template_branding_assets()

        page_canvas.saveState()
        apply_pdf_metadata(page_canvas)
        if background_asset_path is not None and background_asset_path.exists():
            _draw_asset_to_box(
                page_canvas=page_canvas,
                asset_path=background_asset_path,
                x=0,
                y=0,
                width=page_width,
                height=page_height,
            )
        elif header_asset_path is not None and header_asset_path.exists():
            _draw_asset_full_width(
                page_canvas=page_canvas,
                asset_path=header_asset_path,
                page_width=page_width,
                y=page_height - _asset_height_for_width(header_asset_path, page_width),
            )
        else:
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

            page_canvas.setFont("Times-Bold", 18)
            page_canvas.setFillColor(colors.HexColor("#111111"))
            page_canvas.drawString(65 * mm, page_height - 24 * mm, "IT Solutions")
            page_canvas.drawString(65 * mm, page_height - 33 * mm, "Worldwide")

        if background_asset_path is not None and background_asset_path.exists():
            pass
        elif footer_asset_path is not None and footer_asset_path.exists():
            _draw_asset_full_width(
                page_canvas=page_canvas,
                asset_path=footer_asset_path,
                page_width=page_width,
                y=0,
            )
        else:
            page_canvas.setFillColor(teal)
            page_canvas.rect(0, 0, page_width, 11 * mm, fill=1, stroke=0)
            page_canvas.setFillColor(dark)
            page_canvas.rect(0, 11 * mm, page_width, 6 * mm, fill=1, stroke=0)
        page_canvas.restoreState()

    document = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=26 * mm,
        rightMargin=24 * mm,
        topMargin=39 * mm,
        bottomMargin=40 * mm,
        pageCompression=1,
    )
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


def _resolve_template_pdf_path() -> Path | None:
    candidates = [
        BASE_DIR / "Letter Head ITWW HD.pdf",
        BASE_DIR / "ITSW TEMPLATE Posting.pdf",
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _ensure_template_branding_assets() -> tuple[Path | None, Path | None]:
    template_pdf_path = _resolve_template_pdf_path()
    if template_pdf_path is None:
        return None, None

    template_key = _slugify(template_pdf_path.stem) or "itsw-template"
    header_path = settings.website_pdf_output_dir / f"{template_key}-header.jpg"
    footer_path = settings.website_pdf_output_dir / f"{template_key}-footer.jpg"
    if header_path.exists() and footer_path.exists():
        return header_path, footer_path

    try:
        reader = PdfReader(str(template_pdf_path))
        if not reader.pages:
            return None, None

        images = list(reader.pages[0].images)
        if len(images) >= 3:
            header_path.write_bytes(images[0].data)
            footer_path.write_bytes(images[2].data)
            return header_path, footer_path
    except Exception:
        return None, None

    return None, None


def _ensure_template_background_asset() -> Path | None:
    template_pdf_path = _resolve_template_pdf_path()
    if template_pdf_path is None:
        return None

    template_key = _slugify(template_pdf_path.stem) or "itsw-template"
    background_path = settings.website_pdf_output_dir / f"{template_key}-background.jpg"
    if background_path.exists():
        return background_path

    try:
        reader = PdfReader(str(template_pdf_path))
        if not reader.pages:
            return None

        images = list(reader.pages[0].images)
        if images:
            background_path.write_bytes(images[0].data)
            return background_path
    except Exception:
        return None

    return None


def _asset_height_for_width(asset_path: Path, width: float) -> float:
    image = ImageReader(str(asset_path))
    image_width, image_height = image.getSize()
    if not image_width or not image_height:
        return 0
    return width * (float(image_height) / float(image_width))


def _draw_asset_to_box(*, page_canvas, asset_path: Path, x: float, y: float, width: float, height: float) -> None:
    page_canvas.drawImage(
        str(asset_path),
        x,
        y,
        width=width,
        height=height,
        preserveAspectRatio=False,
        mask="auto",
    )


def _draw_asset_full_width(*, page_canvas, asset_path: Path, page_width: float, y: float) -> None:
    asset_height = _asset_height_for_width(asset_path, page_width)
    if asset_height <= 0:
        return
    _draw_asset_to_box(
        page_canvas=page_canvas,
        asset_path=asset_path,
        x=0,
        y=y,
        width=page_width,
        height=asset_height,
    )


def _normalize_description(description: str) -> str:
    normalized = description.replace("\r\n", "\n").replace("[PLAK HIER JE URL]", "")
    normalized = re.sub(r"(?is)(?:^|\n)\s*#*\s*\**\s*how to apply\s*\**\s*:?.*$", "", normalized)
    normalized = re.sub(r"(?is)how to apply[\s\S]*$", "", normalized)
    normalized = re.sub(r"(?m)^\s*#+\s*", "", normalized)
    normalized = normalized.replace("â€™", "’")
    return normalized.strip()


def _extract_sections(description: str) -> dict[str, list[str]]:
    section_values: dict[str, list[str]] = {}
    lines = [line.strip() for line in description.splitlines()]
    current_key: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer, current_key
        if current_key and buffer:
            cleaned = [_clean_markdown_text(item) for item in buffer if item.strip()]
            cleaned = [item for item in cleaned if item]
            if cleaned:
                section_values[current_key] = cleaned
        buffer = []

    heading_lookup = {
        alias.lower(): key
        for key, aliases in _HEADING_ALIASES.items()
        for alias in aliases
    }

    for line in lines:
        normalized = _normalize_heading_candidate(line)
        matched_key = heading_lookup.get(normalized.lower())
        if matched_key:
            flush()
            current_key = matched_key
            continue

        if normalized.lower() in {"how to apply", "apply here"} or normalized.lower().startswith("apply here"):
            flush()
            current_key = None
            continue

        if current_key:
            buffer.append(line)

    flush()
    return section_values


def _fallback_position_overview(vacancy: Vacancy) -> list[str]:
    summary = _clean_markdown_text(str(vacancy.ai_summary or "").strip())
    description = _clean_markdown_text(_remove_apply_section(str(vacancy.description or "").strip()))
    if summary:
        return [summary, description] if description and summary not in description else [summary]
    if description:
        paragraphs = [item.strip() for item in re.split(r"\n{2,}", description) if item.strip()]
        return paragraphs[:3] if paragraphs else [description]
    return ["This role is open for qualified candidates who can contribute strong execution, communication, and professional ownership."]


def _fallback_requirements_list(skills: list[str]) -> list[str]:
    if skills:
        return [f"• {_clean_markdown_text(skill)}" for skill in skills if _clean_markdown_text(skill)]
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
            return [f"• {_clean_markdown_text(item)}" for item in items if _clean_markdown_text(item)]
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
    cleaned = re.sub(r"(?is)(?:^|\n)\s*#*\s*\**\s*how to apply\s*\**\s*:?.*$", "", value)
    cleaned = re.sub(r"How to Apply[\s\S]*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = cleaned.replace("[PLAK HIER JE URL]", "").strip()
    return cleaned


def _normalize_heading_candidate(value: str) -> str:
    return _clean_markdown_text(value).rstrip(":").strip()


def _clean_markdown_text(value: str) -> str:
    cleaned = value.replace("\u2019", "'").replace("â€™", "'").strip()
    cleaned = re.sub(r"^\s*#+\s*", "", cleaned)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = cleaned.replace("**", "")
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def _is_bullet_line(value: str) -> bool:
    return bool(re.match(r"^\s*(?:[-*•]|\u2022)\s+", value))


def _strip_bullet_prefix(value: str) -> str:
    return re.sub(r"^\s*(?:[-*•]|\u2022)\s+", "", value).strip()


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
