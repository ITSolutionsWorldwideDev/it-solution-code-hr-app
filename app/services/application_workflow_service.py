from __future__ import annotations

from datetime import datetime
from typing import Iterable

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.application import Application
from app.models.application_email_event import ApplicationEmailEvent
from app.models.application_interview import ApplicationInterview
from app.models.candidate_match import CandidateMatch
from app.models.application_stage_event import ApplicationStageEvent
from app.models.candidate import Candidate
from app.models.enums import (
    ApplicationStage,
    EmailStatus,
    EmailType,
    InterviewDecision,
    InterviewStageType,
    InterviewStatus,
    ShortlistBucket,
    UserRole,
)
from app.models.user import User
from app.models.vacancy import Vacancy
from app.services.calendar_availability_service import book_public_interview_slot
from app.services.crud import get_or_404


PRIMARY_SHORTLIST_SIZE = 5
RESERVE_SHORTLIST_SIZE = 5
TOTAL_SHORTLIST_SIZE = PRIMARY_SHORTLIST_SIZE + RESERVE_SHORTLIST_SIZE


def list_vacancy_applications(session: Session, vacancy_id: int) -> list[Application]:
    get_or_404(session, Vacancy, vacancy_id)
    statement = (
        select(Application)
        .where(Application.vacancy_id == vacancy_id)
        .order_by(Application.ranking_position.asc().nulls_last(), Application.created_at.asc())
    )
    return list(session.exec(statement).all())


def rank_applications_for_vacancy(session: Session, vacancy_id: int) -> list[Application]:
    applications = list_vacancy_applications(session, vacancy_id)
    ranked = sorted(
        applications,
        key=lambda item: item.ranking_score if item.ranking_score is not None else (item.match_score or 0.0),
        reverse=True,
    )

    for index, application in enumerate(ranked, start=1):
        application.ranking_position = index
        if application.ranking_score is None:
            application.ranking_score = application.match_score
        application.stage = ApplicationStage.RANKED
        application.current_owner_role = UserRole.HR
        session.add(application)

    session.commit()
    _refresh_many(session, ranked)
    return ranked


def generate_shortlist(session: Session, vacancy_id: int, changed_by_id: int | None = None) -> list[Application]:
    all_applications = list_vacancy_applications(session, vacancy_id)
    applications = [application for application in all_applications if _is_direct_vacancy_application(session, application)]
    talent_pool_applications = [
        application for application in all_applications if _is_talent_pool_shortlist_application(application)
    ]
    non_direct_generated = [
        application
        for application in all_applications
        if application not in applications and application not in talent_pool_applications
    ]
    changer = get_or_404(session, User, changed_by_id) if changed_by_id else None

    ranked = sorted(
        applications,
        key=lambda item: item.ranking_score if item.ranking_score is not None else (item.match_score or 0.0),
        reverse=True,
    )

    for index, application in enumerate(ranked, start=1):
        previous_stage = application.stage
        has_confirmed_invite = application.invite_sent_at is not None

        application.ranking_position = index
        if application.ranking_score is None:
            application.ranking_score = application.match_score

        if index <= PRIMARY_SHORTLIST_SIZE:
            application.shortlist_bucket = ShortlistBucket.PRIMARY
            application.stage = (
                ApplicationStage.HR_INVITE_SENT if has_confirmed_invite else ApplicationStage.PRIMARY_SHORTLIST
            )
        elif index <= TOTAL_SHORTLIST_SIZE:
            application.shortlist_bucket = ShortlistBucket.RESERVE
            application.stage = (
                ApplicationStage.HR_INVITE_SENT if has_confirmed_invite else ApplicationStage.RESERVE_SHORTLIST
            )
        else:
            application.shortlist_bucket = ShortlistBucket.NONE

        # Keep already-confirmed HR invites visible in the pipeline and shortlist.
        if has_confirmed_invite:
            application.invite_selected = False
        else:
            application.invite_selected = False
            application.invite_sent_at = None
            application.invite_sent_by_id = None

        application.current_owner_role = UserRole.HR
        session.add(application)

        if application.stage != previous_stage:
            _create_stage_event(
                session=session,
                application=application,
                from_stage=previous_stage,
                to_stage=application.stage,
                changed_by_id=changer.id if changer else None,
                changed_by_role=changer.role if changer else None,
                notes="Shortlist generated automatically from ranking.",
            )

    for application in non_direct_generated:
        if application.invite_sent_at is not None:
            continue
        application.shortlist_bucket = ShortlistBucket.NONE
        application.invite_selected = False
        application.ranking_position = None
        application.stage = ApplicationStage.PARSED
        application.current_owner_role = UserRole.HR
        session.add(application)

    session.commit()
    _refresh_many(session, ranked)
    return ranked


