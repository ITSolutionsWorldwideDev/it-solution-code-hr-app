from datetime import datetime
from typing import Optional

from app.models.enums import InterviewDecision, InterviewStageType, InterviewStatus
from app.schemas.common import BaseSchema


class ApplicationInterviewBase(BaseSchema):
    stage_type: InterviewStageType
    scheduled_at: Optional[datetime] = None
    interviewer_user_id: Optional[int] = None
    score: Optional[float] = None
    feedback: Optional[str] = None


class ApplicationInterviewCreate(BaseSchema):
    stage_type: InterviewStageType
    scheduled_at: datetime
    interviewer_user_id: Optional[int] = None


class ApplicationInterviewDecisionUpdate(BaseSchema):
    decision: InterviewDecision
    score: Optional[float] = None
    feedback: Optional[str] = None
    changed_by_id: int


class ApplicationInterviewRead(ApplicationInterviewBase):
    id: int
    application_id: int
    status: InterviewStatus
    decision: InterviewDecision
    created_at: datetime
    updated_at: datetime
