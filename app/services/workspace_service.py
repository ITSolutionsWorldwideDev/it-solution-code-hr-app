from __future__ import annotations

from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy
from app.schemas.workspace import (
    PipelineBoardResponseRead,
    WorkspaceApplicationRead,
    WorkspaceCandidateRead,
    WorkspaceVacancyRead,
)

_ALLOWED_CANDIDATE_PARSED_KEYS = {
    "cons",
    "education",
    "education_summary",
    "email",
    "executive_summary",
    "experience",
    "experience_summary",
    "experience_years",
    "file_checksum",
    "file_path",
    "fit_explanation",
    "fit_score",
    "location",
    "match_status",
    "name",
    "notice_period",
    "parse_status",
    "parsed_at",
    "phone",
    "pros",
    "resume_path",
    "selected_vacancy_id",
    "selected_vacancy_title",
    "skills",
    "work_authorization",
    "years_experience",
}
_ALLOWED_APPLICATION_PARSED_KEYS = {
    "fit_explanation",
    "fit_score",
    "intake_metadata",
    "match_status",
    "parse_status",
    "selected_vacancy_id",
    "selected_vacancy_title",
}
_ALLOWED_INTAKE_METADATA_KEYS = {
    "candidate_email",
    "location",
    "notice_period",
    "work_authorization",
}


def _compact_parsed_data(parsed_data: object, *, allowed_keys: set[str]) -> dict:
    if not isinstance(parsed_data, dict):
        return {}

    compact = {key: parsed_data[key] for key in allowed_keys if key in parsed_data}
    intake_metadata = parsed_data.get("intake_metadata")
    if isinstance(intake_metadata, dict):
        filtered_intake = {
            key: intake_metadata[key]
            for key in _ALLOWED_INTAKE_METADATA_KEYS
            if key in intake_metadata
        }
        if filtered_intake:
            compact["intake_metadata"] = filtered_intake
    return compact


def list_workspace_candidates(session: Session) -> list[WorkspaceCandidateRead]:
    rows = session.exec(
        select(
            Candidate.id,
            Candidate.name,
            Candidate.email,
            Candidate.phone,
            Candidate.skills,
            Candidate.experience,
            Candidate.education,
            Candidate.ai_summary,
            Candidate.match_score,
            Candidate.parsed_data,
        )
    ).all()

    return [
        WorkspaceCandidateRead(
            id=row[0],
            name=row[1],
            email=row[2],
            phone=row[3],
            skills=row[4] or [],
            experience=row[5],
            education=row[6],
            ai_summary=row[7],
            match_score=row[8],
            parsed_data=_compact_parsed_data(row[9], allowed_keys=_ALLOWED_CANDIDATE_PARSED_KEYS),
        )
        for row in rows
    ]


def list_workspace_applications(session: Session) -> list[WorkspaceApplicationRead]:
    rows = session.exec(
        select(
            Application.id,
            Application.candidate_id,
            Application.vacancy_id,
            Application.notes,
            Application.ai_summary,
            Application.match_score,
            Application.parsed_data,
            Application.stage,
            Application.current_owner_role,
            Application.ranking_score,
            Application.ranking_position,
            Application.shortlist_bucket,
            Application.invite_selected,
            Application.rejection_reason,
            Application.selected_for_offer,
            Application.invite_sent_at,
            Application.invite_sent_by_id,
            Application.hr_interview_at,
            Application.technical_interview_at,
            Application.management_interview_at,
            Application.offer_sent_at,
            Application.offer_accepted_at,
            Application.offer_declined_at,
            Application.created_at,
        )
    ).all()

    return [
        WorkspaceApplicationRead(
            id=row[0],
            candidate_id=row[1],
            vacancy_id=row[2],
            notes=row[3],
            ai_summary=row[4],
            match_score=row[5],
            parsed_data=_compact_parsed_data(row[6], allowed_keys=_ALLOWED_APPLICATION_PARSED_KEYS),
            stage=row[7],
            current_owner_role=row[8],
            ranking_score=row[9],
            ranking_position=row[10],
            shortlist_bucket=row[11],
            invite_selected=row[12],
            rejection_reason=row[13],
            selected_for_offer=row[14],
            invite_sent_at=row[15],
            invite_sent_by_id=row[16],
            hr_interview_at=row[17],
            technical_interview_at=row[18],
            management_interview_at=row[19],
            offer_sent_at=row[20],
            offer_accepted_at=row[21],
            offer_declined_at=row[22],
            created_at=row[23],
        )
        for row in rows
    ]


def list_workspace_vacancies(session: Session) -> list[WorkspaceVacancyRead]:
    rows = session.exec(
        select(
            Vacancy.id,
            Vacancy.title,
            Vacancy.status,
            Vacancy.created_at,
        )
    ).all()

    return [
        WorkspaceVacancyRead(
            id=row[0],
            title=row[1],
            status=row[2],
            created_at=row[3],
        )
        for row in rows
    ]


def get_pipeline_board_payload(session: Session) -> PipelineBoardResponseRead:
    return PipelineBoardResponseRead(
        applications=list_workspace_applications(session),
        candidates=list_workspace_candidates(session),
        vacancies=list_workspace_vacancies(session),
    )