def _ensure_shortlist_candidates(session: Session, vacancy_id: int) -> None:
    existing_applications = list_vacancy_applications(session, vacancy_id)
    missing_slots = TOTAL_SHORTLIST_SIZE - len(existing_applications)
    if missing_slots <= 0:
      return

    existing_candidate_ids = {application.candidate_id for application in existing_applications}
    supplemental_matches = list(
        session.exec(
            select(CandidateMatch)
            .where(
                CandidateMatch.vacancy_id == vacancy_id,
                CandidateMatch.candidate_id.not_in(existing_candidate_ids) if existing_candidate_ids else True,
            )
            .order_by(CandidateMatch.match_score.desc(), CandidateMatch.created_at.desc())
        ).all()
    )

    created = 0
    for match in supplemental_matches:
        if created >= missing_slots:
            break

        candidate = session.get(Candidate, match.candidate_id)
        if candidate is None:
            continue

        session.add(
            Application(
                candidate_id=candidate.id,
                vacancy_id=vacancy_id,
                ai_summary=match.ai_summary or candidate.ai_summary,
                match_score=match.match_score,
                ranking_score=match.match_score,
                parsed_data={
                    **(candidate.parsed_data or {}),
                    "matched_skills": match.matched_skills,
                    "applied_fit_explanation": match.fit_explanation,
                },
                stage=ApplicationStage.PARSED,
                current_owner_role=UserRole.HR,
                invite_selected=False,
                shortlist_bucket=ShortlistBucket.NONE,
            )
        )
        created += 1

    if created:
        session.commit()


def _is_talent_pool_shortlist_application(application: Application) -> bool:
    parsed_data = application.parsed_data or {}
    return parsed_data.get("shortlist_source") == "talent_pool"


def _is_direct_vacancy_application(session: Session, application: Application) -> bool:
    if _is_talent_pool_shortlist_application(application):
        return False

    candidate = session.get(Candidate, application.candidate_id)
    if candidate is None:
        return False

    parsed_data = candidate.parsed_data or {}
    if parsed_data.get("source") != "job_application":
        return False

    source_reference_id = parsed_data.get("source_reference_id")
    return str(source_reference_id) == str(application.id)


def update_shortlist_bucket(
    session: Session,
    application_id: int,
    shortlist_bucket: ShortlistBucket,
    changed_by_id: int,
) -> Application:
    application = get_or_404(session, Application, application_id)
    user = get_or_404(session, User, changed_by_id)
    previous_stage = application.stage
    application.shortlist_bucket = shortlist_bucket
    application.current_owner_role = UserRole.HR

    if shortlist_bucket == ShortlistBucket.PRIMARY:
        application.stage = ApplicationStage.PRIMARY_SHORTLIST
    elif shortlist_bucket == ShortlistBucket.RESERVE:
        application.stage = ApplicationStage.RESERVE_SHORTLIST
    else:
        application.stage = ApplicationStage.EXCLUDED

    session.add(application)
    _create_stage_event(
        session,
        application,
        previous_stage,
        application.stage,
        user.id,
        user.role,
        notes=f"Shortlist bucket changed to {shortlist_bucket.value}.",
    )
    session.commit()
    session.refresh(application)
    return application


