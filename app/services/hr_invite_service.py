from __future__ import annotations

import json
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.error import HTTPError, URLError
from urllib.request import Request as URLRequest, urlopen

from fastapi import HTTPException, Request, status
from sqlmodel import Session

from app.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.enums import ApplicationStage, EmailStatus, EmailType, ShortlistBucket, UserRole
from app.models.user import User
from app.models.vacancy import Vacancy
from app.schemas.application import ApplicationSendInviteResponse
from app.schemas.hr_invite import HRInviteN8NCallbackRequest, HRInviteN8NCallbackResponse
from app.services.application_workflow_service import (
    confirm_application_email_sent,
    create_pending_application_email_event,
    _get_latest_email_event,
    record_application_email_failure,
)
from app.services.crud import get_or_404


def dispatch_hr_invite(
    session: Session,
    application_id: int,
    sent_by_id: int,
    request: Request,
    allow_resend: bool = False,
) -> ApplicationSendInviteResponse:
    return dispatch_application_email(
        session=session,
        application_id=application_id,
        sent_by_id=sent_by_id,
        email_type=EmailType.HR_INVITE,
        request=request,
        allow_resend=allow_resend,
    )


def dispatch_application_email(
    session: Session,
    application_id: int,
    sent_by_id: int,
    email_type: EmailType,
    request: Request,
    allow_resend: bool = False,
    template_variant: str | None = None,
) -> ApplicationSendInviteResponse:
    application = get_or_404(session, Application, application_id)
    sender = get_or_404(session, User, sent_by_id)
    candidate = get_or_404(session, Candidate, application.candidate_id)
    vacancy = get_or_404(session, Vacancy, application.vacancy_id)
    is_shortlist_approval_email = _is_shortlist_approval_email(application, email_type)
    normalized_template_variant = _normalize_template_variant(email_type, template_variant)
    _validate_application_email_dispatch(
        session,
        application,
        candidate,
        sender,
        email_type,
        allow_resend,
        normalized_template_variant,
    )

    callback_url = _build_callback_url(request)
    payload = _build_n8n_email_payload(
        application=application,
        candidate=candidate,
        vacancy=vacancy,
        sender=sender,
        email_type=email_type,
        callback_url=callback_url,
        template_variant=normalized_template_variant,
    )

    create_pending_application_email_event(
        session=session,
        application_id=application.id,
        sent_by_id=sender.id,
        email_type=email_type,
    )

    webhook_url = _resolve_n8n_webhook_url(email_type, normalized_template_variant)
    _validate_webhook_route(email_type, webhook_url, normalized_template_variant)

    try:
        _post_json(webhook_url, payload)
    except HTTPException as exc:
        record_application_email_failure(
            session=session,
            application_id=application.id,
            email_type=email_type,
            error_message=str(exc.detail),
        )
        raise

    if email_type == EmailType.HR_INVITE or is_shortlist_approval_email:
        confirm_application_email_sent(
            session=session,
            application_id=application.id,
            email_type=email_type,
            sent_by_id=sender.id,
        )

    return ApplicationSendInviteResponse(
        application_id=application.id,
        email_type=email_type,
        status="queued" if email_type != EmailType.HR_INVITE else "sent",
        message=_queue_message_for_email_type(email_type, normalized_template_variant),
        callback_url=callback_url,
    )


def _resolve_n8n_webhook_url(email_type: EmailType, template_variant: str | None = None) -> str:
    if email_type == EmailType.HR_INVITE and settings.n8n_hr_approval_webhook_url:
        return settings.n8n_hr_approval_webhook_url

    if email_type == EmailType.HR_PASSED and not template_variant and settings.n8n_hr_approval_webhook_url:
        return settings.n8n_hr_approval_webhook_url

    if email_type == EmailType.HR_REJECTION and not template_variant and settings.n8n_hr_rejection_webhook_url:
        return settings.n8n_hr_rejection_webhook_url

    if (
        email_type == EmailType.HR_PASSED
        and template_variant == "technical_interview_invite"
        and settings.n8n_technical_invite_webhook_url
    ):
        return settings.n8n_technical_invite_webhook_url

    if (
        email_type == EmailType.HR_REJECTION
        and template_variant == "hr_interview_rejection"
        and settings.n8n_technical_rejection_webhook_url
    ):
        return settings.n8n_technical_rejection_webhook_url

    if email_type == EmailType.TECHNICAL_PASSED and settings.n8n_management_invite_webhook_url:
        return settings.n8n_management_invite_webhook_url

    if email_type == EmailType.TECHNICAL_REJECTION and settings.n8n_technical_rejection_webhook_url:
        return settings.n8n_technical_rejection_webhook_url

    if email_type == EmailType.MANAGEMENT_REJECTION and settings.n8n_management_rejection_webhook_url:
        return settings.n8n_management_rejection_webhook_url

    if email_type == EmailType.OFFER_SENT and settings.n8n_onboarding_approval_webhook_url:
        return settings.n8n_onboarding_approval_webhook_url

    return settings.n8n_hr_invite_webhook_url


