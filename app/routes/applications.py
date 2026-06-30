from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from sqlmodel import Session, select

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
    PublicApplicationSubmitResponse,
    ApplicationRejectRequest,
    ApplicationSendInviteResponse,
    ApplicationShortlistUpdate,
    ApplicationStageAdvance,
    ApplicationTimelineRead,
    ApplicationUpdate,
)
from app.schemas.workspace import PipelineBoardResponseRead
from app.services import crud
from app.services.application_service import create_application
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
from app.services.cv_pipeline_service import (
    create_parse_job_for_application,
    process_candidate_file,
    store_resume_upload,
    upsert_placeholder_candidate,
)
from app.services.hr_invite_service import dispatch_application_email, dispatch_hr_invite
from app.services.workspace_service import get_pipeline_board_payload


router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("/", response_model=list[ApplicationRead], summary="List applications", description="Return all applications that link candidates to vacancies.")
def list_applications(session: Session = Depends(get_session)):
    return crud.get_all(session, Application)


@router.get(
    "/pipeline-board",
    response_model=PipelineBoardResponseRead,
    summary="Get compact pipeline board payload",
    description="Return the pipeline workspace data in one compact response to reduce frontend round trips.",
)
def get_pipeline_board(session: Session = Depends(get_session)):
    return get_pipeline_board_payload(session)


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


@router.post(
    "/public-submit",
    response_model=PublicApplicationSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a public job application with CV parsing",
    description="Store the application intake first, then run the shared CV parse pipeline without blocking the submission.",
)
async def submit_public_application(
    file: UploadFile = File(...),
    vacancy_id: int = Form(...),
    candidate_email: str = Form(...),
    candidate_name: str | None = Form(default=None),
    candidate_phone: str | None = Form(default=None),
    address: str | None = Form(default=None),
    how_did_you_hear: str | None = Form(default=None),
    cover_letter: str | None = Form(default=None),
    location: str | None = Form(default=None),
    work_authorization: str | None = Form(default=None),
    notice_period: str | None = Form(default=None),
    source_label: str | None = Form(default=None),
    session: Session = Depends(get_session),
):
    vacancy = crud.get_or_404(session, Vacancy, vacancy_id)
    stored_resume = await store_resume_upload(file)
    submitted_email = candidate_email.strip()
    intake_metadata = {
        "candidate_name": candidate_name,
        "candidate_phone": candidate_phone,
        "address": address,
        "how_did_you_hear": how_did_you_hear,
        "cover_letter": cover_letter,
        "candidate_email": submitted_email,
        "location": location,
        "work_authorization": work_authorization,
        "notice_period": notice_period,
        "source_label": source_label or "public_apply_page",
    }
    print(
        "[public-submit] received application",
        {
            "vacancy_id": vacancy.id,
            "candidate_email": submitted_email,
            "candidate_name": candidate_name,
            "candidate_phone": candidate_phone,
            "source_label": intake_metadata["source_label"],
            "filename": stored_resume.original_filename,
        },
    )

    candidate = upsert_placeholder_candidate(
        session,
        email=submitted_email,
        original_filename=stored_resume.original_filename,
        source="job_application",
        source_reference_id=vacancy.id,
        intake_metadata=intake_metadata,
    )
    existing_application = session.exec(
        select(Application).where(
            Application.candidate_id == candidate.id,
            Application.vacancy_id == vacancy.id,
        )
    ).first()
    if existing_application is not None:
        existing_application.parsed_data = {
            **(existing_application.parsed_data or {}),
            "parse_status": "pending",
            "match_status": "pending",
            "intake_metadata": intake_metadata,
        }
        session.add(existing_application)
        session.commit()
        session.refresh(existing_application)
        application = existing_application
    else:
        application = create_application(
            session,
            ApplicationCreate(
                candidate_id=candidate.id,
                vacancy_id=vacancy.id,
                parsed_data={"parse_status": "pending", "match_status": "pending"},
            ),
        )
    parse_job = create_parse_job_for_application(
        session=session,
        application=application,
        stored_resume=stored_resume,
        uploaded_by="public_apply_page",
    )
    result = process_candidate_file(
        session=session,
        stored_resume=stored_resume,
        source="job_application",
        source_reference_id=application.id,
        candidate_id=candidate.id,
        application_id=application.id,
        vacancy_id=vacancy.id,
        submitted_email=submitted_email,
        intake_metadata=intake_metadata,
        parse_job=parse_job,
    )
    candidate_record = result.candidate
    candidate_changed = False
    if candidate_name and (
        not candidate_record.name
        or candidate_record.name == "Pending Candidate"
        or candidate_record.name == "Unknown Candidate"
    ):
        candidate_record.name = candidate_name.strip()
        candidate_changed = True
    if candidate_phone and not candidate_record.phone:
        candidate_record.phone = candidate_phone.strip()
        candidate_changed = True
    if candidate_changed:
        session.add(candidate_record)
        session.commit()
        session.refresh(candidate_record)

    print(
        "[public-submit] application parsed",
        {
            "application_id": application.id,
            "candidate_id": candidate_record.id,
            "parse_status": result.parse_status,
            "match_status": result.match_status,
            "vacancy_id": vacancy.id,
            "source_label": intake_metadata["source_label"],
        },
    )

    return PublicApplicationSubmitResponse(
        application_id=application.id,
        candidate_id=candidate_record.id,
        parse_status=result.parse_status,
        match_status=result.match_status,
        message="Application submitted successfully.",
    )


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