def add_candidate_from_talent_pool_to_shortlist(
    session: Session,
    *,
    vacancy_id: int,
    candidate_id: int,
    changed_by_id: int,
    shortlist_bucket: ShortlistBucket = ShortlistBucket.RESERVE,
    potential_score: float | None = None,
    reason: str | None = None,
) -> Application:
    get_or_404(session, Vacancy, vacancy_id)
    candidate = get_or_404(session, Candidate, candidate_id)
    user = get_or_404(session, User, changed_by_id)

    application = session.exec(
        select(Application).where(
            Application.vacancy_id == vacancy_id,
            Application.candidate_id == candidate_id,
        )
    ).first()

    target_stage = (
        ApplicationStage.PRIMARY_SHORTLIST
        if shortlist_bucket == ShortlistBucket.PRIMARY
        else ApplicationStage.RESERVE_SHORTLIST
    )
    source_flag = "talent_pool"

    if application is None:
        parsed_data = {
            **(candidate.parsed_data or {}),
            "shortlist_source": source_flag,
        }
        if reason:
            parsed_data["talent_pool_reason"] = reason

        application = Application(
            candidate_id=candidate.id,
            vacancy_id=vacancy_id,
            ai_summary=reason or candidate.ai_summary,
            match_score=potential_score,
            ranking_score=potential_score,
            parsed_data=parsed_data,
            stage=target_stage,
            current_owner_role=UserRole.HR,
            shortlist_bucket=shortlist_bucket,
            invite_selected=False,
            notes="Added to shortlist from talent pool.",
        )
        session.add(application)
        session.flush()
        _create_stage_event(
            session=session,
            application=application,
            from_stage=ApplicationStage.PARSED,
            to_stage=target_stage,
            changed_by_id=user.id,
            changed_by_role=user.role,
            notes="Candidate added to shortlist from talent pool.",
        )
    else:
        previous_stage = application.stage
        next_parsed_data = {**(application.parsed_data or {})}
        next_parsed_data["shortlist_source"] = source_flag
        if reason:
            next_parsed_data["talent_pool_reason"] = reason

        application.parsed_data = next_parsed_data
        application.shortlist_bucket = shortlist_bucket
        application.stage = target_stage
        application.current_owner_role = UserRole.HR
        if reason and not application.ai_summary:
            application.ai_summary = reason
        if potential_score is not None and application.match_score is None:
            application.match_score = potential_score
        if potential_score is not None and application.ranking_score is None:
            application.ranking_score = potential_score
        application.notes = "Added to shortlist from talent pool."
        session.add(application)

        if previous_stage != target_stage:
            _create_stage_event(
                session=session,
                application=application,
                from_stage=previous_stage,
                to_stage=target_stage,
                changed_by_id=user.id,
                changed_by_role=user.role,
                notes="Candidate re-added to shortlist from talent pool.",
            )

    session.commit()
    session.refresh(application)
    return application


def select_hr_invite(
    session: Session,
    application_id: int,
    invite_selected: bool,
    changed_by_id: int,
) -> Application:
    application = get_or_404(session, Application, application_id)
    user = get_or_404(session, User, changed_by_id)
    previous_stage = application.stage
    application.invite_selected = invite_selected
    application.current_owner_role = UserRole.HR

    if invite_selected:
        application.stage = ApplicationStage.HR_INVITE_SELECTED
    elif application.shortlist_bucket == ShortlistBucket.PRIMARY:
        application.stage = ApplicationStage.PRIMARY_SHORTLIST
    elif application.shortlist_bucket == ShortlistBucket.RESERVE:
        application.stage = ApplicationStage.RESERVE_SHORTLIST
    else:
        application.stage = ApplicationStage.EXCLUDED

    session.add(application)
    _create_stage_event(
        session,
        application,
        previous_stage,
        application.stage,
        user.id,
        user.role,
        notes=f"HR invite selection set to {invite_selected}.",
    )
    session.commit()
    session.refresh(application)
    return application


def mark_invite_sent(session: Session, application_id: int, sent_by_id: int) -> Application:
    application = confirm_hr_invite_sent(
        session=session,
        application_id=application_id,
        sent_by_id=sent_by_id,
    )
    return application


def create_pending_hr_invite_event(session: Session, application_id: int, sent_by_id: int) -> ApplicationEmailEvent:
    return create_pending_application_email_event(
        session=session,
        application_id=application_id,
        sent_by_id=sent_by_id,
        email_type=EmailType.HR_INVITE,
    )


def create_pending_application_email_event(
    session: Session,
    application_id: int,
    sent_by_id: int,
    email_type: EmailType,
) -> ApplicationEmailEvent:
    application = get_or_404(session, Application, application_id)
    sender = get_or_404(session, User, sent_by_id)
    candidate = get_or_404(session, Candidate, application.candidate_id)
    latest_event = _get_latest_email_event(session, application.id, email_type)
    if latest_event and latest_event.status == EmailStatus.PENDING:
        return latest_event

    email_event = ApplicationEmailEvent(
        application_id=application.id,
        email_type=email_type,
        recipient_email=candidate.email,
        status=EmailStatus.PENDING,
        sent_by_id=sender.id,
    )
    session.add(email_event)
    session.commit()
    session.refresh(email_event)
    return email_event


