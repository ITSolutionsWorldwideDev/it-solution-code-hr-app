from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlmodel import Session

from app.db import get_session
from app.models.vacancy import Vacancy
from app.schemas.application import ApplicationRead
from app.schemas.candidate_match import CandidateMatchRead
from app.schemas.potential_match import VacancyDiscoverySummaryRead
from app.schemas.talent_suggestion import TalentSuggestionRead
from app.schemas.vacancy import VacancyCreate, VacancyRead, VacancyUpdate
from app.services import crud
from app.services.application_workflow_service import generate_shortlist, list_vacancy_applications, rank_applications_for_vacancy
from app.services.candidate_service import get_vacancy_matches
from app.services.talent_discovery_service import suggest_talent_for_vacancy, trigger_talent_discovery_for_vacancy
from app.services.vacancy_service import clear_all_vacancies, delete_vacancy_with_dependencies


router = APIRouter(prefix="/vacancies", tags=["Vacancies"])


class ChangedByPayload(BaseModel):
    changed_by_id: int | None = None


class ClearVacanciesResponse(BaseModel):
    deleted_count: int
    message: str


@router.get("/", response_model=list[VacancyRead], summary="List vacancies", description="Return all vacancies.")
def list_vacancies(session: Session = Depends(get_session)):
    return crud.get_all(session, Vacancy)


@router.get("/{vacancy_id}", response_model=VacancyRead, summary="Get vacancy", description="Return a vacancy by ID.")
def get_vacancy(vacancy_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, Vacancy, vacancy_id)


@router.get(
    "/{vacancy_id}/matches",
    response_model=list[CandidateMatchRead],
    summary="List vacancy matches",
    description="Return candidates ranked best-to-worst for a vacancy.",
)
def list_vacancy_matches(vacancy_id: int, session: Session = Depends(get_session)):
    return get_vacancy_matches(session, vacancy_id)


@router.get(
    "/{vacancy_id}/suggest-talent",
    response_model=list[TalentSuggestionRead],
    summary="Suggest hidden talent for vacancy",
    description="Use vector similarity search plus AI refinement to find the best candidates from the wider database for a vacancy.",
)
def suggest_vacancy_talent_route(vacancy_id: int, session: Session = Depends(get_session)):
    return suggest_talent_for_vacancy(session, vacancy_id)


@router.post(
    "/{vacancy_id}/trigger-discovery",
    response_model=VacancyDiscoverySummaryRead,
    summary="Trigger automated talent discovery",
    description="Scan existing candidates who did not apply to this vacancy, persist hidden-potential scores, and return the high-confidence discoveries for the dashboard.",
)
def trigger_vacancy_discovery_route(vacancy_id: int, session: Session = Depends(get_session)):
    return trigger_talent_discovery_for_vacancy(session, vacancy_id)


@router.get(
    "/{vacancy_id}/applications",
    response_model=list[ApplicationRead],
    summary="List applications for vacancy",
    description="Return all application records for a vacancy in workflow order.",
)
def list_vacancy_applications_route(vacancy_id: int, session: Session = Depends(get_session)):
    return list_vacancy_applications(session, vacancy_id)


@router.post(
    "/{vacancy_id}/rank",
    response_model=list[ApplicationRead],
    summary="Rank vacancy applications",
    description="Apply ranking order to applications for a vacancy.",
)
def rank_vacancy_applications_route(vacancy_id: int, session: Session = Depends(get_session)):
    return rank_applications_for_vacancy(session, vacancy_id)


@router.post(
    "/{vacancy_id}/shortlist/generate",
    response_model=list[ApplicationRead],
    summary="Generate shortlist",
    description="Assign top 5 primary and next 5 reserve shortlist buckets for a vacancy.",
)
def generate_vacancy_shortlist_route(
    vacancy_id: int,
    payload: ChangedByPayload,
    session: Session = Depends(get_session),
):
    return generate_shortlist(session, vacancy_id, payload.changed_by_id)


@router.post("/", response_model=VacancyRead, status_code=status.HTTP_201_CREATED, summary="Create vacancy", description="Create a new vacancy.")
def create_vacancy(payload: VacancyCreate, session: Session = Depends(get_session)):
    return crud.create(session, Vacancy, payload.model_dump())


@router.put("/{vacancy_id}", response_model=VacancyRead, summary="Update vacancy", description="Update an existing vacancy.")
def update_vacancy(vacancy_id: int, payload: VacancyUpdate, session: Session = Depends(get_session)):
    vacancy = crud.get_or_404(session, Vacancy, vacancy_id)
    return crud.update(session, vacancy, payload.model_dump(exclude_unset=True))


@router.delete("/{vacancy_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete vacancy", description="Delete a vacancy by ID.")
def delete_vacancy(vacancy_id: int, session: Session = Depends(get_session)):
    delete_vacancy_with_dependencies(session, vacancy_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/clear-all",
    response_model=ClearVacanciesResponse,
    summary="Temporarily clear all vacancies and related pipeline data",
)
def clear_all_vacancies_route(session: Session = Depends(get_session)):
    deleted_count = clear_all_vacancies(session)
    return ClearVacanciesResponse(
        deleted_count=deleted_count,
        message=f"{deleted_count} vacancies were deleted from the database.",
    )
