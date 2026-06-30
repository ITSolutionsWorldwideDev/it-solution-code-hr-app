from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel import Session

from app.db import get_session
from app.models.user import User
from app.models.vacancy import Vacancy
from app.schemas.website_publish import WebsitePublishRead, WebsitePublishRequest
from app.services.auth_service import require_admin_user
from app.services.crud import get_or_404
from app.services.website_publish_service import (
    build_website_publish_preview,
    delete_vacancy_from_website,
    generate_website_pdf_preview,
    publish_vacancy_to_website,
)
from app.services.website_application_sync_service import sync_website_job_applications


router = APIRouter(prefix="/integrations/website", tags=["Website Integrations"])


class WebsiteApplicationSyncRequest(BaseModel):
    limit: int = 25
    legacy_application_ids: list[int] | None = None


@router.post(
    "/preview",
    response_model=WebsitePublishRead,
    summary="Preview website publication payload",
)
def preview_website_publish(
    payload: WebsitePublishRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    vacancy = get_or_404(session, Vacancy, payload.vacancy_id)
    return build_website_publish_preview(vacancy, public_base_url=str(request.base_url).rstrip("/"))


@router.post(
    "/generate-pdf",
    response_model=WebsitePublishRead,
    summary="Generate website PDF locally",
)
def generate_website_pdf(
    payload: WebsitePublishRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    vacancy = get_or_404(session, Vacancy, payload.vacancy_id)
    return generate_website_pdf_preview(vacancy, public_base_url=str(request.base_url).rstrip("/"))


@router.post(
    "/publish",
    response_model=WebsitePublishRead,
    summary="Publish vacancy to website jobs table",
)
def publish_website_vacancy(
    payload: WebsitePublishRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    vacancy = get_or_404(session, Vacancy, payload.vacancy_id)
    return publish_vacancy_to_website(
        session=session,
        vacancy=vacancy,
        public_base_url=str(request.base_url).rstrip("/"),
    )


@router.post(
    "/delete",
    response_model=WebsitePublishRead,
    summary="Remove vacancy from website jobs table",
)
def delete_website_vacancy(
    payload: WebsitePublishRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    vacancy = get_or_404(session, Vacancy, payload.vacancy_id)
    return delete_vacancy_from_website(
        session=session,
        vacancy=vacancy,
        public_base_url=str(request.base_url).rstrip("/"),
    )


@router.post(
    "/sync-applications",
    summary="Sync website job applications directly from the website database",
)
def sync_website_applications(
    payload: WebsiteApplicationSyncRequest,
    _user: User = Depends(require_admin_user),
    session: Session = Depends(get_session),
):
    return sync_website_job_applications(
        session=session,
        limit=payload.limit,
        legacy_application_ids=payload.legacy_application_ids,
    )
