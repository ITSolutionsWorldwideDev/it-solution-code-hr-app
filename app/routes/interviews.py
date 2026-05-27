from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.application_interview import (
    ApplicationInterviewCreate,
    ApplicationInterviewDecisionUpdate,
    ApplicationInterviewRead,
)
from app.services.application_workflow_service import record_interview_decision, schedule_interview


router = APIRouter(prefix="/interviews", tags=["Interviews"])


@router.post("/applications/{application_id}", response_model=ApplicationInterviewRead, summary="Create interview")
def create_interview(
    application_id: int,
    payload: ApplicationInterviewCreate,
    session: Session = Depends(get_session),
):
    return schedule_interview(
        session=session,
        application_id=application_id,
        stage_type=payload.stage_type,
        scheduled_at=payload.scheduled_at,
        interviewer_user_id=payload.interviewer_user_id,
    )


@router.patch("/{interview_id}", response_model=ApplicationInterviewRead, summary="Record interview decision")
def update_interview_decision(
    interview_id: int,
    payload: ApplicationInterviewDecisionUpdate,
    session: Session = Depends(get_session),
):
    return record_interview_decision(
        session=session,
        interview_id=interview_id,
        decision=payload.decision,
        score=payload.score,
        feedback=payload.feedback,
        changed_by_id=payload.changed_by_id,
    )
