from __future__ import annotations

import re
from typing import Iterable

from app.models.vacancy import Vacancy


_SECTION_HEADINGS = (
    "About Us",
    "The Role",
    "About the Role",
    "Position Overview",
    "Key Responsibilities",
    "Skills & Requirements",
    "Requirements & Qualifications",
    "Qualifications",
    "What We Offer",
    "Benefits",
    "How to Apply",
)


def is_premium_job_description(description: str | None) -> bool:
    cleaned = str(description or "").lstrip()
    return cleaned.startswith("### **IT Solutions Worldwide**")


def should_backfill_job_description(description: str | None) -> bool:
    cleaned = str(description or "")
    if not is_premium_job_description(cleaned):
        return True
    return "At IT Solutions Worldwide, we build high-trust teams" in cleaned


def build_premium_job_description(*, vacancy: Vacancy, apply_url: str) -> str:
    description = str(vacancy.description or "").replace("\r\n", "\n").strip()
    parsed_data = vacancy.parsed_data or {}
    sections = _extract_sections(description)

    title = _display_title(vacancy.title)
    department = _display_department(_department_name(vacancy))
    location = _metadata_value(description, "Location") or _location_from_parsed_data(parsed_data) or "Location TBD"
    work_model = str(parsed_data.get("work_model") or "").strip()
    employment_type = _metadata_value(description, "Job Type") or _metadata_value(description, "Employment Type") or str(parsed_data.get("employment_type") or "").strip() or "Full-time"
    compensation = _metadata_value(description, "Salary Indication") or _metadata_value(description, "Compensation") or str(parsed_data.get("budget") or "").strip() or "Compensation discussed during the interview process"
    years_experience = (
        _metadata_value(description, "Experience")
        or _metadata_value(description, "Experience Required")
        or str(parsed_data.get("years_experience") or "").strip()
        or str(vacancy.experience_level or "").strip()
        or "relevant professional experience"
    )

    about_us = _build_about_us(department=department)
    role_summary = _build_role_summary(vacancy=vacancy, sections=sections, department=department)
    responsibilities = _build_responsibilities(vacancy=vacancy, sections=sections)
    requirements = _build_requirements(vacancy=vacancy, years_experience=years_experience, department=department)
    offer_items = _build_offer_items(parsed_data=parsed_data, compensation=compensation, work_model=work_model)

    location_line = location if not work_model else f"{location} ({work_model})"

    return (
        "### **IT Solutions Worldwide**\n"
        f"**Job Title:** {title}\n"
        f"**Location:** {location_line}\n"
        f"**Employment Type:** {employment_type}\n\n"
        "---\n\n"
        "### **About Us**\n"
        f"{about_us}\n\n"
        "### **The Role**\n"
        f"{role_summary}\n\n"
        "### **Key Responsibilities**\n"
        + "\n".join(f"* **{item['title']}:** {item['description']}" for item in responsibilities)
        + "\n\n### **Requirements & Qualifications**\n"
        + "\n".join(f"* **{item['title']}:** {item['description']}" for item in requirements)
        + "\n\n### **What We Offer**\n"
        + "\n".join(f"* **{item['title']}:** {item['description']}" for item in offer_items)
        + "\n\n### **How to Apply**\n"
        + "Interested candidates are invited to submit their application directly via the link below:\n"
        + f"**Apply here:** {apply_url}"
    ).strip()


def _extract_sections(description: str) -> dict[str, list[str]]:
    lines = [line.strip() for line in description.splitlines()]
    sections: dict[str, list[str]] = {}
    current: str | None = None

    for line in lines:
        normalized = _normalize_line(line).rstrip(":")
        matched = next((heading for heading in _SECTION_HEADINGS if normalized.lower() == heading.lower()), None)
        if matched:
            current = matched
            sections.setdefault(current, [])
            continue

        if current and normalized:
            sections[current].append(normalized)

    return sections


def _build_about_us(*, department: str) -> str:
    return (
        "At IT Solutions Worldwide, we build high-trust teams that combine structured execution, clear communication, "
        f"and measurable impact. Within our {department} function, professionals are empowered to improve processes, "
        "support decision-making, and contribute to sustainable operational growth across international projects."
    )


