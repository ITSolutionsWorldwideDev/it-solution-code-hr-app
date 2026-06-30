import asyncio
from datetime import datetime
from io import BytesIO
from pathlib import Path
import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
import requests
from sqlmodel import Session, select

from app.config import settings
from app.db import engine, get_session
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy
from app.schemas.candidate_role_suggestion import CandidateRoleSuggestionRead
from app.schemas.candidate import (
    CandidateDatabaseResponseRead,
    CandidateCVBatchParseFailure,
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
from app.services.candidate_database_service import get_candidate_database_payload
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
CHECKSUM_PATTERN = re.compile(r"^[a-f0-9]{64}$")


def _format_batch_error(error: str) -> str:
    compact = " ".join(error.split())
    if len(compact) <= 220:
        return compact
    return compact[:219].rstrip() + "..."


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


def _resolve_resume_file_from_checksum(checksum: str) -> Path:
    normalized_checksum = checksum.strip().lower()
    if not CHECKSUM_PATTERN.fullmatch(normalized_checksum):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file checksum.",
        )

    for path in settings.resume_upload_dir.glob(f"{normalized_checksum}.*"):
        if path.is_file():
            return path

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No stored CV was found for this checksum.",
    )


def _guess_media_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == ".doc":
        return "application/msword"
    return "application/octet-stream"


def _resolve_original_resume_filename(session: Session, file_checksum: str, fallback_path: Path) -> str:
    candidates = session.exec(select(Candidate)).all()
    for candidate in candidates:
        parsed_data = candidate.parsed_data or {}
        if (candidate.resume_file_checksum or parsed_data.get("file_checksum")) != file_checksum:
            continue

        if candidate.resume_file_name:
            return Path(candidate.resume_file_name).name
        for key in ("original_file_name", "filename"):
            value = parsed_data.get(key)
            if isinstance(value, str) and value.strip():
                return Path(value.strip()).name

    return fallback_path.name


def _find_candidate_resume_by_checksum(session: Session, file_checksum: str) -> Candidate | None:
    candidate = session.exec(
        select(Candidate).where(Candidate.resume_file_checksum == file_checksum)
    ).first()
    if candidate is not None:
        return candidate

    candidates = session.exec(select(Candidate)).all()
    for item in candidates:
        parsed_data = item.parsed_data or {}
        if parsed_data.get("file_checksum") == file_checksum:
            return item
    return None


@router.get("/", response_model=list[CandidateRead], summary="List candidates", description="Return all candidates.")
def list_candidates(session: Session = Depends(get_session)):
    return crud.get_all(session, Candidate)


@router.get(
    "/database",
    response_model=CandidateDatabaseResponseRead,
    summary="Get candidate database payload",
    description="Return a prebuilt, lightweight candidate database payload for the frontend table view.",
)
def get_candidate_database(session: Session = Depends(get_session)):
    return get_candidate_database_payload(session)


@router.get(
    "/files/{file_checksum}",
    summary="View stored candidate CV",
    description="Return the stored original CV file for a candidate based on its file checksum.",
)
def get_candidate_cv_file(
    file_checksum: str,
    download: bool = Query(default=False),
    session: Session = Depends(get_session),
):
    normalized_checksum = file_checksum.strip().lower()
    candidate = _find_candidate_resume_by_checksum(session, normalized_checksum)
    if candidate is not None and candidate.resume_file_data:
        filename = _resolve_original_resume_filename(session, normalized_checksum, Path(f"{normalized_checksum}.bin"))
        media_type = candidate.resume_content_type or "application/octet-stream"
        disposition = "attachment" if download else "inline"
        response = StreamingResponse(BytesIO(bytes(candidate.resume_file_data)), media_type=media_type)
        response.headers["Content-Disposition"] = f'{disposition}; filename="{filename}"'
        return response

    resume_path = _resolve_resume_file_from_checksum(normalized_checksum)
    filename = _resolve_original_resume_filename(session, normalized_checksum, resume_path)
    return FileResponse(
        path=resume_path,
        media_type=_guess_media_type(resume_path),
        filename=filename,
        content_disposition_type="attachment" if download else "inline",
    )


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
                stored_resume=stored_resume,
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
                    error_message=_format_batch_error(str(exc.detail)),
                )
            )
        except Exception as exc:  # pragma: no cover - defensive batch import guard
            results.append(
                CandidateManualImportItem(
                    filename=original_filename,
                    parse_status="failed",
                    match_status="pending_manual_review",
                    error_message=_format_batch_error(str(exc)),
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
