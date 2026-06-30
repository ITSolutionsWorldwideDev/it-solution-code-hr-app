from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy
from app.schemas.application import ApplicationCreate
from app.services.cv_pipeline_service import (
    CandidateFileParseResult,
    StoredResume,
    create_parse_job_for_application,
    process_candidate_file,
    upsert_placeholder_candidate,
)
from app.services.crud import get_or_404


def create_application(session: Session, payload: ApplicationCreate) -> Application:
    get_or_404(session, Candidate, payload.candidate_id)
    get_or_404(session, Vacancy, payload.vacancy_id)

    application = Application(**payload.model_dump())
    session.add(application)
    session.commit()
    session.refresh(application)
    return application


def ingest_public_application(
    session: Session,
    *,
    vacancy: Vacancy,
    stored_resume: StoredResume,
    candidate_email: str,
    candidate_name: str | None = None,
    candidate_phone: str | None = None,
    address: str | None = None,
    how_did_you_hear: str | None = None,
    cover_letter: str | None = None,
    location: str | None = None,
    work_authorization: str | None = None,
    notice_period: str | None = None,
    source_label: str = "public_apply_page",
    legacy_application_id: int | None = None,
    website_job_info_id: int | None = None,
) -> tuple[Application, CandidateFileParseResult]:
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
        "legacy_job_application_id": legacy_application_id,
        "website_job_info_id": website_job_info_id,
    }
    filtered_intake_metadata = {
        key: value for key, value in intake_metadata.items() if value is not None
    }

    candidate = upsert_placeholder_candidate(
        session,
        email=submitted_email,
        original_filename=stored_resume.original_filename,
        source="job_application",
        source_reference_id=vacancy.id,
        intake_metadata=filtered_intake_metadata,
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
            "intake_metadata": filtered_intake_metadata,
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
                parsed_data={
                    "parse_status": "pending",
                    "match_status": "pending",
                    "intake_metadata": filtered_intake_metadata,
                },
            ),
        )
    parse_job = create_parse_job_for_application(
        session=session,
        application=application,
        stored_resume=stored_resume,
        uploaded_by=source_label,
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
        intake_metadata=filtered_intake_metadata,
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

    refreshed_application = session.get(Application, application.id) or application
    return refreshed_application, result