def _validate_webhook_route(email_type: EmailType, webhook_url: str, template_variant: str | None = None) -> None:
    normalized_url = webhook_url.lower()

    if template_variant == "technical_interview_invite" and "technical-invite" not in normalized_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Technical interview invites are mapped to the wrong n8n webhook URL.",
        )

    if email_type == EmailType.TECHNICAL_PASSED and "management-invite" not in normalized_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Technical approvals are mapped to the wrong n8n webhook URL.",
        )

    if email_type == EmailType.TECHNICAL_REJECTION and "technical-rejection" not in normalized_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Technical rejections are mapped to the wrong n8n webhook URL.",
        )

    if email_type == EmailType.MANAGEMENT_REJECTION and "management-rejection" not in normalized_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Management rejections are mapped to the wrong n8n webhook URL.",
        )

    if email_type == EmailType.OFFER_SENT and "onboarding-approval" not in normalized_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Onboarding approvals are mapped to the wrong n8n webhook URL.",
        )


def process_hr_invite_callback(
    session: Session,
    payload: HRInviteN8NCallbackRequest,
) -> HRInviteN8NCallbackResponse:
    if payload.secret != settings.n8n_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid n8n webhook secret.",
        )

    if payload.status == EmailStatus.SENT:
        application = confirm_application_email_sent(
            session=session,
            application_id=payload.application_id,
            email_type=payload.email_type,
            provider_message_id=payload.provider_message_id,
        )
        return HRInviteN8NCallbackResponse(
            application_id=application.id,
            email_type=payload.email_type,
            status=payload.status,
            stage=application.stage,
            invite_sent_at=application.invite_sent_at,
            message=_success_message_for_email_type(payload.email_type),
        )

    if payload.status == EmailStatus.FAILED:
        application = get_or_404(session, Application, payload.application_id)
        record_application_email_failure(
            session=session,
            application_id=payload.application_id,
            email_type=payload.email_type,
            error_message=payload.error_message or "n8n reported an unknown delivery failure.",
            provider_message_id=payload.provider_message_id,
        )
        session.refresh(application)
        return HRInviteN8NCallbackResponse(
            application_id=application.id,
            email_type=payload.email_type,
            status=payload.status,
            stage=application.stage,
            invite_sent_at=application.invite_sent_at,
            message=_failure_message_for_email_type(payload.email_type),
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported callback status for HR invite.",
    )


def _validate_application_email_dispatch(
    session: Session,
    application: Application,
    candidate: Candidate,
    sender: User,
    email_type: EmailType,
    allow_resend: bool,
    template_variant: str | None,
) -> None:
    latest_event = _get_latest_email_event(session, application.id, email_type)

    if latest_event and latest_event.status == EmailStatus.SENT and not allow_resend:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This {email_type.value} email was already sent.",
        )

    if email_type == EmailType.HR_INVITE:
        _validate_hr_invite_dispatch(application, candidate, allow_resend)
        return

    if email_type == EmailType.HR_PASSED and not (
        application.stage == ApplicationStage.HR_PASSED
        or application.stage in {
            ApplicationStage.PRIMARY_SHORTLIST,
            ApplicationStage.RESERVE_SHORTLIST,
            ApplicationStage.HR_INVITE_SELECTED,
        }
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approve the candidate in the HR pipeline before sending the approval email.",
        )

    if (
        email_type == EmailType.HR_PASSED
        and template_variant == "technical_interview_invite"
        and sender.role not in {UserRole.TECHNICAL, UserRole.ADMIN}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Technical or Admin users can send the technical interview invite.",
        )

    if email_type == EmailType.HR_REJECTION and application.stage != ApplicationStage.HR_REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reject the candidate in the HR pipeline before sending the rejection email.",
        )

    if email_type == EmailType.TECHNICAL_PASSED and application.stage != ApplicationStage.TECHNICAL_PASSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approve the candidate in the technical pipeline before sending the management-stage email.",
        )

    if email_type == EmailType.TECHNICAL_PASSED and sender.role not in {UserRole.MANAGER, UserRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Management or Admin users can send the management interview invite.",
        )

    if email_type == EmailType.TECHNICAL_REJECTION and application.stage != ApplicationStage.TECHNICAL_REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reject the candidate in the technical pipeline before sending the technical rejection email.",
        )

    if email_type == EmailType.MANAGEMENT_REJECTION and application.stage != ApplicationStage.MANAGEMENT_REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reject the candidate in the management pipeline before sending the management rejection email.",
        )

    if email_type == EmailType.OFFER_SENT and application.stage not in {
        ApplicationStage.SELECTED,
        ApplicationStage.OFFER_SENT,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approve the candidate in the management pipeline before sending the onboarding email.",
        )

    if not candidate.email.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The candidate does not have an email address on file.",
        )


