from datetime import datetime

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models.enums import HiringRequestStatus, VacancyStatus
from app.models.hiring_request import HiringRequest
from app.models.user import User
from app.models.vacancy import Vacancy
from app.config import settings
from app.schemas.hiring_request import HiringRequestDecision
from app.services.crud import get_or_404
from app.services.openai_service import inject_job_description_apply_url
from app.services.website_publish_service import auto_publish_vacancy_to_website
from app.services.settings_service import get_general_settings_runtime, get_recruitment_settings_runtime


def approve_hiring_request(
    session: Session,
    hiring_request_id: int,
    decision: HiringRequestDecision,
    *,
    public_base_url: str,
) -> HiringRequest:
    hiring_request = get_or_404(session, HiringRequest, hiring_request_id)
    reviewer = get_or_404(session, User, decision.reviewed_by_id)

    if hiring_request.status != HiringRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending hiring requests can be approved.",
        )

    hiring_request.status = HiringRequestStatus.APPROVED
    hiring_request.reviewed_by_id = reviewer.id
    hiring_request.reviewed_at = datetime.utcnow()
    hiring_request.rejection_reason = None

    vacancy = Vacancy(
        title=hiring_request.title,
        description=hiring_request.description,
        required_skills=hiring_request.required_skills,
        experience_level=hiring_request.experience_level,
        status=VacancyStatus.OPEN,
        department_id=hiring_request.department_id,
        hiring_request_id=hiring_request.id,
        ai_summary=hiring_request.ai_summary,
        match_score=hiring_request.match_score,
        parsed_data=hiring_request.parsed_data,
    )

    session.add(hiring_request)
    session.add(vacancy)
    session.flush()

    general_settings = get_general_settings_runtime(session=session)
    recruitment_settings = get_recruitment_settings_runtime(session=session)
    apply_url = f"{general_settings.public_apply_base_url.rstrip('/')}/{vacancy.id}"
    vacancy.description = inject_job_description_apply_url(
        description=vacancy.description,
        apply_url=apply_url,
    )
    hiring_request.description = vacancy.description

    session.commit()
    session.refresh(vacancy)
    if recruitment_settings.auto_publish_vacancy_after_approval:
        auto_publish_vacancy_to_website(session, vacancy, public_base_url=public_base_url)
    session.refresh(hiring_request)
    return hiring_request


def reject_hiring_request(session: Session, hiring_request_id: int, decision: HiringRequestDecision) -> HiringRequest:
    hiring_request = get_or_404(session, HiringRequest, hiring_request_id)
    reviewer = get_or_404(session, User, decision.reviewed_by_id)

    if hiring_request.status != HiringRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending hiring requests can be rejected.",
        )

    hiring_request.status = HiringRequestStatus.REJECTED
    hiring_request.reviewed_by_id = reviewer.id
    hiring_request.reviewed_at = datetime.utcnow()
    hiring_request.rejection_reason = decision.rejection_reason

    session.add(hiring_request)
    session.commit()
    session.refresh(hiring_request)
    return hiring_request
