from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models.vacancy import Vacancy
from app.models.website_publication import WebsitePublication
from app.schemas.website_job import WebsiteJobRead
from app.services import crud
from app.services.public_job_text_service import sanitize_public_job_description


router = APIRouter(prefix="/website/jobs", tags=["Website Jobs"])


def _build_website_job(*, vacancy: Vacancy, publication: WebsitePublication) -> WebsiteJobRead:
    parsed_data = vacancy.parsed_data or {}

    return WebsiteJobRead(
        vacancy_id=vacancy.id,
        job_info_id=publication.job_info_id,
        title=vacancy.title,
        description=sanitize_public_job_description(vacancy.description),
        required_skills=list(vacancy.required_skills or []),
        experience_level=vacancy.experience_level,
        department_id=vacancy.department_id,
        hiring_request_id=vacancy.hiring_request_id,
        ai_summary=vacancy.ai_summary,
        match_score=vacancy.match_score,
        parsed_data=parsed_data,
        created_at=vacancy.created_at,
        published_at=publication.published_at,
        location=str(parsed_data.get("location") or "").strip() or None,
        employment_type=str(parsed_data.get("employment_type") or "").strip() or None,
        pdf_url=str(parsed_data.get("pdf_url") or "").strip() or None,
    )


@router.get("/", response_model=list[WebsiteJobRead], summary="List published website jobs")
def list_website_jobs(session: Session = Depends(get_session)):
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
    for publication in publications:
        vacancy = vacancy_by_id.get(publication.vacancy_id)
        if vacancy is None:
            continue
        items.append(_build_website_job(vacancy=vacancy, publication=publication))

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
