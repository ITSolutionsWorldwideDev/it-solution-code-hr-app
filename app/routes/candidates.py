import asyncio
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
import requests
from sqlmodel import Session, select

from app.db import engine, get_session
from app.models.candidate import Candidate
from app.models.parse_job import ParseJob
from app.models.vacancy import Vacancy
from app.schemas.candidate_role_suggestion import CandidateRoleSuggestionRead
from app.schemas.candidate import (
    CandidateCVBatchParseFailure,
    CandidateCVQueueBatchResponse,
    CandidateCVQueueJobRead,
    CandidateCVBatchParseResponse,
    CandidateCVParseResponse,
    CandidateCreate,
    CandidateManualImportItem,
    CandidateManualImportResponse,
    CandidateRead,
    CandidateUploadUrlRequest,
    CandidateUpdate,
    ParsedCandidateData,
)
from app.services.ai_service import extract_pdf_content_from_bytes, extract_pdf_content_from_upload, store_pdf_upload
from app.services.candidate_service import (
    backfill_candidate_hidden_potentials,
    create_candidate_from_cv,
    get_candidate_role_suggestions,
    update_candidate_from_cv,
)
from app.services.cv_pipeline_service import create_candidate_from_stored_resume, store_resume_upload
from app.services import crud


router = APIRouter(prefix="/candidates", tags=["Candidates"])
MAX_BATCH_PARSE_CONCURRENCY = 4


def _format_batch_error(error: str) -> str:
    compact = " ".join(error.split())
    if len(compact) <= 220:
        return compact
    return compact[:219].rstrip() + "..."


def _serialize_parse_job(job: ParseJob) -> CandidateCVQueueJobRead:
    return CandidateCVQueueJobRead(
        parse_job_id=job.id,
        vacancy_id=job.vacancy_id,
        file_name=job.file_name,
        original_file_name=job.original_file_name,
        file_path=job.file_path,
        status=job.status,
        candidate_id=job.candidate_id,
        application_id=job.application_id,
        error_message=job.error_message,
        created_at=job.created_at.isoformat() if job.created_at else None,
        updated_at=job.updated_at.isoformat() if job.updated_at else None,
        parsed_at=job.parsed_at.isoformat() if job.parsed_at else None,
    )


def _derive_filename_from_url(url: str, response: requests.Response) -> str:
    content_disposition = response.headers.get("content-disposition", "")
    if "filename=" in content_disposition:
        filename = content_disposition.split("filename=")[-1].strip().strip('"').strip("'")
        if filename:
            return filename

    parsed = urlparse(url)
    path_name = Path(parsed.path).name
    if path_name:
        return path_name

    return "candidate.pdf"


def _download_pdf_from_url(url: str) -> tuple[bytes, str, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid public http(s) URL is required.",
        )

    try:
        response = requests.get(url, timeout=30)
    except requests.Timeout as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timed out while downloading the remote CV URL.",
        ) from exc
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to download the remote CV URL: {exc}",
        ) from exc

    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The remote CV URL returned 404.",
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The remote CV URL returned status {response.status_code}.",
        )

    file_bytes = response.content
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The remote CV file is empty.",
        )

    content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    filename = _derive_filename_from_url(url, response)

    filename_lower = filename.lower()
    if content_type not in {"application/pdf", "application/x-pdf"} and not filename_lower.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The remote file does not appear to be a PDF.",
        )

    if not filename_lower.endswith(".pdf"):
        filename = f"{filename}.pdf"

    normalized_content_type = content_type or "application/pdf"
    return file_bytes, filename, normalized_content_type


