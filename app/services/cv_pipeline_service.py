from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from zlib import adler32

from docx import Document
from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import delete
from sqlmodel import Session, select

from app.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.candidate_match import CandidateMatch
from app.models.enums import VacancyStatus
from app.models.parse_job import ParseJob
from app.models.vacancy import Vacancy
from app.schemas.candidate import CandidateCreate
from app.services.ai_service import sanitize_payload, sanitize_text
from app.services.candidate_service import create_candidate_from_cv, update_candidate_from_cv


MATCH_THRESHOLD = 50.0
SUPPORTED_PDF_TYPES = {"application/pdf", "application/x-pdf"}
SUPPORTED_DOCX_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}
LEGACY_DOC_TYPES = {
    "application/msword",
    "application/doc",
    "application/vnd.ms-word",
}


@dataclass
class StoredResume:
    filename: str
    original_filename: str
    content_type: str | None
    file_size_bytes: int
    file_checksum: str
    resume_path: str
    extension: str
    file_bytes: bytes


@dataclass
class CandidateFileParseResult:
    candidate: Candidate
    parse_status: str
    match_status: str
    matched_job_id: int | None
    score: float | None
    raw_text: str | None
    structured_data: dict
    error_message: str | None = None
    application: Application | None = None


def _normalize_extension(filename: str | None) -> str:
    return (Path(filename or "").suffix or "").lower()


def _infer_content_type(filename: str | None, content_type: str | None) -> str | None:
    normalized = sanitize_text(content_type.lower()) if content_type else None
    extension = _normalize_extension(filename)

    if normalized:
        return normalized
    if extension == ".pdf":
        return "application/pdf"
    if extension == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if extension == ".doc":
        return "application/msword"
    return None


def _build_placeholder_email(seed: str) -> str:
    checksum = adler32(seed.encode("utf-8")) & 0xFFFFFFFF
    return f"candidate-{checksum}@placeholder.local"


def _store_resume_bytes(
    *,
    file_bytes: bytes,
    filename: str | None,
    content_type: str | None,
) -> StoredResume:
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    normalized_content_type = _infer_content_type(filename, content_type)
    suffix = _normalize_extension(filename) or ".bin"
    checksum = sha256(file_bytes).hexdigest()
    storage_dir = settings.resume_upload_dir
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_path = storage_dir / f"{checksum}{suffix}"
    if not stored_path.exists():
        stored_path.write_bytes(file_bytes)

    return StoredResume(
        filename=filename or f"resume{suffix}",
        original_filename=filename or f"resume{suffix}",
        content_type=normalized_content_type,
        file_size_bytes=len(file_bytes),
        file_checksum=checksum,
        resume_path=str(stored_path),
        extension=suffix,
        file_bytes=file_bytes,
    )


async def store_resume_upload(file: UploadFile) -> StoredResume:
    try:
        file_bytes = await file.read()
    finally:
        await file.close()

    return _store_resume_bytes(
        file_bytes=file_bytes,
        filename=file.filename,
        content_type=file.content_type,
    )


def store_resume_from_bytes(
    *,
    file_bytes: bytes,
    filename: str | None,
    content_type: str | None,
) -> StoredResume:
    return _store_resume_bytes(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
    )


def extract_resume_text(stored_resume: StoredResume) -> tuple[str | None, str]:
    if stored_resume.extension == ".pdf":
        reader = PdfReader(BytesIO(stored_resume.file_bytes))
        text_parts = [page.extract_text() or "" for page in reader.pages]
        extracted_text = sanitize_text("\n".join(part.strip() for part in text_parts if part.strip()).strip())
        if not extracted_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No readable text was found in the uploaded PDF.",
            )
        return extracted_text, "parsed"

    if stored_resume.extension == ".docx":
        document = Document(BytesIO(stored_resume.file_bytes))
        text_parts = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        extracted_text = sanitize_text("\n".join(text_parts).strip())
        if not extracted_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No readable text was found in the uploaded DOCX file.",
            )
        return extracted_text, "parsed"

    if stored_resume.extension == ".doc":
        return None, "unsupported_format"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Only PDF, DOCX, and DOC resumes are supported.",
    )


