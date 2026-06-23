from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import BASE_DIR, settings
from app.models.application import Application
from app.db import get_session
from app.models.parse_job import ParseJob
from app.models.enums import ApplicationStage, ShortlistBucket, UserRole
from app.models.vacancy import Vacancy
from app.schemas.hr_invite import HRInviteN8NCallbackRequest, HRInviteN8NCallbackResponse
from app.schemas.linkedin import LinkedInPreviewRead, LinkedInPreviewRequest
from app.services.ai_service import extract_pdf_content
from app.services.candidate_service import create_candidate_from_cv
from app.services.crud import get_or_404
from app.services.hr_invite_service import process_hr_invite_callback
from app.services.linkedin_service import build_linkedin_preview


router = APIRouter(prefix="/integrations/n8n", tags=["Integrations"])


class N8NProcessParseJobRequest(BaseModel):
    parse_job_id: int
    vacancy_id: int
    file_path: str


class N8NProcessParseJobResponse(BaseModel):
    parse_job_id: int
    status: str
    candidate_id: int
    application_id: int | None
    vacancy_id: int
    file_path: str
    parsed_at: datetime


@router.post(
    "/linkedin-preview",
    response_model=LinkedInPreviewRead,
    summary="Generate a LinkedIn preview via n8n",
)
def generate_linkedin_preview(
    payload: LinkedInPreviewRequest,
    session: Session = Depends(get_session),
):
    vacancy = get_or_404(session, Vacancy, payload.vacancy_id)
    return build_linkedin_preview(vacancy, dry_run=payload.dry_run)


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


@router.post(
    "/process-parse",
    response_model=N8NProcessParseJobResponse,
    summary="Process a parse job from n8n",
)
def process_parse_job(
    payload: N8NProcessParseJobRequest,
    session: Session = Depends(get_session),
):
    parse_job = get_or_404(session, ParseJob, payload.parse_job_id)

    if parse_job.vacancy_id != payload.vacancy_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vacancy id does not match the parse job.",
        )

    parse_job.status = "parsing"
    parse_job.error_message = None
    parse_job.updated_at = datetime.utcnow()
    session.add(parse_job)
    session.commit()
    session.refresh(parse_job)

    try:
        file_bytes, resume_path = _load_parse_job_file_bytes(parse_job, payload.file_path)
        pdf_content = extract_pdf_content(file_bytes)
        pdf_content.update(
            {
                "filename": parse_job.file_name,
                "original_filename": parse_job.original_file_name or parse_job.file_name,
                "content_type": parse_job.mime_type or "application/pdf",
                "resume_path": str(resume_path) if resume_path is not None else parse_job.file_path,
                "file_checksum": parse_job.file_checksum,
                "file_bytes": file_bytes,
            }
        )

        candidate, _, parsed_candidate, _, _, matching = create_candidate_from_cv(
            session=session,
            pdf_content=pdf_content,
            vacancy_id=parse_job.vacancy_id,
            submitted_email=(
                str(parse_job.parsed_data.get("intake_metadata", {}).get("candidate_email")).strip()
                if parse_job.parsed_data.get("intake_metadata", {}).get("candidate_email")
                else None
            ),
        )

        application = _upsert_parsed_application(
            session=session,
            candidate_id=candidate.id,
            vacancy_id=parse_job.vacancy_id,
            ai_summary=candidate.ai_summary,
            match_score=candidate.match_score,
            parsed_data={
                **(candidate.parsed_data or {}),
                **({"matching": matching} if matching else {}),
                **({"intake_metadata": parse_job.parsed_data.get("intake_metadata")} if parse_job.parsed_data.get("intake_metadata") else {}),
            },
        )

        parse_job.file_path = str(resume_path) if resume_path is not None else parse_job.file_path
        parse_job.candidate_id = candidate.id
        parse_job.application_id = application.id
        parse_job.raw_text = pdf_content["extracted_text"]
        parse_job.parsed_data = {
            **(candidate.parsed_data or {}),
            **({"intake_metadata": parse_job.parsed_data.get("intake_metadata")} if parse_job.parsed_data.get("intake_metadata") else {}),
            "parsed_candidate": parsed_candidate,
            **({"matching": matching} if matching else {}),
        }
        parse_job.status = "parsed"
        parse_job.error_message = None
        parse_job.parsed_at = datetime.utcnow()
        parse_job.updated_at = datetime.utcnow()
        session.add(parse_job)
        session.commit()
        session.refresh(parse_job)
    except Exception as exc:
        session.rollback()
        parse_job.status = "failed"
        parse_job.error_message = str(exc)
        parse_job.updated_at = datetime.utcnow()
        session.add(parse_job)
        session.commit()
        raise

    return N8NProcessParseJobResponse(
        parse_job_id=parse_job.id,
        status=parse_job.status,
        candidate_id=parse_job.candidate_id,
        application_id=parse_job.application_id,
        vacancy_id=parse_job.vacancy_id,
        file_path=parse_job.file_path,
        parsed_at=parse_job.parsed_at,
    )


def _load_parse_job_file_bytes(parse_job: ParseJob, file_path: str) -> tuple[bytes, Path | None]:
    if parse_job.file_blob_data:
        return bytes(parse_job.file_blob_data), None

    resume_path = _resolve_resume_path(file_path)
    return resume_path.read_bytes(), resume_path


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
