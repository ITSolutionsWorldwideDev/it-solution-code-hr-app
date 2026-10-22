from __future__ import annotations

import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.db import get_session
from app.models.vacancy import Vacancy
from app.models.website_publication import WebsitePublication
from app.schemas.website_job import WebsiteJobRead
from app.services import crud


router = APIRouter(prefix="/website/jobs", tags=["Website Jobs"])


def _clean_bullets(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Remove markdown/bullet markers
        item = re.sub(r"^[-*•\d+.)]+\s*", "", line).strip()
        if item and len(item) > 2:
            cleaned.append(item)
    return cleaned


def _parse_job_sections(
    description: str,
    parsed_data: dict,
    required_skills: list[str],
) -> tuple[str, list[str], list[str]]:
    """
    Parses unstructured or structured job description into:
    (role_overview, responsibilities, requirements)
    Guarantees clean sections without headings leaking into paragraphs.
    """
    # 1. If explicit structured data was stored in parsed_data
    if parsed_data.get("responsibilities") and isinstance(parsed_data["responsibilities"], list):
        resps = [str(r).strip() for r in parsed_data["responsibilities"] if str(r).strip()]
        reqs = (
            [str(r).strip() for r in parsed_data.get("requirements", []) if str(r).strip()]
            or list(required_skills or [])
        )
        overview = str(parsed_data.get("role_overview") or "").strip()
        if not overview:
            overview = description.split("\n\n")[0].strip() if description else ""
        return overview, resps, reqs

    if not description:
        return "", [], list(required_skills or [])

    # 2. Parse text blocks by standard section heading patterns
    lines = description.split("\n")
    current_section = "overview"
    overview_lines: list[str] = []
    resp_lines: list[str] = []
    req_lines: list[str] = []

    resp_headers = {
        "responsibilities", "key responsibilities", "what you will do",
        "duties", "tasks", "core responsibilities", "your role", "role overview"
    }
    req_headers = {
        "requirements", "skills & requirements", "qualifications",
        "what we are looking for", "skills", "what you bring", "must have", "candidate profile"
    }
    ignore_headers = {
        "what we offer", "benefits", "about us", "company overview", "perks", "about the role"
    }

    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped:
            if current_section == "overview" and overview_lines:
                overview_lines.append("")
            continue

        clean_header = re.sub(r"^[#*_\s]+|[#*_\s:]+$", "", stripped).lower()
        if clean_header in resp_headers:
            current_section = "responsibilities"
            continue
        elif clean_header in req_headers:
            current_section = "requirements"
            continue
        elif clean_header in ignore_headers:
            current_section = "other"
            continue

        if current_section == "overview":
            overview_lines.append(stripped)
        elif current_section == "responsibilities":
            resp_lines.append(stripped)
        elif current_section == "requirements":
            req_lines.append(stripped)

    clean_resps = _clean_bullets(resp_lines)
    clean_reqs = _clean_bullets(req_lines) or list(required_skills or [])
    clean_overview = "\n".join(overview_lines).strip()

    # Fallback: if no section headers matched, extract all bullet points
    if not clean_resps:
        bullet_lines = [l for l in lines if re.match(r"^\s*[-*•]", l)]
        clean_resps = _clean_bullets(bullet_lines)
        if clean_resps:
            non_bullet = [l for l in lines if not re.match(r"^\s*[-*•]", l)]
            clean_overview = "\n".join(non_bullet).strip()

    if not clean_overview and description:
        clean_overview = description.split("\n\n")[0].strip()

    return clean_overview, clean_resps, clean_reqs


def _build_website_job(*, vacancy: Vacancy, publication: WebsitePublication) -> WebsiteJobRead:
    parsed_data = vacancy.parsed_data or {}
    target_portal = str(parsed_data.get("target_portal") or "both").strip().lower()

    overview, resps, reqs = _parse_job_sections(
        description=vacancy.description,
        parsed_data=parsed_data,
        required_skills=list(vacancy.required_skills or []),
    )

    return WebsiteJobRead(
        vacancy_id=vacancy.id,
        job_info_id=publication.job_info_id,
        title=vacancy.title,
        description=vacancy.description,
        required_skills=list(vacancy.required_skills or []),
        experience_level=vacancy.experience_level,
        department_id=vacancy.department_id,
        hiring_request_id=vacancy.hiring_request_id,
        ai_summary=vacancy.ai_summary or (overview[:300] if overview else None),
        match_score=vacancy.match_score,
        parsed_data=parsed_data,
        created_at=vacancy.created_at,
        published_at=publication.published_at,
        location=str(parsed_data.get("location") or "").strip() or None,
        employment_type=str(parsed_data.get("employment_type") or "").strip() or None,
        pdf_url=str(parsed_data.get("pdf_url") or "").strip() or None,
        target_portal=target_portal,
        role_overview=overview,
        responsibilities=resps,
        requirements=reqs,
    )


@router.get("/", response_model=list[WebsiteJobRead], summary="List published website jobs")
def list_website_jobs(
    portal: str | None = Query(None, description="Filter by target portal: 'itww', 'staff_outsourcing', or 'both'"),
    session: Session = Depends(get_session),
):
    publications = list(
        session.exec(
            select(WebsitePublication).order_by(WebsitePublication.published_at.desc())
        ).all()
    )

    if not publications:
        return []

    vacancy_ids = [publication.vacancy_id for publication in publications]
    vacancies = list(
        session.exec(select(Vacancy).where(Vacancy.id.in_(vacancy_ids))).all()
    )
    vacancy_by_id = {vacancy.id: vacancy for vacancy in vacancies}

    items: list[WebsiteJobRead] = []
    normalized_portal = portal.strip().lower() if portal else None

    for publication in publications:
        vacancy = vacancy_by_id.get(publication.vacancy_id)
        if vacancy is None:
            continue
        job = _build_website_job(vacancy=vacancy, publication=publication)

        # Filter by requested portal
        if normalized_portal:
            job_portal = (job.target_portal or "both").lower()
            if job_portal not in ("both", normalized_portal):
                continue

        items.append(job)

    return items


@router.get("/{vacancy_id}", response_model=WebsiteJobRead, summary="Get one published website job")
def get_website_job(vacancy_id: int, session: Session = Depends(get_session)):
    publication = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy_id)
    ).first()
    if publication is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published website job not found.",
        )

    vacancy = crud.get_or_404(session, Vacancy, vacancy_id)
    return _build_website_job(vacancy=vacancy, publication=publication)