def _build_pdf_content(stored_resume: StoredResume, extracted_text: str) -> dict:
    return {
        "filename": stored_resume.filename,
        "original_filename": stored_resume.original_filename,
        "content_type": stored_resume.content_type,
        "file_size_bytes": stored_resume.file_size_bytes,
        "file_checksum": stored_resume.file_checksum,
        "file_bytes": stored_resume.file_bytes,
        "resume_path": stored_resume.resume_path,
        "extracted_text": extracted_text,
        "page_count": None,
    }


def _find_candidate_by_email(session: Session, email: str | None) -> Candidate | None:
    if not email:
        return None
    return session.exec(select(Candidate).where(Candidate.email == email)).first()


def _find_candidate_by_resume_identity(
    session: Session,
    *,
    resume_path: str | None,
    file_checksum: str | None,
) -> Candidate | None:
    candidates = list(session.exec(select(Candidate)).all())
    for candidate in candidates:
        parsed_data = candidate.parsed_data or {}
        if file_checksum and parsed_data.get("file_checksum") == file_checksum:
            return candidate
        if resume_path and parsed_data.get("resume_path") == resume_path:
            return candidate
    return None


def _is_placeholder_candidate(candidate: Candidate | None) -> bool:
    if candidate is None:
        return False
    parsed_data = candidate.parsed_data or {}
    return candidate.name == "Pending Candidate" or parsed_data.get("parse_status") == "pending"


def _cleanup_placeholder_candidate(session: Session, candidate: Candidate | None) -> None:
    if candidate is None or not _is_placeholder_candidate(candidate):
        return

    linked_application = session.exec(
        select(Application).where(Application.candidate_id == candidate.id)
    ).first()
    if linked_application is not None:
        return

    session.exec(delete(ParseJob).where(ParseJob.candidate_id == candidate.id))
    session.delete(candidate)
    session.commit()


