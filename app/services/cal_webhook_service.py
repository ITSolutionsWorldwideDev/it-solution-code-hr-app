from __future__ import annotations

import hashlib
import hmac
from datetime import datetime

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.config import settings
from app.models.application import Application
from app.models.application_interview import ApplicationInterview
from app.models.application_stage_event import ApplicationStageEvent
from app.models.candidate import Candidate
from app.models.enums import (
    ApplicationStage,
    InterviewDecision,
    InterviewStageType,
    InterviewStatus,
    UserRole,
)
from app.schemas.cal_webhook import CalWebhookEnvelope
from app.services.crud import get_or_404


def verify_cal_webhook_signature(raw_body: bytes, signature_header: str | None) -> None:
    if not settings.cal_com_webhook_secret:
        return

    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing Cal.com webhook signature.",
        )

    expected = hmac.new(
        settings.cal_com_webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    provided_signature = signature_header.removeprefix("sha256=")

    if not hmac.compare_digest(expected, provided_signature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Cal.com webhook signature.",
        )


def process_cal_booking_created(session: Session, envelope: CalWebhookEnvelope) -> Application:
    if envelope.triggerEvent != "BOOKING_CREATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported Cal.com webhook event.",
        )

    application = _find_application_for_booking(session, envelope)
    scheduled_at = envelope.payload.startTime
    previous_stage = application.stage

    interview = session.exec(
        select(ApplicationInterview)
        .where(
            ApplicationInterview.application_id == application.id,
            ApplicationInterview.stage_type == InterviewStageType.HR,
        )
        .order_by(ApplicationInterview.created_at.desc())
    ).first()

    if interview and interview.status == InterviewStatus.SCHEDULED:
        interview.scheduled_at = scheduled_at
        session.add(interview)
    else:
        interview = ApplicationInterview(
            application_id=application.id,
            stage_type=InterviewStageType.HR,
            scheduled_at=scheduled_at,
            interviewer_user_id=None,
            status=InterviewStatus.SCHEDULED,
            decision=InterviewDecision.PENDING,
        )
        session.add(interview)

    application.hr_interview_at = scheduled_at
    application.stage = ApplicationStage.HR_INTERVIEW_SCHEDULED
    application.current_owner_role = UserRole.HR
    application.parsed_data = {
        **(application.parsed_data or {}),
        "cal_booking": {
            "trigger_event": envelope.triggerEvent,
            "booking_uid": envelope.payload.uid,
            "booking_id": envelope.payload.bookingId,
            "start_time": scheduled_at.isoformat(),
            "metadata": envelope.payload.metadata,
        },
    }
    session.add(application)

    if previous_stage != application.stage:
        session.add(
            ApplicationStageEvent(
                application_id=application.id,
                from_stage=previous_stage,
                to_stage=application.stage,
                changed_by_id=None,
                changed_by_role=None,
                notes="Interview scheduled via Cal.com webhook.",
            )
        )

    session.commit()
    session.refresh(application)
    return application


def _find_application_for_booking(session: Session, envelope: CalWebhookEnvelope) -> Application:
    metadata = envelope.payload.metadata or {}
    application_id = _coerce_int(
        metadata.get("application_id")
        or metadata.get("applicationId")
        or metadata.get("applicationID")
        or _extract_application_id_from_responses(envelope)
    )
    if application_id is not None:
        return get_or_404(session, Application, application_id)

    attendee_email = _extract_attendee_email(envelope)
    if not attendee_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not identify the candidate from the Cal.com webhook payload.",
        )

    application = session.exec(
        select(Application)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .where(Candidate.email == attendee_email)
        .order_by(Application.created_at.desc())
    ).first()

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No application was found for attendee email '{attendee_email}'.",
        )

    return application


def _extract_attendee_email(envelope: CalWebhookEnvelope) -> str | None:
    attendees = envelope.payload.attendees
    if attendees:
        email = attendees[0].email.strip()
        if email:
            return email

    if envelope.payload.bookerEmail and envelope.payload.bookerEmail.strip():
        return envelope.payload.bookerEmail.strip()

    metadata = envelope.payload.metadata or {}
    for key in ("candidate_email", "candidateEmail", "email", "booker_email", "bookerEmail"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def _coerce_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def _extract_application_id_from_responses(envelope: CalWebhookEnvelope) -> object:
    responses = envelope.payload.responses or {}
    custom_inputs = envelope.payload.customInputs or {}

    for source in (responses, custom_inputs):
        for key in ("application_id", "applicationId", "applicationID"):
            value = source.get(key)
            if isinstance(value, dict):
                nested = value.get("response") or value.get("value")
                if isinstance(nested, list) and nested:
                    nested = nested[0]
                if isinstance(nested, dict):
                    nested = nested.get("label") or nested.get("value") or nested.get("id")
                if nested is not None:
                    return nested
            if value is not None:
                return value

    return None