def _build_role_summary(*, vacancy: Vacancy, sections: dict[str, list[str]], department: str) -> str:
    role_lines = (
        sections.get("The Role")
        or sections.get("About the Role")
        or sections.get("Position Overview")
        or []
    )
    if role_lines:
        text = " ".join(role_lines[:2]).strip()
        if text:
            return _cleanup_sentence(text)

    if vacancy.ai_summary:
        return _cleanup_sentence(str(vacancy.ai_summary))

    title = _display_title(vacancy.title)
    return (
        f"As a {title}, you will help drive reliable delivery within our {department} team, translating day-to-day work "
        "into clear business outcomes through ownership, stakeholder alignment, and high professional standards."
    )


def _build_responsibilities(*, vacancy: Vacancy, sections: dict[str, list[str]]) -> list[dict[str, str]]:
    items = _parse_labeled_bullets(sections.get("Key Responsibilities") or [])
    fallback_seeds = _responsibility_fallback_seeds(vacancy)
    default_titles = [
        "Core Delivery",
        "Process Improvement",
        "Documentation & Reporting",
        "Stakeholder Management",
        "Team Collaboration",
        "Operational Excellence",
    ]

    if items:
        built: list[dict[str, str]] = []
        for index, item in enumerate(items[:6]):
            seed = item["description"] if _is_usable_seed(item["description"]) else fallback_seeds[index]
            built.append(_expand_responsibility(title=item["title"], seed=seed, role_title=vacancy.title))
        return built

    built = []
    for index, title in enumerate(default_titles):
        built.append(_expand_responsibility(title=title, seed=fallback_seeds[index], role_title=vacancy.title))
    return built


def _responsibility_fallback_seeds(vacancy: Vacancy) -> list[str]:
    title_key = str(vacancy.title or "").lower()
    if "master data" in title_key:
        return [
            "master data maintenance and cleansing",
            "data quality improvement",
            "ERP and CRM data updates",
            "stakeholder data alignment",
            "cross-team coordination",
            "reporting accuracy and consistency",
        ]
    if "odoo" in title_key:
        return [
            "Odoo module development",
            "business process automation",
            "ERP customization and support",
            "stakeholder requirement alignment",
            "cross-functional delivery",
            "solution quality and stability",
        ]
    if "power bi" in title_key or "data analyst" in title_key:
        return [
            "dashboard and reporting delivery",
            "data analysis and optimization",
            "reporting documentation",
            "stakeholder insight translation",
            "cross-functional collaboration",
            "data quality and consistency",
        ]

    required_skills = [str(skill).strip() for skill in list(vacancy.required_skills or []) if str(skill).strip()]
    base = required_skills[:6]
    while len(base) < 6:
        base.append(_display_title(vacancy.title))
    return base


def _is_usable_seed(value: str) -> bool:
    cleaned = _normalize_line(value)
    lower = cleaned.lower()
    if not cleaned:
        return False
    if lower.startswith(("and ", "the role", "a ", "an ")):
        return False
    if len(cleaned.split()) > 6:
        return False
    return True


def _expand_responsibility(*, title: str, seed: str, role_title: str) -> dict[str, str]:
    subject = _normalize_line(seed) or _display_title(role_title)
    title_key = title.lower()
    if "core" in title_key or "delivery" in title_key:
        description = f"Lead hands-on delivery across {subject}, ensuring stable execution, quality output, and alignment with business requirements."
    elif "process" in title_key:
        description = f"Identify improvement opportunities in {subject} workflows and help optimize delivery speed, accuracy, and consistency."
    elif "documentation" in title_key or "reporting" in title_key:
        description = f"Maintain clear documentation and reporting around {subject} so stakeholders have visibility into progress, risks, and outcomes."
    elif "stakeholder" in title_key or "collaboration" in title_key or "team" in title_key:
        description = f"Work closely with internal stakeholders and teammates to translate needs around {subject} into practical, well-executed solutions."
    elif "quality" in title_key or "operational" in title_key:
        description = f"Support operational excellence by applying strong ownership and attention to detail within {subject} deliverables."
    else:
        description = f"Take ownership of {subject} activities and contribute to dependable results within the broader { _display_title(role_title) } scope."
    return {"title": _normalize_line(title), "description": _cleanup_sentence(description)}


