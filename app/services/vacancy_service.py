from __future__ import annotations

import logging
from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate_match import CandidateMatch
from app.models.parse_job import ParseJob
from app.models.potential_match import PotentialMatch
from app.models.vacancy import Vacancy
from app.models.website_publication import WebsitePublication
from app.services.application_workflow_service import delete_application_from_pipeline
from app.services.crud import get_or_404

logger = logging.getLogger(__name__)


def delete_vacancy_with_dependencies(session: Session, vacancy_id: int) -> None:
    vacancy = get_or_404(session, Vacancy, vacancy_id)

    # 1. Attempt to remove published vacancy from external website if possible
    try:
        from app.services.website_publish_service import delete_vacancy_from_website
        delete_vacancy_from_website(session, vacancy, public_base_url="")
    except Exception as exc:
        logger.warning("Could not delete vacancy %s from external website: %s", vacancy_id, exc)

    # 2. Always remove any local website publication mappings for this vacancy
    publications = list(
        session.exec(
            select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy_id)
        ).all()
    )
    for pub in publications:
        session.delete(pub)

    # 3. Delete all applications related to this vacancy
    application_ids = list(
        session.exec(
            select(Application.id).where(Application.vacancy_id == vacancy_id)
        ).all()
    )

    for application_id in application_ids:
        delete_application_from_pipeline(session, application_id)

    # 4. Delete parse jobs, matches, and potential matches for this vacancy
    parse_jobs = list(session.exec(select(ParseJob).where(ParseJob.vacancy_id == vacancy_id)).all())
    candidate_matches = list(session.exec(select(CandidateMatch).where(CandidateMatch.vacancy_id == vacancy_id)).all())
    potential_matches = list(session.exec(select(PotentialMatch).where(PotentialMatch.vacancy_id == vacancy_id)).all())

    for parse_job in parse_jobs:
        session.delete(parse_job)

    for match in candidate_matches:
        session.delete(match)

    for match in potential_matches:
        session.delete(match)

    # 5. Delete the vacancy itself
    session.delete(vacancy)
    session.commit()


def clear_all_vacancies(session: Session) -> int:
    vacancy_ids = list(session.exec(select(Vacancy.id)).all())

    for vacancy_id in vacancy_ids:
        delete_vacancy_with_dependencies(session, vacancy_id)

    return len(vacancy_ids)
