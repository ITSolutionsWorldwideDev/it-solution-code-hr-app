from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import BASE_DIR, settings
from app.models.application import Application
from app.db import get_session
from app.models.enums import ApplicationStage, ShortlistBucket, UserRole
from app.models.vacancy import Vacancy
from app.schemas.hr_invite import HRInviteN8NCallbackRequest, HRInviteN8NCallbackResponse
from app.schemas.linkedin import LinkedInPreviewRead, LinkedInPreviewRequest
from app.services.crud import get_or_404
from app.services.hr_invite_service import process_hr_invite_callback
from app.services.linkedin_service import build_linkedin_preview
from app.services.vacancy_service import ensure_vacancy_apply_url


router = APIRouter(prefix="/integrations/n8n", tags=["Integrations"])


@router.post(
    "/linkedin-preview",
    response_model=LinkedInPreviewRead,
    summary="Generate a LinkedIn preview via n8n",
)
def generate_linkedin_preview(
    payload: LinkedInPreviewRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    vacancy = get_or_404(session, Vacancy, payload.vacancy_id)
    ensure_vacancy_apply_url(session=session, vacancy=vacancy)
    return build_linkedin_preview(
        vacancy,
        dry_run=payload.dry_run,
        public_apply_base_url=payload.public_apply_base_url or request.headers.get("origin"),
    )


@router.post(
    "/hr-invite-result",
    response_model=HRInviteN8NCallbackResponse,
    summary="Process an HR invite delivery callback from n8n",
)
def process_hr_invite_result(
    payload: HRInviteN8NCallbackRequest,
    session: Session = Depends(get_session),
):
    return process_hr_invite_callback(session=session, payload=payload)


def _resolve_resume_path(file_path: str) -> Path:
    candidate_paths = []
    incoming = Path(file_path)

    if incoming.is_absolute():
        candidate_paths.append(incoming)
    else:
        candidate_paths.append(BASE_DIR / incoming)
        candidate_paths.append(BASE_DIR / file_path.lstrip("/\\"))

    candidate_paths.append(settings.resume_upload_dir / incoming.name)
    candidate_paths.append(BASE_DIR / "storage" / "resumes" / incoming.name)

    for candidate_path in candidate_paths:
        if candidate_path.exists():
            return candidate_path

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Resume file was not found for parse job at path '{file_path}'.",
    )


def _upsert_parsed_application(
    session: Session,
    candidate_id: int,
    vacancy_id: int,
    ai_summary: str | None,
    match_score: float | None,
    parsed_data: dict,
) -> Application:
    statement = select(Application).where(
        Application.candidate_id == candidate_id,
        Application.vacancy_id == vacancy_id,
    )
    application = session.exec(statement).first()

    if application is None:
        application = Application(
            candidate_id=candidate_id,
            vacancy_id=vacancy_id,
            ai_summary=ai_summary,
            match_score=match_score,
            parsed_data=parsed_data,
            stage=ApplicationStage.PARSED,
            current_owner_role=UserRole.HR,
            shortlist_bucket=ShortlistBucket.NONE,
            invite_selected=False,
            selected_for_offer=False,
        )
    else:
        application.ai_summary = ai_summary
        application.match_score = match_score
        application.parsed_data = parsed_data
        application.stage = ApplicationStage.PARSED
        application.current_owner_role = UserRole.HR

    session.add(application)
    session.commit()
    session.refresh(application)
    return application