def _build_requirements(*, vacancy: Vacancy, years_experience: str, department: str) -> list[dict[str, str]]:
    title = _display_title(vacancy.title)
    skills = [skill for skill in list(vacancy.required_skills or []) if str(skill).strip()]
    skills_text = ", ".join(skills[:6]) if skills else f"role-relevant tools and methods used within {department.lower()}"
    education_domain = department.rstrip(".")
    normalized_experience = _normalize_experience(years_experience)

    requirements = [
        {
            "title": "Experience",
            "description": f"Minimum of {normalized_experience} in a {title.lower()} or closely related professional role.",
        },
        {
            "title": "Education",
            "description": f"Bachelor's degree or equivalent professional experience relevant to {title}, {education_domain}, or a related discipline.",
        },
        {
            "title": "Technical Skills",
            "description": f"Practical proficiency in {skills_text}.",
        },
        {
            "title": "Soft Skills",
            "description": "Strong communication, ownership, and the ability to work in a structured, quality-focused environment.",
        },
    ]
    return requirements


def _build_offer_items(*, parsed_data: dict, compensation: str, work_model: str) -> list[dict[str, str]]:
    perks = _split_perks(str(parsed_data.get("perks") or ""))
    growth_bits = perks[:2] if perks else ["learning and development support", "a collaborative professional environment"]
    benefits_bits = perks[2:5] if len(perks) > 2 else ["pension plan", "holiday allowance", "performance-based growth opportunities"]

    flexibility_description = (
        f"A structured {work_model.lower()} work setup that supports ownership, clear expectations, and sustainable delivery."
        if work_model
        else "A structured work environment that supports ownership, autonomy, and strong day-to-day collaboration."
    )

    return [
        {
            "title": "Compensation & Benefits",
            "description": f"{compensation}, complemented by {', '.join(benefits_bits[:3])}.",
        },
        {
            "title": "Flexibility & Autonomy",
            "description": flexibility_description,
        },
        {
            "title": "Growth & Well-being",
            "description": f"Access to {', '.join(growth_bits[:2])}, with room for continuous professional development.",
        },
    ]


def _parse_labeled_bullets(lines: Iterable[str]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for line in lines:
        cleaned = _normalize_line(line)
        cleaned = re.sub(r"^[*-]\s*", "", cleaned)
        match = re.match(r"(?P<title>[^:]+):\s*(?P<desc>.+)$", cleaned)
        if not match:
            continue
        items.append(
            {
                "title": _normalize_line(match.group("title")),
                "description": _normalize_line(match.group("desc")),
            }
        )
    return items


def _metadata_value(description: str, label: str) -> str | None:
    match = re.search(rf"(?im)^{re.escape(label)}:\s*(.+)$", description)
    return _normalize_line(match.group(1)) if match else None


def _location_from_parsed_data(parsed_data: dict) -> str | None:
    location = str(parsed_data.get("location") or "").strip()
    if location:
        return location
    city = str(parsed_data.get("city") or "").strip()
    country = str(parsed_data.get("country") or "").strip()
    parts = [part for part in [city, country] if part]
    return ", ".join(parts) if parts else None


def _department_name(vacancy: Vacancy) -> str:
    if getattr(vacancy, "department", None) is not None and getattr(vacancy.department, "name", None):
        return str(vacancy.department.name)
    return "Department"


def _display_department(value: str) -> str:
    cleaned = re.sub(r"\s*\(.*?\)", "", str(value or "")).strip()
    cleaned = cleaned.split("&")[0].strip() if "&" in cleaned else cleaned
    return cleaned or "Department"


def _display_title(value: str) -> str:
    cleaned = _normalize_line(value)
    words = cleaned.split()
    return " ".join(word.capitalize() if word.islower() else word for word in words)


def _normalize_experience(value: str) -> str:
    cleaned = _normalize_line(value)
    cleaned = re.sub(r"(?i)^minimum of\s+", "", cleaned)
    return cleaned or "relevant professional experience"


def _split_perks(value: str) -> list[str]:
    return [item.strip(" -.") for item in re.split(r"[\n,;]+", value) if item.strip(" -.")]


def _normalize_line(value: str) -> str:
    cleaned = str(value or "").strip()
    cleaned = re.sub(r"^\s*#+\s*", "", cleaned)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def _cleanup_sentence(value: str) -> str:
    cleaned = _normalize_line(value)
    cleaned = cleaned.replace("  ", " ").strip()
    if cleaned and cleaned[-1] not in ".!?":
        cleaned += "."
    return cleaned
