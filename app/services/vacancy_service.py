from __future__ import annotations

from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate_match import CandidateMatch
from app.models.parse_job import ParseJob
from app.models.potential_match import PotentialMatch
from app.models.vacancy import Vacancy
from app.services.openai_service import inject_job_description_apply_url
from app.services.application_workflow_service import delete_application_from_pipeline
from app.services.crud import get_or_404
from app.services.settings_service import get_general_settings_runtime


def build_vacancy_apply_url(*, session: Session, vacancy: Vacancy) -> str:
    general_settings = get_general_settings_runtime(session=session)
    return f"{general_settings.public_apply_base_url.rstrip('/')}/{vacancy.id}"


def ensure_vacancy_apply_url(*, session: Session, vacancy: Vacancy, commit: bool = True) -> Vacancy:
    apply_url = build_vacancy_apply_url(session=session, vacancy=vacancy)
    updated_description = inject_job_description_apply_url(
        description=vacancy.description,
        apply_url=apply_url,
    )

    if updated_description == vacancy.description:
        return vacancy

    vacancy.description = updated_description
    session.add(vacancy)
    if commit:
        session.commit()
        session.refresh(vacancy)
    return vacancy


def backfill_vacancy_apply_urls(session: Session) -> int:
    vacancies = list(session.exec(select(Vacancy)).all())
    updated_count = 0

    for vacancy in vacancies:
        original_description = vacancy.description
        ensure_vacancy_apply_url(session=session, vacancy=vacancy, commit=False)
        if vacancy.description != original_description:
            updated_count += 1

    if updated_count:
        session.commit()

    return updated_count


def delete_vacancy_with_dependencies(session: Session, vacancy_id: int) -> None:
    vacancy = get_or_404(session, Vacancy, vacancy_id)

    application_ids = list(
        session.exec(
            select(Application.id).where(Application.vacancy_id == vacancy_id)
        ).all()
    )

    for application_id in application_ids:
        delete_application_from_pipeline(session, application_id)

    parse_jobs = list(session.exec(select(ParseJob).where(ParseJob.vacancy_id == vacancy_id)).all())
    candidate_matches = list(session.exec(select(CandidateMatch).where(CandidateMatch.vacancy_id == vacancy_id)).all())
    potential_matches = list(session.exec(select(PotentialMatch).where(PotentialMatch.vacancy_id == vacancy_id)).all())

    for parse_job in parse_jobs:
        session.delete(parse_job)

    for match in candidate_matches:
        session.delete(match)

    for match in potential_matches:
        session.delete(match)

    session.delete(vacancy)
    session.commit()


def clear_all_vacancies(session: Session) -> int:
    vacancy_ids = list(session.exec(select(Vacancy.id)).all())

    for vacancy_id in vacancy_ids:
        delete_vacancy_with_dependencies(session, vacancy_id)

    return len(vacancy_ids)
