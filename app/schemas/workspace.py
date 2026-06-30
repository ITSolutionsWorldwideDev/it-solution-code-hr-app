from __future__ import annotations

from datetime import datetime

from app.models.enums import ApplicationStage, ShortlistBucket, UserRole, VacancyStatus
from app.schemas.common import BaseSchema
from app.schemas.dashboard import DashboardActivityRead, HRDashboardSummaryRead


class WorkspaceCandidateRead(BaseSchema):
    id: int
    name: str
    email: str
    phone: str | None = None
    skills: list[str]
    experience: str | None = None
    education: str | None = None
    ai_summary: str | None = None
    match_score: float | None = None
    parsed_data: dict


class WorkspaceApplicationRead(BaseSchema):
    id: int
    candidate_id: int
    vacancy_id: int
    notes: str | None = None
    ai_summary: str | None = None
    match_score: float | None = None
    parsed_data: dict
    stage: ApplicationStage
    current_owner_role: UserRole | None = None
    ranking_score: float | None = None
    ranking_position: int | None = None
    shortlist_bucket: ShortlistBucket
    invite_selected: bool
    rejection_reason: str | None = None
    selected_for_offer: bool
    invite_sent_at: datetime | None = None
    invite_sent_by_id: int | None = None
    hr_interview_at: datetime | None = None
    technical_interview_at: datetime | None = None
    management_interview_at: datetime | None = None
    offer_sent_at: datetime | None = None
    offer_accepted_at: datetime | None = None
    offer_declined_at: datetime | None = None
    created_at: datetime


class WorkspaceVacancyRead(BaseSchema):
    id: int
    title: str
    status: VacancyStatus
    created_at: datetime


class PipelineBoardResponseRead(BaseSchema):
    applications: list[WorkspaceApplicationRead]
    candidates: list[WorkspaceCandidateRead]
    vacancies: list[WorkspaceVacancyRead]


class HRWorkspaceResponseRead(BaseSchema):
    summary: HRDashboardSummaryRead
    activity: list[DashboardActivityRead]
    applications: list[WorkspaceApplicationRead]
    candidates: list[WorkspaceCandidateRead]
    vacancies: list[WorkspaceVacancyRead]
