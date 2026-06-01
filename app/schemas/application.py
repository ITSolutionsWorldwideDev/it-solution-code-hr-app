from datetime import datetime
from typing import Optional

from pydantic import Field

from app.models.enums import ApplicationStage, EmailType, ShortlistBucket, UserRole
from app.schemas.application_email_event import ApplicationEmailEventRead
from app.schemas.application_interview import ApplicationInterviewRead
from app.schemas.application_stage_event import ApplicationStageEventRead
from app.schemas.common import BaseSchema


class ApplicationBase(BaseSchema):
    candidate_id: int
    vacancy_id: int
    notes: Optional[str] = None
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: dict = Field(default_factory=dict)
    stage: ApplicationStage = ApplicationStage.PARSED
    current_owner_role: Optional[UserRole] = None
    ranking_score: Optional[float] = None
    ranking_position: Optional[int] = None
    shortlist_bucket: ShortlistBucket = ShortlistBucket.NONE
    invite_selected: bool = False
    rejection_reason: Optional[str] = None
    selected_for_offer: bool = False


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseSchema):
    candidate_id: Optional[int] = None
    vacancy_id: Optional[int] = None
    notes: Optional[str] = None
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: Optional[dict] = None
    stage: Optional[ApplicationStage] = None
    current_owner_role: Optional[UserRole] = None
    ranking_score: Optional[float] = None
    ranking_position: Optional[int] = None
    shortlist_bucket: Optional[ShortlistBucket] = None
    invite_selected: Optional[bool] = None
    rejection_reason: Optional[str] = None
    selected_for_offer: Optional[bool] = None


class ApplicationRead(ApplicationBase):
    id: int
    invite_sent_at: Optional[datetime] = None
    invite_sent_by_id: Optional[int] = None
    hr_interview_at: Optional[datetime] = None
    technical_interview_at: Optional[datetime] = None
    management_interview_at: Optional[datetime] = None
    offer_sent_at: Optional[datetime] = None
    offer_accepted_at: Optional[datetime] = None
    offer_declined_at: Optional[datetime] = None
    created_at: datetime


class ApplicationShortlistUpdate(BaseSchema):
    shortlist_bucket: ShortlistBucket
    changed_by_id: int


class ApplicationTalentPoolShortlistCreate(BaseSchema):
    candidate_id: int
    changed_by_id: int
    shortlist_bucket: ShortlistBucket = ShortlistBucket.RESERVE
    potential_score: Optional[float] = None
    reason: Optional[str] = None


class ApplicationInviteSelectionUpdate(BaseSchema):
    invite_selected: bool
    changed_by_id: int


class ApplicationMarkInviteSent(BaseSchema):
    sent_by_id: int
    allow_resend: bool = False


class ApplicationDispatchEmailRequest(BaseSchema):
    sent_by_id: int
    email_type: EmailType
    allow_resend: bool = False
    template_variant: Optional[str] = None


class ApplicationSendInviteResponse(BaseSchema):
    application_id: int
    email_type: EmailType
    status: str
    message: str
    callback_url: str


class ApplicationPublicScheduleRead(BaseSchema):
    application_id: int
    candidate_name: str
    candidate_email: str
    vacancy_title: str
    stage: ApplicationStage
    invite_sent_at: Optional[datetime] = None
    hr_interview_at: Optional[datetime] = None
    available_slots: list[datetime] = Field(default_factory=list)
    schedule_timezone: str


class ApplicationPublicScheduleCreate(BaseSchema):
    scheduled_at: datetime


class ApplicationPublicScheduleResponse(BaseSchema):
    application_id: int
    stage: ApplicationStage
    hr_interview_at: datetime
    message: str


class ApplicationStageAdvance(BaseSchema):
    to_stage: ApplicationStage
    changed_by_id: int
    notes: Optional[str] = None


class ApplicationRejectRequest(BaseSchema):
    rejected_stage: ApplicationStage
    reason: str
    changed_by_id: int


class ApplicationTimelineRead(BaseSchema):
    application: ApplicationRead
    stage_events: list[ApplicationStageEventRead]
    email_events: list[ApplicationEmailEventRead]
    interviews: list[ApplicationInterviewRead]