def _validate_hr_invite_dispatch(application: Application, candidate: Candidate, allow_resend: bool) -> None:
    if application.shortlist_bucket not in {ShortlistBucket.PRIMARY, ShortlistBucket.RESERVE}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only primary or reserve shortlisted candidates can receive an HR invite.",
        )

    if not application.invite_selected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select the candidate for HR invite before sending the email.",
        )

    if application.stage == ApplicationStage.HR_INVITE_SENT and not allow_resend:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This HR invite was already confirmed as sent.",
        )

    if not candidate.email.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The candidate does not have an email address on file.",
        )


def _queue_message_for_email_type(email_type: EmailType, template_variant: str | None = None) -> str:
    if template_variant == "technical_interview_invite":
        return "Technical interview invitation email was handed to n8n and is waiting for delivery confirmation."
    if template_variant == "management_stage_invite":
        return "Management-stage invitation email was handed to n8n and is waiting for delivery confirmation."
    if template_variant == "hr_interview_rejection":
        return "Post-interview rejection email was handed to n8n and is waiting for delivery confirmation."
    if email_type == EmailType.HR_PASSED:
        return "HR approval email was handed to n8n and is waiting for delivery confirmation."
    if email_type == EmailType.HR_REJECTION:
        return "HR rejection email was handed to n8n and is waiting for delivery confirmation."
    if email_type == EmailType.TECHNICAL_PASSED:
        return "Management-stage invitation email was handed to n8n and is waiting for delivery confirmation."
    if email_type == EmailType.TECHNICAL_REJECTION:
        return "Technical rejection email was handed to n8n and is waiting for delivery confirmation."
    if email_type == EmailType.MANAGEMENT_REJECTION:
        return "Management rejection email was handed to n8n and is waiting for delivery confirmation."
    if email_type == EmailType.OFFER_SENT:
        return "Onboarding approval email was handed to n8n and is waiting for delivery confirmation."
    return "HR invite email was sent to n8n and the candidate was moved into the invite stage."


def _success_message_for_email_type(email_type: EmailType) -> str:
    if email_type == EmailType.HR_PASSED:
        return "HR approval email delivery confirmed."
    if email_type == EmailType.HR_REJECTION:
        return "HR rejection email delivery confirmed."
    if email_type == EmailType.TECHNICAL_PASSED:
        return "Management-stage invitation email delivery confirmed."
    if email_type == EmailType.TECHNICAL_REJECTION:
        return "Technical rejection email delivery confirmed."
    if email_type == EmailType.MANAGEMENT_REJECTION:
        return "Management rejection email delivery confirmed."
    if email_type == EmailType.OFFER_SENT:
        return "Onboarding approval email delivery confirmed."
    return "HR invite delivery confirmed."


def _failure_message_for_email_type(email_type: EmailType) -> str:
    if email_type == EmailType.HR_PASSED:
        return "HR approval email delivery failure recorded."
    if email_type == EmailType.HR_REJECTION:
        return "HR rejection email delivery failure recorded."
    if email_type == EmailType.TECHNICAL_PASSED:
        return "Management-stage invitation email delivery failure recorded."
    if email_type == EmailType.TECHNICAL_REJECTION:
        return "Technical rejection email delivery failure recorded."
    if email_type == EmailType.MANAGEMENT_REJECTION:
        return "Management rejection email delivery failure recorded."
    if email_type == EmailType.OFFER_SENT:
        return "Onboarding approval email delivery failure recorded."
    return "HR invite delivery failure recorded."


def _build_callback_url(request: Request) -> str:
    return f"{str(request.base_url).rstrip('/')}/api/integrations/n8n/hr-invite-result"


def _build_n8n_email_payload(
    application: Application,
    candidate: Candidate,
    vacancy: Vacancy,
    sender: User,
    email_type: EmailType,
    callback_url: str,
    template_variant: str | None = None,
) -> dict:
    payload_flags = _build_email_payload_flags(email_type, template_variant)

    if email_type == EmailType.HR_INVITE:
        return {
            "application_id": application.id,
            "email_type": email_type.value,
            **payload_flags,
            "candidate_name": candidate.name,
            "recipient_email": candidate.email,
            "vacancy_title": vacancy.title,
            "sender_name": sender.full_name,
            "application_stage": application.stage.value,
            "hr_interview_at": application.hr_interview_at.isoformat() if application.hr_interview_at else None,
            "schedule_url": f"{settings.public_schedule_base_url.rstrip('/')}/{application.id}",
            "callback_url": callback_url,
            "secret": settings.n8n_webhook_secret,
            "voornaam": _candidate_first_name(candidate.name),
            "functie": vacancy.title,
            "invite_url": _build_cal_invite_url(application, candidate),
        }

    return {
        "application_id": application.id,
        "email_type": email_type.value,
        **payload_flags,
        "candidate_name": candidate.name,
        "recipient_email": candidate.email,
        "vacancy_title": vacancy.title,
        "sender_name": sender.full_name,
        "application_stage": application.stage.value,
        "hr_interview_at": application.hr_interview_at.isoformat() if application.hr_interview_at else None,
        "schedule_url": f"{settings.public_schedule_base_url.rstrip('/')}/{application.id}",
        "callback_url": callback_url,
        "secret": settings.n8n_webhook_secret,
    }