def confirm_hr_invite_sent(
    session: Session,
    application_id: int,
    sent_by_id: int | None = None,
    provider_message_id: str | None = None,
) -> Application:
    return confirm_application_email_sent(
        session=session,
        application_id=application_id,
        email_type=EmailType.HR_INVITE,
        sent_by_id=sent_by_id,
        provider_message_id=provider_message_id,
    )


def confirm_application_email_sent(
    session: Session,
    application_id: int,
    email_type: EmailType,
    sent_by_id: int | None = None,
    provider_message_id: str | None = None,
) -> Application:
    application = get_or_404(session, Application, application_id)
    candidate = get_or_404(session, Candidate, application.candidate_id)
    previous_stage = application.stage
    latest_event = _get_latest_email_event(session, application.id, email_type)

    sender = None
    if sent_by_id is not None:
        sender = get_or_404(session, User, sent_by_id)
    elif latest_event and latest_event.sent_by_id is not None:
        sender = get_or_404(session, User, latest_event.sent_by_id)

    if latest_event and latest_event.status == EmailStatus.PENDING:
        latest_event.status = EmailStatus.SENT
        latest_event.provider_message_id = provider_message_id
        latest_event.error_message = None
        session.add(latest_event)
    elif not latest_event or latest_event.status != EmailStatus.SENT:
        _create_email_event(
            session=session,
            application=application,
            email_type=email_type,
            recipient_email=candidate.email,
            status=EmailStatus.SENT,
            sent_by_id=sender.id if sender else None,
            provider_message_id=provider_message_id,
        )

    if email_type in {EmailType.HR_INVITE, EmailType.HR_PASSED} and (
        application.stage in {
            ApplicationStage.PRIMARY_SHORTLIST,
            ApplicationStage.RESERVE_SHORTLIST,
            ApplicationStage.HR_INVITE_SELECTED,
        }
        or (email_type == EmailType.HR_INVITE and (application.stage != ApplicationStage.HR_INVITE_SENT or application.invite_sent_at is None))
    ):
        application.stage = ApplicationStage.HR_INVITE_SENT
        application.current_owner_role = UserRole.HR
        application.invite_sent_at = datetime.utcnow()
        application.invite_sent_by_id = sender.id if sender else application.invite_sent_by_id
        session.add(application)
        _create_stage_event(
            session,
            application,
            previous_stage,
            application.stage,
            sender.id if sender else None,
            sender.role if sender else None,
            notes=(
                "Shortlist approval email delivery confirmed by n8n."
                if email_type == EmailType.HR_PASSED
                else "HR invitation email delivery confirmed by n8n."
            ),
        )

    session.commit()
    session.refresh(application)
    return application


def record_hr_invite_failure(
    session: Session,
    application_id: int,
    error_message: str | None,
    provider_message_id: str | None = None,
) -> ApplicationEmailEvent:
    return record_application_email_failure(
        session=session,
        application_id=application_id,
        email_type=EmailType.HR_INVITE,
        error_message=error_message,
        provider_message_id=provider_message_id,
    )


def record_application_email_failure(
    session: Session,
    application_id: int,
    email_type: EmailType,
    error_message: str | None,
    provider_message_id: str | None = None,
) -> ApplicationEmailEvent:
    application = get_or_404(session, Application, application_id)
    candidate = get_or_404(session, Candidate, application.candidate_id)
    latest_event = _get_latest_email_event(session, application.id, email_type)

    if latest_event and latest_event.status == EmailStatus.PENDING:
        latest_event.status = EmailStatus.FAILED
        latest_event.provider_message_id = provider_message_id
        latest_event.error_message = error_message
        session.add(latest_event)
        session.commit()
        session.refresh(latest_event)
        return latest_event

    email_event = ApplicationEmailEvent(
        application_id=application.id,
        email_type=email_type,
        recipient_email=candidate.email,
        status=EmailStatus.FAILED,
        sent_by_id=latest_event.sent_by_id if latest_event else None,
        provider_message_id=provider_message_id,
        error_message=error_message,
    )
    session.add(email_event)
    session.commit()
    session.refresh(email_event)
    return email_event


