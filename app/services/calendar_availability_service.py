from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import requests
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.config import settings
from app.models.application import Application
from app.models.application_email_event import ApplicationEmailEvent
from app.models.application_interview import ApplicationInterview
from app.models.candidate import Candidate
from app.models.enums import ApplicationStage, EmailStatus, EmailType, InterviewStageType, InterviewStatus
from app.models.vacancy import Vacancy
from app.services.crud import get_or_404


def list_public_interview_slots(session: Session, application_id: int) -> list[datetime]:
    application = get_or_404(session, Application, application_id)
    schedule_context = _resolve_self_schedule_context(session, application)
    _ensure_self_scheduling_allowed(application, schedule_context["stage_type"])
    candidate = get_or_404(session, Candidate, application.candidate_id)
    vacancy = get_or_404(session, Vacancy, application.vacancy_id)

    if settings.n8n_calendar_availability_webhook_url:
        slots = _fetch_slots_from_n8n(application, candidate, vacancy, schedule_context["stage_type"])
        if slots:
            return slots

    return _build_internal_slots(session)


def list_public_hr_interview_slots(session: Session, application_id: int) -> list[datetime]:
    # Backward-compatible alias for older route imports after the self-scheduling expansion.
    return list_public_interview_slots(session, application_id)


def validate_public_interview_slot(session: Session, application_id: int, scheduled_at: datetime) -> None:
    normalized_requested = _to_utc_without_seconds(scheduled_at)
    available_starts = {
        _to_utc_without_seconds(slot)
        for slot in list_public_interview_slots(session, application_id)
    }

    if normalized_requested not in available_starts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected interview time is no longer available. Please choose one of the open slots.",
        )


def book_public_interview_slot(
    session: Session,
    application_id: int,
    scheduled_at: datetime,
) -> dict[str, object]:
    application = get_or_404(session, Application, application_id)
    schedule_context = _resolve_self_schedule_context(session, application)
    _ensure_self_scheduling_allowed(application, schedule_context["stage_type"])
    validate_public_interview_slot(session, application_id, scheduled_at)

    candidate = get_or_404(session, Candidate, application.candidate_id)
    vacancy = get_or_404(session, Vacancy, application.vacancy_id)

    if settings.n8n_calendar_booking_webhook_url:
        _book_slot_with_n8n(
            application=application,
            candidate=candidate,
            vacancy=vacancy,
            stage_type=schedule_context["stage_type"],
            scheduled_at=scheduled_at,
        )

    return schedule_context


def get_public_schedule_context(session: Session, application_id: int) -> dict[str, object]:
    application = get_or_404(session, Application, application_id)
    return _resolve_self_schedule_context(session, application)


def _ensure_self_scheduling_allowed(application: Application, stage_type: InterviewStageType) -> None:
    if stage_type == InterviewStageType.HR and application.invite_sent_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This candidate cannot schedule an interview until the HR invite email has been sent.",
        )

    blocked_stages = {
        ApplicationStage.HR_REJECTED,
        ApplicationStage.TECHNICAL_REJECTED,
        ApplicationStage.MANAGEMENT_REJECTED,
        ApplicationStage.SELECTED,
        ApplicationStage.OFFER_SENT,
        ApplicationStage.OFFER_ACCEPTED,
        ApplicationStage.OFFER_DECLINED,
        ApplicationStage.HIRED,
    }
    if application.stage in blocked_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This application is no longer available for candidate self-scheduling.",
        )


def _resolve_self_schedule_context(session: Session, application: Application) -> dict[str, object]:
    if application.stage in {ApplicationStage.HR_INVITE_SENT, ApplicationStage.HR_INTERVIEW_SCHEDULED}:
        return {
            "stage_type": InterviewStageType.HR,
            "scheduled_at": application.hr_interview_at,
        }

    if application.stage in {ApplicationStage.HR_PASSED, ApplicationStage.TECHNICAL_INTERVIEW_SCHEDULED}:
        if application.stage == ApplicationStage.HR_PASSED and not _has_available_email_event(
            session,
            application.id,
            EmailType.HR_PASSED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This technical interview invitation is not available for self-scheduling yet.",
            )
        return {
            "stage_type": InterviewStageType.TECHNICAL,
            "scheduled_at": application.technical_interview_at,
        }

    if application.stage in {ApplicationStage.TECHNICAL_PASSED, ApplicationStage.MANAGEMENT_INTERVIEW_SCHEDULED}:
        if application.stage == ApplicationStage.TECHNICAL_PASSED and not _has_available_email_event(
            session,
            application.id,
            EmailType.TECHNICAL_PASSED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This management interview invitation is not available for self-scheduling yet.",
            )
        return {
            "stage_type": InterviewStageType.MANAGEMENT,
            "scheduled_at": application.management_interview_at,
        }

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This application is not currently in a self-scheduling stage.",
    )