def _get_or_create_parse_job(
    *,
    session: Session,
    vacancy_id: int,
    upload_data: dict,
    uploaded_by: str | None,
) -> ParseJob:
    statement = (
        select(ParseJob)
        .where(
            ParseJob.vacancy_id == vacancy_id,
            ParseJob.file_path == upload_data["resume_path"],
        )
        .order_by(ParseJob.id.desc())
    )
    existing_job = session.exec(statement).first()
    if existing_job:
        existing_job.file_name = Path(upload_data["resume_path"]).name
        existing_job.original_file_name = upload_data["original_filename"]
        existing_job.mime_type = upload_data["content_type"]
        existing_job.file_size_bytes = upload_data["file_size_bytes"]
        existing_job.uploaded_by = uploaded_by
        existing_job.source = "manual_upload"
        if existing_job.status == "failed":
            existing_job.status = "uploaded"
            existing_job.error_message = None
            existing_job.candidate_id = None
            existing_job.application_id = None
            existing_job.raw_text = None
            existing_job.parsed_data = {}
            existing_job.parsed_at = None
            existing_job.updated_at = datetime.utcnow()
        session.add(existing_job)
        session.commit()
        session.refresh(existing_job)
        return existing_job

    parse_job = ParseJob(
        vacancy_id=vacancy_id,
        file_name=Path(upload_data["resume_path"]).name,
        original_file_name=upload_data["original_filename"],
        file_path=upload_data["resume_path"],
        mime_type=upload_data["content_type"],
        file_size_bytes=upload_data["file_size_bytes"],
        status="uploaded",
        source="manual_upload",
        uploaded_by=uploaded_by,
    )
    session.add(parse_job)
    session.commit()
    session.refresh(parse_job)
    return parse_job


@router.get("/", response_model=list[CandidateRead], summary="List candidates", description="Return all candidates.")
def list_candidates(session: Session = Depends(get_session)):
    return crud.get_all(session, Candidate)