def advance_stage(
    session: Session,
    application_id: int,
    to_stage: ApplicationStage,
    changed_by_id: int,
    notes: str | None = None,
) -> Application:
    application = get_or_404(session, Application, application_id)
    user = get_or_404(session, User, changed_by_id)
    previous_stage = application.stage

    _validate_transition(to_stage, user.role)

    application.stage = to_stage
    application.current_owner_role = _owner_for_stage(to_stage)

    if to_stage == ApplicationStage.HR_PASSED:
        application.current_owner_role = UserRole.TECHNICAL
    elif to_stage == ApplicationStage.TECHNICAL_PASSED:
        application.current_owner_role = UserRole.MANAGER
    elif to_stage in {
        ApplicationStage.HR_REJECTED,
        ApplicationStage.TECHNICAL_REJECTED,
        ApplicationStage.MANAGEMENT_REJECTED,
    }:
        application.current_owner_role = None
    elif to_stage == ApplicationStage.SELECTED:
        application.selected_for_offer = True
    elif to_stage == ApplicationStage.OFFER_SENT:
        application.offer_sent_at = datetime.utcnow()
    elif to_stage == ApplicationStage.OFFER_ACCEPTED:
        application.offer_accepted_at = datetime.utcnow()
    elif to_stage == ApplicationStage.OFFER_DECLINED:
        application.offer_declined_at = datetime.utcnow()

    session.add(application)
    _create_stage_event(session, application, previous_stage, to_stage, user.id, user.role, notes)
    session.commit()
    session.refresh(application)
    return application


