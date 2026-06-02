from fastapi import APIRouter, Depends, Request, Response, status
from sqlmodel import Session

from app.config import settings
from app.db import get_session
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDispatchEmailRequest,
    ApplicationInviteSelectionUpdate,
    ApplicationMarkInviteSent,
    ApplicationPublicScheduleCreate,
    ApplicationPublicScheduleRead,
    ApplicationPublicScheduleResponse,
    ApplicationRead,
    ApplicationRejectRequest,
    ApplicationSendInviteResponse,
    ApplicationShortlistUpdate,
    ApplicationStageAdvance,
    ApplicationTimelineRead,
    ApplicationUpdate,
)
from app.services import crud
from app.services.application_service import create_application
from app.services.calendar_availability_service import list_public_hr_interview_slots
from app.services.application_workflow_service import (
    advance_stage,
    delete_application_from_pipeline,
    get_application_timeline,
    reject_application,
    schedule_public_interview_from_candidate,
    select_hr_invite,
    update_shortlist_bucket,
)
from app.services.calendar_availability_service import get_public_schedule_context, list_public_interview_slots
from app.services.hr_invite_service import dispatch_application_email, dispatch_hr_invite


router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("/", response_model=list[ApplicationRead], summary="List applications", description="Return all applications that link candidates to vacancies.")
def list_applications(session: Session = Depends(get_session)):
    return crud.get_all(session, Application)


@router.get(
    "/public-schedule/{application_id}",
    response_model=ApplicationPublicScheduleRead,
    summary="Get candidate self-scheduling details",
)
def get_public_schedule_details(application_id: int, session: Session = Depends(get_session)):
    application = crud.get_or_404(session, Application, application_id)
    candidate = crud.get_or_404(session, Candidate, application.candidate_id)
    vacancy = crud.get_or_404(session, Vacancy, application.vacancy_id)
    schedule_context = get_public_schedule_context(session, application_id)
    available_slots = list_public_interview_slots(session, application_id)
    return ApplicationPublicScheduleRead(
        application_id=application.id,
        candidate_name=candidate.name,
        candidate_email=candidate.email,
        vacancy_title=vacancy.title,
        stage=application.stage,
        stage_type=schedule_context["stage_type"],
        invite_sent_at=application.invite_sent_at,
        scheduled_at=schedule_context["scheduled_at"],
        available_slots=available_slots,
        schedule_timezone=settings.public_schedule_timezone,
    )


@router.post(
    "/public-schedule/{application_id}",
    response_model=ApplicationPublicScheduleResponse,
    summary="Store candidate self-scheduled HR interview time",
)
def post_public_schedule_details(
    application_id: int,
    payload: ApplicationPublicScheduleCreate,
    session: Session = Depends(get_session),
):
    application = schedule_public_interview_from_candidate(
        session=session,
        application_id=application_id,
        scheduled_at=payload.scheduled_at,
    )
    schedule_context = get_public_schedule_context(session, application_id)
    return ApplicationPublicScheduleResponse(
        application_id=application.id,
        stage=application.stage,
        stage_type=schedule_context["stage_type"],
        scheduled_at=schedule_context["scheduled_at"],
        message=f"Your {schedule_context['stage_type'].value} interview time has been saved successfully.",
    )


@router.get("/{application_id}", response_model=ApplicationRead, summary="Get application", description="Return an application by ID.")
def get_application(application_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, Application, application_id)


@router.post("/", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED, summary="Create application", description="Create an application linking a candidate to a vacancy.")
def create_application_route(payload: ApplicationCreate, session: Session = Depends(get_session)):
    return create_application(session, payload)


@router.put("/{application_id}", response_model=ApplicationRead, summary="Update application", description="Update an existing application.")
def update_application(application_id: int, payload: ApplicationUpdate, session: Session = Depends(get_session)):
    application = crud.get_or_404(session, Application, application_id)
    return crud.update(session, application, payload.model_dump(exclude_unset=True))


@router.patch("/{application_id}/shortlist", response_model=ApplicationRead, summary="Update shortlist bucket")
def patch_shortlist(application_id: int, payload: ApplicationShortlistUpdate, session: Session = Depends(get_session)):
    return update_shortlist_bucket(
        session=session,
        application_id=application_id,
        shortlist_bucket=payload.shortlist_bucket,
        changed_by_id=payload.changed_by_id,
    )


@router.patch("/{application_id}/invite-selection", response_model=ApplicationRead, summary="Update HR invite selection")
def patch_invite_selection(
    application_id: int,
    payload: ApplicationInviteSelectionUpdate,
    session: Session = Depends(get_session),
):
    return select_hr_invite(
        session=session,
        application_id=application_id,
        invite_selected=payload.invite_selected,
        changed_by_id=payload.changed_by_id,
    )


@router.post(
    "/{application_id}/send-hr-invite",
    response_model=ApplicationSendInviteResponse,
    summary="Send HR invite via n8n",
)
def post_send_hr_invite(
    application_id: int,
    payload: ApplicationMarkInviteSent,
    request: Request,
    session: Session = Depends(get_session),
):
    return dispatch_hr_invite(
        session=session,
        application_id=application_id,
        sent_by_id=payload.sent_by_id,
        request=request,
        allow_resend=payload.allow_resend,
    )


@router.post(
    "/{application_id}/mark-invite-sent",
    response_model=ApplicationSendInviteResponse,
    summary="Send HR invite via n8n (legacy alias)",
)
def post_mark_invite_sent(
    application_id: int,
    payload: ApplicationMarkInviteSent,
    request: Request,
    session: Session = Depends(get_session),
):
    return dispatch_hr_invite(
        session=session,
        application_id=application_id,
        sent_by_id=payload.sent_by_id,
        request=request,
        allow_resend=payload.allow_resend,
    )


@router.post(
    "/{application_id}/send-email",
    response_model=ApplicationSendInviteResponse,
    summary="Send an application email via n8n",
)
def post_send_application_email(
    application_id: int,
    payload: ApplicationDispatchEmailRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    return dispatch_application_email(
        session=session,
        application_id=application_id,
        sent_by_id=payload.sent_by_id,
        email_type=payload.email_type,
        request=request,
        allow_resend=payload.allow_resend,
        template_variant=payload.template_variant,
    )


@router.patch("/{application_id}/stage", response_model=ApplicationRead, summary="Advance application stage")
def patch_stage(application_id: int, payload: ApplicationStageAdvance, session: Session = Depends(get_session)):
    return advance_stage(
        session=session,
        application_id=application_id,
        to_stage=payload.to_stage,
        changed_by_id=payload.changed_by_id,
        notes=payload.notes,
    )


@router.patch("/{application_id}/reject", response_model=ApplicationRead, summary="Reject an application at a workflow stage")
def patch_reject(application_id: int, payload: ApplicationRejectRequest, session: Session = Depends(get_session)):
    return reject_application(
        session=session,
        application_id=application_id,
        rejected_stage=payload.rejected_stage,
        reason=payload.reason,
        changed_by_id=payload.changed_by_id,
    )


@router.get("/{application_id}/timeline", response_model=ApplicationTimelineRead, summary="Get application timeline")
def get_timeline(application_id: int, session: Session = Depends(get_session)):
    return get_application_timeline(session, application_id)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete application", description="Delete an application by ID.")
def delete_application(application_id: int, session: Session = Depends(get_session)):
    delete_application_from_pipeline(session, application_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