def _build_email_payload_flags(email_type: EmailType, template_variant: str | None = None) -> dict:
    route_name = template_variant or (
        "hr_invite"
        if email_type == EmailType.HR_INVITE
        else "approved"
        if email_type == EmailType.HR_PASSED
        else "rejected"
        if email_type == EmailType.HR_REJECTION
        else "technical_approved"
        if email_type == EmailType.TECHNICAL_PASSED
        else "technical_rejected"
        if email_type == EmailType.TECHNICAL_REJECTION
        else "management_approved"
        if email_type == EmailType.OFFER_SENT
        else "management_rejected"
        if email_type == EmailType.MANAGEMENT_REJECTION
        else email_type.value
    )

    payload = {
        "email_template": route_name,
        "workflow_route": route_name,
        "template_variant": template_variant,
        # Keep simple booleans in the payload so n8n If nodes can branch on either
        # the route string or direct flags without relying on missing fields.
        "hr_invite": email_type == EmailType.HR_INVITE,
        "approved": email_type == EmailType.HR_PASSED,
        "rejected": email_type == EmailType.HR_REJECTION,
        "technical_approved": email_type == EmailType.TECHNICAL_PASSED,
        "technical_rejected": email_type == EmailType.TECHNICAL_REJECTION,
        "management_approved": email_type == EmailType.OFFER_SENT,
        "management_rejected": email_type == EmailType.MANAGEMENT_REJECTION,
        "management_stage_invite": template_variant == "management_stage_invite",
        "is_hr_invite_email": email_type == EmailType.HR_INVITE,
        "is_hr_approved_email": email_type == EmailType.HR_PASSED,
        "is_hr_rejection_email": email_type == EmailType.HR_REJECTION,
        "is_technical_interview_invite_email": template_variant == "technical_interview_invite",
        "is_hr_interview_rejection_email": template_variant == "hr_interview_rejection",
        "is_technical_approved_email": email_type == EmailType.TECHNICAL_PASSED,
        "is_technical_rejection_email": email_type == EmailType.TECHNICAL_REJECTION,
        "is_management_approved_email": email_type == EmailType.OFFER_SENT,
        "is_management_rejection_email": email_type == EmailType.MANAGEMENT_REJECTION,
        "is_management_stage_invite_email": template_variant == "management_stage_invite",
    }

    return payload


def _normalize_template_variant(email_type: EmailType, template_variant: str | None) -> str | None:
    if template_variant:
        return template_variant

    if email_type == EmailType.TECHNICAL_PASSED:
        return "management_stage_invite"

    return None


def _is_shortlist_approval_email(application: Application, email_type: EmailType) -> bool:
    return email_type == EmailType.HR_PASSED and application.stage in {
        ApplicationStage.PRIMARY_SHORTLIST,
        ApplicationStage.RESERVE_SHORTLIST,
        ApplicationStage.HR_INVITE_SELECTED,
    }


def _candidate_first_name(full_name: str) -> str:
    parts = [part for part in full_name.strip().split() if part]
    return parts[0] if parts else full_name.strip()


def _build_cal_invite_url(application: Application, candidate: Candidate) -> str:
    split_url = urlsplit(settings.cal_com_booking_base_url)
    params = dict(parse_qsl(split_url.query, keep_blank_values=True))

    # Cal.com booking links officially support prefilling booking questions via query params.
    # To get application_id back reliably, configure a hidden Cal.com booking question
    # with identifier `application_id` on the event type.
    params["application_id"] = str(application.id)

    if candidate.name.strip():
        params.setdefault("name", candidate.name.strip())
    if candidate.email.strip():
        params.setdefault("email", candidate.email.strip())

    return urlunsplit(
        (
            split_url.scheme,
            split_url.netloc,
            split_url.path,
            urlencode(params, doseq=True),
            split_url.fragment,
        )
    )


def _post_json(url: str, payload: dict) -> dict:
    request = URLRequest(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8").strip()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore") or str(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"n8n email webhook returned an error: {detail}",
        ) from exc
    except URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the n8n email webhook.",
        ) from exc

    if not body:
        return {}

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"raw": body}