def reject_application(
    session: Session,
    application_id: int,
    rejected_stage: ApplicationStage,
    reason: str,
    changed_by_id: int,
) -> Application:
    if rejected_stage not in {
        ApplicationStage.HR_REJECTED,
        ApplicationStage.TECHNICAL_REJECTED,
        ApplicationStage.MANAGEMENT_REJECTED,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rejection stage.")

    application = advance_stage(
        session=session,
        application_id=application_id,
        to_stage=rejected_stage,
        changed_by_id=changed_by_id,
        notes=reason,
    )
    application.rejection_reason = reason
    session.add(application)
    session.commit()
    session.refresh(application)
    return application


def schedule_interview(
    session: Session,
    application_id: int,
    stage_type: InterviewStageType,
    scheduled_at: datetime,
    interviewer_user_id: int | None,
) -> ApplicationInterview:
    application = get_or_404(session, Application, application_id)
    interview = ApplicationInterview(
        application_id=application.id,
        stage_type=stage_type,
        scheduled_at=scheduled_at,
        interviewer_user_id=interviewer_user_id,
        status=InterviewStatus.SCHEDULED,
        decision=InterviewDecision.PENDING,
    )
    session.add(interview)

    if stage_type == InterviewStageType.HR:
        application.hr_interview_at = scheduled_at
        application.stage = ApplicationStage.HR_INTERVIEW_SCHEDULED
        application.current_owner_role = UserRole.HR
    elif stage_type == InterviewStageType.TECHNICAL:
        application.technical_interview_at = scheduled_at
        application.stage = ApplicationStage.TECHNICAL_INTERVIEW_SCHEDULED
        application.current_owner_role = UserRole.TECHNICAL
    else:
        application.management_interview_at = scheduled_at
        application.stage = ApplicationStage.MANAGEMENT_INTERVIEW_SCHEDULED
        application.current_owner_role = UserRole.MANAGER

    session.add(application)
    session.commit()
    session.refresh(interview)
    return interview


def record_interview_decision(
    session: Session,
    interview_id: int,
    decision: InterviewDecision,
    score: float | None,
    feedback: str | None,
    changed_by_id: int,
) -> ApplicationInterview:
    interview = get_or_404(session, ApplicationInterview, interview_id)
    interview.status = InterviewStatus.COMPLETED
    interview.decision = decision
    interview.score = score
    interview.feedback = feedback
    session.add(interview)
    session.commit()
    session.refresh(interview)

    if interview.stage_type == InterviewStageType.HR:
        next_stage = ApplicationStage.HR_PASSED if decision == InterviewDecision.PASSED else ApplicationStage.HR_REJECTED
    elif interview.stage_type == InterviewStageType.TECHNICAL:
        next_stage = ApplicationStage.TECHNICAL_PASSED if decision == InterviewDecision.PASSED else ApplicationStage.TECHNICAL_REJECTED
    else:
        next_stage = ApplicationStage.SELECTED if decision == InterviewDecision.PASSED else ApplicationStage.MANAGEMENT_REJECTED

    advance_stage(
        session=session,
        application_id=interview.application_id,
        to_stage=next_stage,
        changed_by_id=changed_by_id,
        notes=feedback,
    )
    session.refresh(interview)
    return interview


def schedule_public_interview_from_candidate(
    session: Session,
    application_id: int,
    scheduled_at: datetime,
) -> Application:
    application = get_or_404(session, Application, application_id)
    schedule_context = book_public_interview_slot(session, application_id, scheduled_at)
    stage_type = schedule_context["stage_type"]

    interview = session.exec(
        select(ApplicationInterview)
        .where(
            ApplicationInterview.application_id == application.id,
            ApplicationInterview.stage_type == stage_type,
        )
        .order_by(ApplicationInterview.created_at.desc())
    ).first()

    if interview and interview.status == InterviewStatus.SCHEDULED:
        interview.scheduled_at = scheduled_at
        session.add(interview)
    else:
        interview = ApplicationInterview(
            application_id=application.id,
            stage_type=stage_type,
            scheduled_at=scheduled_at,
            interviewer_user_id=None,
            status=InterviewStatus.SCHEDULED,
            decision=InterviewDecision.PENDING,
        )
        session.add(interview)

    if stage_type == InterviewStageType.HR:
        application.hr_interview_at = scheduled_at
        application.stage = ApplicationStage.HR_INTERVIEW_SCHEDULED
        application.current_owner_role = UserRole.HR
    elif stage_type == InterviewStageType.TECHNICAL:
        application.technical_interview_at = scheduled_at
        application.stage = ApplicationStage.TECHNICAL_INTERVIEW_SCHEDULED
        application.current_owner_role = UserRole.TECHNICAL
    else:
        application.management_interview_at = scheduled_at
        application.stage = ApplicationStage.MANAGEMENT_INTERVIEW_SCHEDULED
        application.current_owner_role = UserRole.MANAGER

    session.add(application)
    session.commit()
    session.refresh(application)
    return application


def get_application_timeline(session: Session, application_id: int) -> dict:
    application = get_or_404(session, Application, application_id)
    stage_events = list(
        session.exec(
            select(ApplicationStageEvent)
            .where(ApplicationStageEvent.application_id == application_id)
            .order_by(ApplicationStageEvent.created_at.desc())
        ).all()
    )
    email_events = list(
        session.exec(
            select(ApplicationEmailEvent)
            .where(ApplicationEmailEvent.application_id == application_id)
            .order_by(ApplicationEmailEvent.created_at.desc())
        ).all()
    )
    interviews = list(
        session.exec(
            select(ApplicationInterview)
            .where(ApplicationInterview.application_id == application_id)
            .order_by(ApplicationInterview.created_at.desc())
        ).all()
    )
    return {
        "application": application,
        "stage_events": stage_events,
        "email_events": email_events,
        "interviews": interviews,
    }


def delete_application_from_pipeline(session: Session, application_id: int) -> None:
    application = get_or_404(session, Application, application_id)

    stage_events = list(
        session.exec(
            select(ApplicationStageEvent).where(ApplicationStageEvent.application_id == application_id)
        ).all()
    )
    email_events = list(
        session.exec(
            select(ApplicationEmailEvent).where(ApplicationEmailEvent.application_id == application_id)
        ).all()
    )
    interviews = list(
        session.exec(
            select(ApplicationInterview).where(ApplicationInterview.application_id == application_id)
        ).all()
    )

    for event in stage_events:
        session.delete(event)

    for event in email_events:
        session.delete(event)

    for interview in interviews:
        session.delete(interview)

    session.delete(application)
    session.commit()


def _create_stage_event(
    session: Session,
    application: Application,
    from_stage: ApplicationStage | None,
    to_stage: ApplicationStage,
    changed_by_id: int | None,
    changed_by_role: UserRole | None,
    notes: str | None = None,
) -> None:
    session.add(
        ApplicationStageEvent(
            application_id=application.id,
            from_stage=from_stage,
            to_stage=to_stage,
            changed_by_id=changed_by_id,
            changed_by_role=changed_by_role,
            notes=notes,
        )
    )


def _create_email_event(
    session: Session,
    application: Application,
    email_type: EmailType,
    recipient_email: str,
    status: EmailStatus,
    sent_by_id: int | None = None,
    provider_message_id: str | None = None,
    error_message: str | None = None,
    ) -> None:
    session.add(
        ApplicationEmailEvent(
            application_id=application.id,
            email_type=email_type,
            recipient_email=recipient_email,
            status=status,
            sent_by_id=sent_by_id,
            provider_message_id=provider_message_id,
            error_message=error_message,
        )
    )


def _get_latest_email_event(
    session: Session,
    application_id: int,
    email_type: EmailType,
) -> ApplicationEmailEvent | None:
    return session.exec(
        select(ApplicationEmailEvent)
        .where(
            ApplicationEmailEvent.application_id == application_id,
            ApplicationEmailEvent.email_type == email_type,
        )
        .order_by(ApplicationEmailEvent.id.desc())
    ).first()


def _owner_for_stage(stage: ApplicationStage) -> UserRole | None:
    if stage in {
        ApplicationStage.PARSED,
        ApplicationStage.RANKED,
        ApplicationStage.PRIMARY_SHORTLIST,
        ApplicationStage.RESERVE_SHORTLIST,
        ApplicationStage.HR_INVITE_SELECTED,
        ApplicationStage.HR_INVITE_SENT,
        ApplicationStage.HR_INTERVIEW_SCHEDULED,
        ApplicationStage.HR_IN_PROGRESS,
    }:
        return UserRole.HR
    if stage in {ApplicationStage.TECHNICAL_INTERVIEW_SCHEDULED, ApplicationStage.TECHNICAL_IN_PROGRESS}:
        return UserRole.TECHNICAL
    if stage in {
        ApplicationStage.MANAGEMENT_INTERVIEW_SCHEDULED,
        ApplicationStage.MANAGEMENT_IN_PROGRESS,
        ApplicationStage.SELECTED,
        ApplicationStage.OFFER_SENT,
        ApplicationStage.OFFER_ACCEPTED,
        ApplicationStage.OFFER_DECLINED,
    }:
        return UserRole.MANAGER
    return None


def _validate_transition(to_stage: ApplicationStage, role: UserRole) -> None:
    allowed: dict[UserRole, set[ApplicationStage]] = {
        UserRole.HR: {
            ApplicationStage.RANKED,
            ApplicationStage.PRIMARY_SHORTLIST,
            ApplicationStage.RESERVE_SHORTLIST,
            ApplicationStage.EXCLUDED,
            ApplicationStage.HR_INVITE_SELECTED,
            ApplicationStage.HR_INVITE_SENT,
            ApplicationStage.HR_INTERVIEW_SCHEDULED,
            ApplicationStage.HR_IN_PROGRESS,
            ApplicationStage.HR_PASSED,
            ApplicationStage.HR_REJECTED,
        },
        UserRole.TECHNICAL: {
            ApplicationStage.TECHNICAL_INTERVIEW_SCHEDULED,
            ApplicationStage.TECHNICAL_IN_PROGRESS,
            ApplicationStage.TECHNICAL_PASSED,
            ApplicationStage.TECHNICAL_REJECTED,
        },
        UserRole.MANAGER: {
            ApplicationStage.MANAGEMENT_INTERVIEW_SCHEDULED,
            ApplicationStage.MANAGEMENT_IN_PROGRESS,
            ApplicationStage.SELECTED,
            ApplicationStage.MANAGEMENT_REJECTED,
            ApplicationStage.OFFER_SENT,
            ApplicationStage.OFFER_ACCEPTED,
            ApplicationStage.OFFER_DECLINED,
            ApplicationStage.HIRED,
        },
        UserRole.ADMIN: set(ApplicationStage),
    }
    if to_stage not in allowed[role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role {role.value} cannot move an application to {to_stage.value}.",
        )


def _refresh_many(session: Session, records: Iterable[Application]) -> None:
    for record in records:
        session.refresh(record)