def upsert_placeholder_candidate(
    session: Session,
    *,
    email: str | None,
    original_filename: str,
    source: str,
    source_reference_id: int | None,
    intake_metadata: dict | None,
) -> Candidate:
    candidate = _find_candidate_by_resume_identity(
        session,
        resume_path=None,
        file_checksum=None,
    )
    if candidate is not None:
        return candidate

    candidate = _find_candidate_by_email(session, email)
    if candidate is not None:
        return candidate

    placeholder_email = sanitize_text(email) or _build_placeholder_email(f"{source}:{original_filename}")
    placeholder_candidate = _find_candidate_by_email(session, placeholder_email)
    if placeholder_candidate is not None:
        return placeholder_candidate

    candidate = Candidate(
        **CandidateCreate(
            name="Pending Candidate",
            email=placeholder_email,
            parsed_data=sanitize_payload(
                {
                    "parse_status": "pending",
                    "match_status": "pending",
                    "source": source,
                    "source_reference_id": source_reference_id,
                    "original_file_name": original_filename,
                    "intake_metadata": intake_metadata or {},
                }
            ),
        ).model_dump()
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def _resolve_manual_match_state(
    *,
    session: Session,
    candidate: Candidate,
    vacancy_id: int | None,
) -> tuple[str, int | None, float | None]:
    if vacancy_id:
        applied_match = session.exec(
            select(CandidateMatch).where(
                CandidateMatch.candidate_id == candidate.id,
                CandidateMatch.vacancy_id == vacancy_id,
            )
        ).first()
        if applied_match:
            if applied_match.match_score >= MATCH_THRESHOLD:
                return "matched", vacancy_id, applied_match.match_score
            return "potential_fit", vacancy_id, applied_match.match_score
        return "potential_fit", None, None

    open_vacancy_ids = {
        item.id
        for item in session.exec(select(Vacancy).where(Vacancy.status == VacancyStatus.OPEN)).all()
    }
    if not open_vacancy_ids:
        return "potential_fit", None, None

    best_match = session.exec(
        select(CandidateMatch).where(CandidateMatch.candidate_id == candidate.id)
    ).all()
    ranked_matches = sorted(
        (
            match
            for match in best_match
            if match.vacancy_id in open_vacancy_ids
        ),
        key=lambda item: item.match_score,
        reverse=True,
    )
    if ranked_matches and ranked_matches[0].match_score >= MATCH_THRESHOLD:
        winner = ranked_matches[0]
        return "matched", winner.vacancy_id, winner.match_score
    if ranked_matches:
        winner = ranked_matches[0]
        return "potential_fit", winner.vacancy_id, winner.match_score

    return "potential_fit", None, None


def _store_best_match_on_candidate(
    *,
    session: Session,
    candidate: Candidate,
    matched_job_id: int | None,
    score: float | None,
    vacancy_id: int | None,
) -> None:
    parsed_data = dict(candidate.parsed_data or {})

    if score is not None:
        parsed_data["fit_score"] = round(float(score), 2)

    if matched_job_id is None:
        candidate.parsed_data = sanitize_payload(parsed_data)
        return

    matched_vacancy = session.get(Vacancy, matched_job_id)
    if matched_vacancy is None:
        candidate.parsed_data = sanitize_payload(parsed_data)
        return

    parsed_data["selected_vacancy_id"] = matched_vacancy.id
    parsed_data["selected_vacancy_title"] = matched_vacancy.title

    matching = dict(parsed_data.get("matching") or {})
    match_payload = {
        "vacancy_id": str(matched_vacancy.id),
        "role_name": matched_vacancy.title,
        "score": round(float(score), 2) if score is not None else None,
        "analysis": parsed_data.get("fit_explanation"),
        "discovery_reason": parsed_data.get("fit_explanation"),
    }
    if vacancy_id is not None:
        matching["applied_match"] = match_payload
    else:
        matching["potential_match"] = match_payload
    parsed_data["matching"] = matching
    candidate.parsed_data = sanitize_payload(parsed_data)


def _sync_candidate_metadata(
    *,
    candidate: Candidate,
    parse_status: str,
    match_status: str,
    source: str,
    source_reference_id: int | None,
    stored_resume: StoredResume,
    raw_text: str | None,
    structured_data: dict,
    matched_job_id: int | None,
    intake_metadata: dict | None,
    error_message: str | None = None,
) -> None:
    parsed_data = dict(candidate.parsed_data or {})
    parsed_data.update(
        sanitize_payload(
            {
                **structured_data,
                "parse_status": parse_status,
                "match_status": match_status,
                "source": source,
                "source_reference_id": source_reference_id,
                "original_file_name": stored_resume.original_filename,
                "resume_path": stored_resume.resume_path,
                "raw_text": raw_text,
                "matched_job_id": matched_job_id,
                "intake_metadata": intake_metadata or {},
                "last_error": error_message,
                "parsed_at": datetime.utcnow().isoformat(),
            }
        )
    )
    candidate.parsed_data = parsed_data


def _store_resume_on_candidate_record(candidate: Candidate, stored_resume: StoredResume) -> None:
    candidate.resume_file_name = stored_resume.original_filename or stored_resume.filename
    candidate.resume_content_type = stored_resume.content_type
    candidate.resume_file_checksum = stored_resume.file_checksum
    candidate.resume_file_data = stored_resume.file_bytes


def _sync_application_metadata(
    *,
    application: Application,
    candidate: Candidate,
    parse_status: str,
    match_status: str,
    matched_job_id: int | None,
    score: float | None,
    intake_metadata: dict | None,
    error_message: str | None = None,
) -> None:
    application.ai_summary = candidate.ai_summary
    application.match_score = score
    application.parsed_data = sanitize_payload(
        {
            **(application.parsed_data or {}),
            "parse_status": parse_status,
            "match_status": match_status,
            "matched_job_id": matched_job_id,
            "candidate_id": candidate.id,
            "candidate_email": candidate.email,
            "intake_metadata": intake_metadata or {},
            "last_error": error_message,
        }
    )


def create_parse_job_for_application(
    *,
    session: Session,
    application: Application,
    stored_resume: StoredResume,
    uploaded_by: str | None,
) -> ParseJob:
    parse_job = ParseJob(
        vacancy_id=application.vacancy_id,
        file_name=Path(stored_resume.resume_path).name,
        original_file_name=stored_resume.original_filename,
        file_path=stored_resume.resume_path,
        file_checksum=stored_resume.file_checksum,
        mime_type=stored_resume.content_type,
        file_size_bytes=stored_resume.file_size_bytes,
        file_blob_data=stored_resume.file_bytes,
        status="pending",
        candidate_id=application.candidate_id,
        application_id=application.id,
        source="job_application",
        uploaded_by=uploaded_by,
        parsed_data={},
    )
    session.add(parse_job)
    session.commit()
    session.refresh(parse_job)
    return parse_job


def process_candidate_file(
    *,
    session: Session,
    stored_resume: StoredResume,
    source: str,
    source_reference_id: int | None,
    candidate_id: int | None = None,
    application_id: int | None = None,
    vacancy_id: int | None = None,
    submitted_email: str | None = None,
    intake_metadata: dict | None = None,
    parse_job: ParseJob | None = None,
) -> CandidateFileParseResult:
    candidate = session.get(Candidate, candidate_id) if candidate_id is not None else None
    if candidate is None:
        candidate = _find_candidate_by_resume_identity(
            session,
            resume_path=stored_resume.resume_path,
            file_checksum=stored_resume.file_checksum,
        )
    application = session.get(Application, application_id) if application_id is not None else None

    try:
        raw_text, initial_status = extract_resume_text(stored_resume)
        if candidate is None:
            candidate = upsert_placeholder_candidate(
                session,
                email=submitted_email,
                original_filename=stored_resume.original_filename,
                source=source,
                source_reference_id=source_reference_id,
                intake_metadata=intake_metadata,
            )
        if candidate is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found for parsing.")
        if initial_status == "unsupported_format":
            parse_status = "unsupported_format"
            match_status = "pending_manual_review"
            structured_data = {
                "structured_candidate": {},
                "content_type": stored_resume.content_type,
                "file_extension": stored_resume.extension,
            }
            _sync_candidate_metadata(
                candidate=candidate,
                parse_status=parse_status,
                match_status=match_status,
                source=source,
                source_reference_id=source_reference_id,
                stored_resume=stored_resume,
                raw_text=None,
                structured_data=structured_data,
                matched_job_id=None,
                intake_metadata=intake_metadata,
            )
            _store_resume_on_candidate_record(candidate, stored_resume)
            candidate.match_score = None
            session.add(candidate)
            if application:
                _sync_application_metadata(
                    application=application,
                    candidate=candidate,
                    parse_status=parse_status,
                    match_status=match_status,
                    matched_job_id=None,
                    score=None,
                    intake_metadata=intake_metadata,
                )
                session.add(application)
            if parse_job:
                parse_job.status = parse_status
                parse_job.error_message = None
                parse_job.raw_text = None
                parse_job.candidate_id = candidate.id
                parse_job.parsed_data = sanitize_payload(candidate.parsed_data)
                parse_job.parsed_at = datetime.utcnow()
                session.add(parse_job)
            session.commit()
            if application:
                session.refresh(application)
            session.refresh(candidate)
            return CandidateFileParseResult(
                candidate=candidate,
                application=application,
                parse_status=parse_status,
                match_status=match_status,
                matched_job_id=None,
                score=None,
                raw_text=None,
                structured_data=structured_data,
            )

        pdf_content = _build_pdf_content(stored_resume, raw_text or "")
        original_placeholder_id = candidate.id if _is_placeholder_candidate(candidate) else None
        if original_placeholder_id is not None:
            candidate, _, parsed_candidate, _, _, matching = create_candidate_from_cv(
                session=session,
                pdf_content=pdf_content,
                vacancy_id=vacancy_id,
                submitted_email=submitted_email,
            )
        else:
            candidate, _, parsed_candidate, _, _, matching = update_candidate_from_cv(
                session=session,
                candidate_id=candidate.id,
                pdf_content=pdf_content,
                vacancy_id=vacancy_id,
                submitted_email=submitted_email,
            )
        match_status, matched_job_id, score = _resolve_manual_match_state(
            session=session,
            candidate=candidate,
            vacancy_id=vacancy_id,
        )
        parse_status = "parsed"
        structured_data = {
            "structured_candidate": sanitize_payload(parsed_candidate),
            "matching": sanitize_payload(matching) if matching else candidate.parsed_data.get("matching"),
            "content_type": stored_resume.content_type,
            "file_extension": stored_resume.extension,
        }
        candidate.match_score = score
        _store_best_match_on_candidate(
            session=session,
            candidate=candidate,
            matched_job_id=matched_job_id,
            score=score,
            vacancy_id=vacancy_id,
        )
        _sync_candidate_metadata(
            candidate=candidate,
            parse_status=parse_status,
            match_status=match_status,
            source=source,
            source_reference_id=source_reference_id,
            stored_resume=stored_resume,
            raw_text=raw_text,
            structured_data=structured_data,
            matched_job_id=matched_job_id,
            intake_metadata=intake_metadata,
        )
        _store_resume_on_candidate_record(candidate, stored_resume)
        session.add(candidate)
        if application:
            application.candidate_id = candidate.id
            _sync_application_metadata(
                application=application,
                candidate=candidate,
                parse_status=parse_status,
                match_status=match_status,
                matched_job_id=matched_job_id,
                score=score,
                intake_metadata=intake_metadata,
            )
            session.add(application)
        if parse_job:
            parse_job.status = parse_status
            parse_job.error_message = None
            parse_job.raw_text = raw_text
            parse_job.candidate_id = candidate.id
            parse_job.parsed_data = sanitize_payload(candidate.parsed_data)
            parse_job.parsed_at = datetime.utcnow()
            session.add(parse_job)
        session.commit()
        if original_placeholder_id is not None and original_placeholder_id != candidate.id:
            _cleanup_placeholder_candidate(session, session.get(Candidate, original_placeholder_id))
        if application:
            session.refresh(application)
        session.refresh(candidate)
        return CandidateFileParseResult(
            candidate=candidate,
            application=application,
            parse_status=parse_status,
            match_status=match_status,
            matched_job_id=matched_job_id,
            score=score,
            raw_text=raw_text,
            structured_data=structured_data,
        )
    except HTTPException as exc:
        error_message = sanitize_text(str(exc.detail)) or "Candidate parsing failed."
    except Exception as exc:  # pragma: no cover - defensive parser guard
        error_message = sanitize_text(str(exc)) or "Candidate parsing failed."

    session.rollback()
    candidate = session.get(Candidate, candidate.id) if candidate is not None else None
    application = session.get(Application, application.id) if application is not None else None
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message,
        )

    candidate.match_score = None
    _sync_candidate_metadata(
        candidate=candidate,
        parse_status="failed",
        match_status="pending_manual_review",
        source=source,
        source_reference_id=source_reference_id,
        stored_resume=stored_resume,
        raw_text=None,
        structured_data={"structured_candidate": {}},
        matched_job_id=None,
        intake_metadata=intake_metadata,
        error_message=error_message,
    )
    _store_resume_on_candidate_record(candidate, stored_resume)
    session.add(candidate)
    if application:
        _sync_application_metadata(
            application=application,
            candidate=candidate,
            parse_status="failed",
            match_status="pending_manual_review",
            matched_job_id=None,
            score=None,
            intake_metadata=intake_metadata,
            error_message=error_message,
        )
        session.add(application)
    if parse_job:
        parse_job = session.get(ParseJob, parse_job.id) or parse_job
        parse_job.status = "failed"
        parse_job.error_message = error_message
        parse_job.raw_text = None
        parse_job.candidate_id = candidate.id
        parse_job.parsed_data = sanitize_payload(candidate.parsed_data)
        parse_job.parsed_at = datetime.utcnow()
        session.add(parse_job)
    session.commit()
    if application:
        session.refresh(application)
    session.refresh(candidate)
    return CandidateFileParseResult(
        candidate=candidate,
        application=application,
        parse_status="failed",
        match_status="pending_manual_review",
        matched_job_id=None,
        score=None,
        raw_text=None,
        structured_data={},
        error_message=error_message,
    )


def create_candidate_from_stored_resume(
    *,
    session: Session,
    stored_resume: StoredResume,
    vacancy_id: int | None = None,
    submitted_email: str | None = None,
    source: str = "manual_upload",
) -> CandidateFileParseResult:
    return process_candidate_file(
        session=session,
        stored_resume=stored_resume,
        source=source,
        source_reference_id=None,
        candidate_id=None,
        application_id=None,
        vacancy_id=vacancy_id,
        submitted_email=submitted_email,
        intake_metadata=None,
        parse_job=None,
    )