def _has_available_email_event(session: Session, application_id: int, email_type: EmailType) -> bool:
    latest_event = session.exec(
        select(ApplicationEmailEvent)
        .where(
            ApplicationEmailEvent.application_id == application_id,
            ApplicationEmailEvent.email_type == email_type,
        )
        .order_by(ApplicationEmailEvent.id.desc())
    ).first()
    return latest_event is not None and latest_event.status != EmailStatus.FAILED


def _fetch_slots_from_n8n(
    application: Application,
    candidate: Candidate,
    vacancy: Vacancy,
    stage_type: InterviewStageType,
) -> list[datetime]:
    timezone = ZoneInfo(settings.public_schedule_timezone)
    now_local = datetime.now(timezone)
    window_end = now_local + timedelta(days=settings.public_schedule_days_ahead)
    payload = {
        "application_id": application.id,
        "vacancy_id": vacancy.id,
        "candidate_name": candidate.name,
        "candidate_email": candidate.email,
        "vacancy_title": vacancy.title,
        "stage_type": stage_type.value,
        "timezone": settings.public_schedule_timezone,
        "window_start": now_local.isoformat(),
        "window_end": window_end.isoformat(),
        "slot_minutes": settings.public_schedule_slot_minutes,
        "duration_minutes": settings.public_schedule_slot_minutes,
        "interviewer_user_id": None,
        "interviewer_group": stage_type.value,
        "secret": settings.n8n_webhook_secret,
    }

    try:
        response = requests.post(
            settings.n8n_calendar_availability_webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not load open calendar slots from the scheduling service.",
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The scheduling service returned an invalid availability response.",
        ) from exc

    raw_slots = data.get("slots", [])
    if not isinstance(raw_slots, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The scheduling service returned availability in an unexpected format.",
        )

    slots: list[datetime] = []
    for item in raw_slots:
        if not isinstance(item, dict):
            continue
        start = item.get("start")
        if not isinstance(start, str):
            continue
        try:
            slots.append(_to_utc_without_seconds(datetime.fromisoformat(start.replace("Z", "+00:00"))))
        except ValueError:
            continue
    return sorted(set(slots))


def _book_slot_with_n8n(
    *,
    application: Application,
    candidate: Candidate,
    vacancy: Vacancy,
    stage_type: InterviewStageType,
    scheduled_at: datetime,
) -> None:
    payload = {
        "application_id": application.id,
        "vacancy_id": vacancy.id,
        "candidate_name": candidate.name,
        "candidate_email": candidate.email,
        "vacancy_title": vacancy.title,
        "stage_type": stage_type.value,
        "scheduled_at": scheduled_at.isoformat(),
        "timezone": settings.public_schedule_timezone,
        "duration_minutes": settings.public_schedule_slot_minutes,
        "interviewer_user_id": None,
        "interviewer_group": stage_type.value,
        "secret": settings.n8n_webhook_secret,
    }

    try:
        response = requests.post(
            settings.n8n_calendar_booking_webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not confirm the interview booking in Outlook.",
        ) from exc


def _build_internal_slots(session: Session) -> list[datetime]:
    timezone = ZoneInfo(settings.public_schedule_timezone)
    now_local = datetime.now(timezone)
    slot_delta = timedelta(minutes=settings.public_schedule_slot_minutes)
    now_cutoff = _to_utc_without_seconds(now_local + timedelta(hours=1))

    taken_slots = {
        _to_utc_without_seconds(interview.scheduled_at)
        for interview in session.exec(
            select(ApplicationInterview).where(
                ApplicationInterview.stage_type == InterviewStageType.HR,
                ApplicationInterview.status == InterviewStatus.SCHEDULED,
                ApplicationInterview.scheduled_at.is_not(None),
            )
        ).all()
        if interview.scheduled_at is not None
    }

    slots: list[datetime] = []
    for day_offset in range(settings.public_schedule_days_ahead):
        current_day = (now_local + timedelta(days=day_offset)).date()
        if current_day.weekday() >= 5:
            continue

        current_slot = datetime.combine(
            current_day,
            time(hour=settings.public_schedule_business_start_hour),
            timezone,
        )
        day_end = datetime.combine(
            current_day,
            time(hour=settings.public_schedule_business_end_hour),
            timezone,
        )

        while current_slot < day_end:
            utc_slot = _to_utc_without_seconds(current_slot)
            if utc_slot > now_cutoff and utc_slot not in taken_slots:
                slots.append(utc_slot)
            current_slot += slot_delta

    return slots


def _to_utc_without_seconds(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(second=0, microsecond=0)
    return value.astimezone(UTC).replace(tzinfo=None, second=0, microsecond=0)