@router.post(
    "/backfill-hidden-potentials",
    summary="Backfill hidden-potential matches",
    description="Recompute applied match, hidden potential, and overall talent insights for existing candidates.",
)
def backfill_hidden_potentials(
    candidate_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    return backfill_candidate_hidden_potentials(session, candidate_id=candidate_id)


@router.get(
    "/parse-jobs",
    response_model=list[CandidateCVQueueJobRead],
    summary="List parse jobs",
    description="Return stored parse jobs, optionally filtered by vacancy.",
)
def list_parse_jobs(
    vacancy_id: int | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    query = session.query(ParseJob)
    if vacancy_id is not None:
        query = query.filter(ParseJob.vacancy_id == vacancy_id)

    jobs = (
        query.order_by(ParseJob.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_parse_job(job) for job in jobs]


@router.post(
    "/queue-parse-cv",
    response_model=CandidateCVQueueJobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload CV and create parse job",
    description="Store one PDF and create a parse_jobs record so n8n can process it asynchronously.",
)
async def queue_candidate_cv_parse(
    file: UploadFile = File(...),
    vacancy_id: int = Form(...),
    uploaded_by: str | None = Form(default=None),
    candidate_email: str = Form(...),
    location: str | None = Form(default=None),
    work_authorization: str | None = Form(default=None),
    notice_period: str | None = Form(default=None),
    session: Session = Depends(get_session),
):
    crud.get_or_404(session, Vacancy, vacancy_id)
    upload_data = await store_pdf_upload(file)
    parse_job = _get_or_create_parse_job(
        session=session,
        vacancy_id=vacancy_id,
        upload_data=upload_data,
        uploaded_by=uploaded_by,
    )
    intake_metadata = {
        "candidate_email": candidate_email,
        "location": location,
        "work_authorization": work_authorization,
        "notice_period": notice_period,
    }
    parse_job.parsed_data = {
        **(parse_job.parsed_data or {}),
        "intake_metadata": {key: value for key, value in intake_metadata.items() if value},
    }
    session.add(parse_job)
    session.commit()
    session.refresh(parse_job)
    return _serialize_parse_job(parse_job)


@router.post(
    "/queue-parse-cv-batch",
    response_model=CandidateCVQueueBatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload CVs and create parse jobs",
    description="Store multiple PDFs and create parse_jobs rows so n8n can process them asynchronously.",
)
async def queue_candidate_cv_parse_batch(
    files: list[UploadFile] = File(...),
    vacancy_id: int = Form(...),
    uploaded_by: str | None = Form(default=None),
    candidate_email: str | None = Form(default=None),
    location: str | None = Form(default=None),
    work_authorization: str | None = Form(default=None),
    notice_period: str | None = Form(default=None),
    session: Session = Depends(get_session),
):
    crud.get_or_404(session, Vacancy, vacancy_id)
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one PDF must be uploaded.",
        )

    jobs: list[CandidateCVQueueJobRead] = []
    for file in files:
        try:
            upload_data = await store_pdf_upload(file)
        finally:
            await file.close()
        parse_job = _get_or_create_parse_job(
            session=session,
            vacancy_id=vacancy_id,
            upload_data=upload_data,
            uploaded_by=uploaded_by,
        )
        intake_metadata = {
            "candidate_email": candidate_email,
            "location": location,
            "work_authorization": work_authorization,
            "notice_period": notice_period,
        }
        parse_job.parsed_data = {
            **(parse_job.parsed_data or {}),
            "intake_metadata": {key: value for key, value in intake_metadata.items() if value},
        }
        session.add(parse_job)
        session.commit()
        session.refresh(parse_job)
        jobs.append(_serialize_parse_job(parse_job))

    return CandidateCVQueueBatchResponse(
        total_files=len(files),
        queued_count=len(jobs),
        jobs=jobs,
    )


@router.post(
    "/manual-import",
    response_model=CandidateManualImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import one or many CVs manually",
    description="Use the shared CV parse pipeline for HR manual uploads and return a status for each file.",
)
async def manual_import_candidates(
    files: list[UploadFile] = File(...),
    vacancy_id: int | None = Form(default=None),
    session: Session = Depends(get_session),
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one CV must be uploaded.",
        )

    if vacancy_id is not None:
        crud.get_or_404(session, Vacancy, vacancy_id)

    results: list[CandidateManualImportItem] = []
    for file in files:
        original_filename = file.filename or "unknown-file"
        try:
            stored_resume = await store_resume_upload(file)
            result = create_candidate_from_stored_resume(
                session=session,
                vacancy_id=vacancy_id,
                source="manual_upload",
            )
            results.append(
                CandidateManualImportItem(
                    filename=stored_resume.original_filename,
                    parse_status=result.parse_status,
                    match_status=result.match_status,
                    candidate_id=result.candidate.id,
                    candidate_name=result.candidate.name,
                    candidate_email=result.candidate.email,
                    ai_summary=result.candidate.ai_summary,
                    skills=result.candidate.skills,
                    experience=result.candidate.experience,
                    education=result.candidate.education,
                    parsed_data=result.candidate.parsed_data,
                    matched_job_id=result.matched_job_id,
                    score=result.score,
                    error_message=result.error_message,
                )
            )
        except HTTPException as exc:
            results.append(
                CandidateManualImportItem(
                    filename=original_filename,
                    parse_status="failed",
                    match_status="pending_manual_review",
                    error_message=str(exc.detail),
                )
            )
        except Exception as exc:  # pragma: no cover - defensive batch import guard
            results.append(
                CandidateManualImportItem(
                    filename=original_filename,
                    parse_status="failed",
                    match_status="pending_manual_review",
                    error_message=str(exc),
                )
            )

    return CandidateManualImportResponse(
        total_files=len(files),
        results=results,
    )


@router.post("/", response_model=CandidateRead, status_code=status.HTTP_201_CREATED, summary="Create candidate", description="Create a candidate manually.")
def create_candidate(payload: CandidateCreate, session: Session = Depends(get_session)):
    return crud.create(session, Candidate, payload.model_dump())


@router.post(
    "/upload-url",
    response_model=CandidateCVParseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Download and parse CV from URL",
    description=(
        "Download a remote public PDF CV by URL, reuse the existing parser and candidate storage flow, "
        "and store the candidate directly in the central candidate database."
    ),
)
def upload_candidate_cv_from_url(
    payload: CandidateUploadUrlRequest,
    session: Session = Depends(get_session),
):
    file_bytes, filename, content_type = _download_pdf_from_url(payload.url)
    pdf_content = extract_pdf_content_from_bytes(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
    )
    cv_text = pdf_content["extracted_text"]

    if payload.candidate_id:
        candidate, vacancy, parsed_candidate, match, role_suggestions, matching = update_candidate_from_cv(
            session=session,
            candidate_id=payload.candidate_id,
            pdf_content=pdf_content,
            vacancy_id=None,
        )
    else:
        candidate, vacancy, parsed_candidate, match, role_suggestions, matching = create_candidate_from_cv(
            session=session,
            pdf_content=pdf_content,
            vacancy_id=None,
        )

    return CandidateCVParseResponse(
        candidate=candidate,
        vacancy=vacancy,
        match=match,
        matching=matching,
        role_suggestions=role_suggestions,
        extracted_text_preview=cv_text[:500],
        parsed_candidate=ParsedCandidateData(
            name=parsed_candidate.get("name"),
            email=parsed_candidate.get("email"),
            phone=parsed_candidate.get("phone"),
            skills=parsed_candidate.get("skills", []),
            experience=parsed_candidate.get("experience"),
            education=parsed_candidate.get("education"),
            ai_summary=candidate.ai_summary,
            match_score=candidate.match_score,
            parsed_data=candidate.parsed_data,
        ),
    )


@router.post(
    "/parse-cv",
    response_model=CandidateCVParseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse CV",
    description=(
        "Upload a PDF CV, extract text, parse candidate details, generate an English AI summary, "
        "calculate a prototype match score, and save the result to a candidate record."
    ),
)
async def parse_candidate_cv(
    file: UploadFile = File(...),
    vacancy_id: int | None = Form(default=None),
    candidate_id: int | None = Form(default=None),
    session: Session = Depends(get_session),
):
    pdf_content = await extract_pdf_content_from_upload(file)
    cv_text = pdf_content["extracted_text"]
    if candidate_id:
        candidate, vacancy, parsed_candidate, match, role_suggestions, matching = update_candidate_from_cv(
            session=session,
            candidate_id=candidate_id,
            pdf_content=pdf_content,
            vacancy_id=vacancy_id,
        )
    else:
        candidate, vacancy, parsed_candidate, match, role_suggestions, matching = create_candidate_from_cv(
            session=session,
            pdf_content=pdf_content,
            vacancy_id=vacancy_id,
        )

    return CandidateCVParseResponse(
        candidate=candidate,
        vacancy=vacancy,
        match=match,
        matching=matching,
        role_suggestions=role_suggestions,
        extracted_text_preview=cv_text[:500],
        parsed_candidate=ParsedCandidateData(
            name=parsed_candidate.get("name"),
            email=parsed_candidate.get("email"),
            phone=parsed_candidate.get("phone"),
            skills=parsed_candidate.get("skills", []),
            experience=parsed_candidate.get("experience"),
            education=parsed_candidate.get("education"),
            ai_summary=candidate.ai_summary,
            match_score=candidate.match_score,
            parsed_data=candidate.parsed_data,
        ),
    )


@router.post(
    "/parse-cv-batch",
    response_model=CandidateCVBatchParseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse CVs in bulk",
    description=(
        "Upload multiple PDF CVs, extract text, parse candidate details, and store each result "
        "against the selected vacancy."
    ),
)
async def parse_candidate_cv_batch(
    files: list[UploadFile] = File(...),
    vacancy_id: int | None = Form(default=None),
    session: Session = Depends(get_session),
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one PDF must be uploaded.",
        )

    semaphore = asyncio.Semaphore(MAX_BATCH_PARSE_CONCURRENCY)
    file_payloads = []

    for file in files:
        try:
            file_payloads.append(
                {
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "file_bytes": await file.read(),
                }
            )
        finally:
            await file.close()

    async def process_single_file(file_payload: dict) -> CandidateCVParseResponse | CandidateCVBatchParseFailure:
        async with semaphore:
            return await asyncio.to_thread(
                _parse_batch_file_sync,
                file_payload["filename"],
                file_payload["content_type"],
                file_payload["file_bytes"],
                vacancy_id,
            )

    processed = await asyncio.gather(*(process_single_file(payload) for payload in file_payloads))
    results = [item for item in processed if isinstance(item, CandidateCVParseResponse)]
    failures = [item for item in processed if isinstance(item, CandidateCVBatchParseFailure)]

    return CandidateCVBatchParseResponse(
        total_files=len(files),
        success_count=len(results),
        failure_count=len(failures),
        results=results,
        failures=failures,
    )


def _parse_batch_file_sync(
    filename: str | None,
    content_type: str | None,
    file_bytes: bytes,
    vacancy_id: int | None,
) -> CandidateCVParseResponse | CandidateCVBatchParseFailure:
    try:
        pdf_content = extract_pdf_content_from_bytes(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
        )

        with Session(engine) as batch_session:
            candidate, vacancy, parsed_candidate, match, role_suggestions, matching = create_candidate_from_cv(
                session=batch_session,
                pdf_content=pdf_content,
                vacancy_id=vacancy_id,
            )

            return CandidateCVParseResponse(
                candidate=candidate,
                vacancy=vacancy,
                match=match,
                matching=matching,
                role_suggestions=role_suggestions,
                extracted_text_preview=pdf_content["extracted_text"][:320],
                parsed_candidate=ParsedCandidateData(
                    name=parsed_candidate.get("name"),
                    email=parsed_candidate.get("email"),
                    phone=parsed_candidate.get("phone"),
                    skills=parsed_candidate.get("skills", []),
                    experience=parsed_candidate.get("experience"),
                    education=parsed_candidate.get("education"),
                    ai_summary=candidate.ai_summary,
                    match_score=candidate.match_score,
                    parsed_data=candidate.parsed_data,
                ),
            )
    except HTTPException as exc:
        return CandidateCVBatchParseFailure(
            filename=filename or "unknown-file.pdf",
            error=_format_batch_error(str(exc.detail)),
        )
    except Exception as exc:  # pragma: no cover - defensive bulk upload guard
        return CandidateCVBatchParseFailure(
            filename=filename or "unknown-file.pdf",
            error=_format_batch_error(str(exc)),
        )


@router.get("/{candidate_id}", response_model=CandidateRead, summary="Get candidate", description="Return a candidate by ID.")
def get_candidate(candidate_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, Candidate, candidate_id)


@router.get(
    "/{candidate_id}/role-suggestions",
    response_model=list[CandidateRoleSuggestionRead],
    summary="List candidate role suggestions",
    description="Return AI-generated potential role suggestions for a candidate.",
)
def list_candidate_role_suggestions(candidate_id: int, session: Session = Depends(get_session)):
    return get_candidate_role_suggestions(session, candidate_id)


@router.put("/{candidate_id}", response_model=CandidateRead, summary="Update candidate", description="Update an existing candidate.")
def update_candidate(candidate_id: int, payload: CandidateUpdate, session: Session = Depends(get_session)):
    candidate = crud.get_or_404(session, Candidate, candidate_id)
    return crud.update(session, candidate, payload.model_dump(exclude_unset=True))


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete candidate", description="Delete a candidate by ID.")
def delete_candidate(candidate_id: int, session: Session = Depends(get_session)):
    candidate = crud.get_or_404(session, Candidate, candidate_id)
    crud.delete(session, candidate)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
