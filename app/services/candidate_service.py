from __future__ import annotations

from pathlib import Path
from zlib import adler32

from sqlalchemy import delete
from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.candidate_match import CandidateMatch
from app.models.candidate_role_suggestion import CandidateRoleSuggestion
from app.models.enums import VacancyStatus
from app.models.vacancy import Vacancy
from app.schemas.candidate import CandidateCreate
from app.services.ai_service import (
    apply_parsed_data_to_candidate,
    build_parsed_data,
    extract_pdf_content,
    sanitize_payload,
    sanitize_text,
)
from app.services.crud import get_or_404
from app.services.openai_service import CandidateParseResult, format_resume_preview, parse_candidate_with_openai


def create_candidate_from_cv(
    session: Session,
    pdf_content: dict,
    vacancy_id: int | None = None,
    submitted_email: str | None = None,
) -> tuple[Candidate, Vacancy | None, dict, CandidateMatch | None, list[CandidateRoleSuggestion], dict | None]:
    vacancy = get_or_404(session, Vacancy, vacancy_id) if vacancy_id else None
    cv_text = pdf_content["extracted_text"]
    parse_result = _parse_resume_with_context(session, cv_text, vacancy)
    parsed_candidate = sanitize_payload(parse_result.model_dump())
    if submitted_email:
        parsed_candidate["email"] = sanitize_text(submitted_email) or parsed_candidate.get("email")
    parsed_data = build_parsed_data(pdf_content, parsed_candidate, vacancy)
    if parse_result.matching_result:
        parsed_data["matching"] = sanitize_payload(parse_result.matching_result.model_dump())
    parsed_data["formatted_resume_preview"] = format_resume_preview(cv_text)
    existing_candidate = _find_existing_candidate(
        session,
        email=parsed_candidate.get("email"),
        resume_path=pdf_content.get("resume_path"),
        file_checksum=pdf_content.get("file_checksum"),
    )

    if existing_candidate is not None:
        apply_parsed_data_to_candidate(
            existing_candidate,
            parsed_candidate,
            parsed_candidate.get("ai_summary"),
            parsed_candidate.get("match_score", 0.0),
            parsed_data,
        )
        session.add(existing_candidate)
        session.commit()
        session.refresh(existing_candidate)

        role_suggestions = _replace_role_suggestions(
            session, existing_candidate.id, parse_result.role_suggestions
        )
        applied_match = _upsert_candidate_matches(session, existing_candidate.id, parse_result, vacancy)
        session.refresh(existing_candidate)
        return (
            existing_candidate,
            vacancy,
            parsed_candidate,
            applied_match,
            role_suggestions,
            parse_result.matching_result.model_dump() if parse_result.matching_result else None,
        )

    payload = CandidateCreate(
        name=sanitize_text(parsed_candidate.get("name")) or "Unknown Candidate",
        email=sanitize_text(parsed_candidate.get("email")) or _build_resume_fallback_email(pdf_content),
        phone=sanitize_text(parsed_candidate.get("phone")),
        skills=parsed_candidate.get("skills", []),
        experience=sanitize_text(parsed_candidate.get("experience")),
        education=sanitize_text(parsed_candidate.get("education")),
        ai_summary=sanitize_text(parsed_candidate.get("ai_summary")),
        match_score=parsed_candidate.get("match_score"),
        parsed_data=parsed_data,
    )
    candidate = Candidate(**payload.model_dump())
    session.add(candidate)
    session.commit()
    session.refresh(candidate)

    role_suggestions = _replace_role_suggestions(session, candidate.id, parse_result.role_suggestions)
    applied_match = _upsert_candidate_matches(session, candidate.id, parse_result, vacancy)
    session.refresh(candidate)
    return (
        candidate,
        vacancy,
        parsed_candidate,
        applied_match,
        role_suggestions,
        parse_result.matching_result.model_dump() if parse_result.matching_result else None,
    )


def update_candidate_from_cv(
    session: Session,
    candidate_id: int,
    pdf_content: dict,
    vacancy_id: int | None = None,
    submitted_email: str | None = None,
) -> tuple[Candidate, Vacancy | None, dict, CandidateMatch | None, list[CandidateRoleSuggestion], dict | None]:
    candidate = get_or_404(session, Candidate, candidate_id)
    vacancy = get_or_404(session, Vacancy, vacancy_id) if vacancy_id else None

    cv_text = pdf_content["extracted_text"]
    parse_result = _parse_resume_with_context(session, cv_text, vacancy)
    parsed_candidate = sanitize_payload(parse_result.model_dump())
    if submitted_email:
        parsed_candidate["email"] = sanitize_text(submitted_email) or parsed_candidate.get("email")
    parsed_data = build_parsed_data(pdf_content, parsed_candidate, vacancy)
    if parse_result.matching_result:
        parsed_data["matching"] = sanitize_payload(parse_result.matching_result.model_dump())
    parsed_data["formatted_resume_preview"] = format_resume_preview(cv_text)

    apply_parsed_data_to_candidate(
        candidate,
        parsed_candidate,
        parsed_candidate.get("ai_summary"),
        parsed_candidate.get("match_score", 0.0),
        parsed_data,
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)

    role_suggestions = _replace_role_suggestions(session, candidate.id, parse_result.role_suggestions)
    applied_match = _upsert_candidate_matches(session, candidate.id, parse_result, vacancy)
    session.refresh(candidate)
    return (
        candidate,
        vacancy,
        parsed_candidate,
        applied_match,
        role_suggestions,
        parse_result.matching_result.model_dump() if parse_result.matching_result else None,
    )


def get_candidate_role_suggestions(session: Session, candidate_id: int) -> list[CandidateRoleSuggestion]:
    get_or_404(session, Candidate, candidate_id)
    statement = (
        select(CandidateRoleSuggestion)
        .where(CandidateRoleSuggestion.candidate_id == candidate_id)
        .order_by(CandidateRoleSuggestion.confidence_score.desc())
    )
    return list(session.exec(statement).all())


def get_vacancy_matches(session: Session, vacancy_id: int) -> list[CandidateMatch]:
    get_or_404(session, Vacancy, vacancy_id)
    statement = (
        select(CandidateMatch)
        .where(CandidateMatch.vacancy_id == vacancy_id)
        .order_by(CandidateMatch.match_score.desc(), CandidateMatch.created_at.desc())
    )
    return list(session.exec(statement).all())


def backfill_candidate_hidden_potentials(
    session: Session,
    *,
    candidate_id: int | None = None,
) -> dict[str, object]:
    candidates = (
        [get_or_404(session, Candidate, candidate_id)]
        if candidate_id is not None
        else list(session.exec(select(Candidate)).all())
    )

    processed = 0
    skipped: list[dict[str, object]] = []

    for candidate in candidates:
        resume_path_value = candidate.parsed_data.get("resume_path") if candidate.parsed_data else None
        if not isinstance(resume_path_value, str) or not resume_path_value.strip():
            skipped.append({"candidate_id": candidate.id, "reason": "Missing resume_path in parsed_data."})
            continue

        resume_path = Path(resume_path_value)
        if not resume_path.exists():
            skipped.append({"candidate_id": candidate.id, "reason": f"Resume file not found at {resume_path_value}."})
            continue

        application = session.exec(
            select(Application)
            .where(Application.candidate_id == candidate.id)
            .order_by(Application.created_at.desc())
        ).first()
        fallback_vacancy_id = candidate.parsed_data.get("vacancy_context", {}).get("vacancy_id") if candidate.parsed_data else None
        vacancy_id = application.vacancy_id if application else (int(fallback_vacancy_id) if fallback_vacancy_id else None)

        pdf_content = extract_pdf_content(resume_path.read_bytes())
        pdf_content.update(
            {
                "filename": candidate.parsed_data.get("filename"),
                "content_type": candidate.parsed_data.get("content_type") or "application/pdf",
                "resume_path": str(resume_path),
            }
        )

        update_candidate_from_cv(
            session=session,
            candidate_id=candidate.id,
            pdf_content=pdf_content,
            vacancy_id=vacancy_id,
            submitted_email=candidate.email,
        )

        candidate_matches = {
            match.vacancy_id: match
            for match in session.exec(
                select(CandidateMatch).where(CandidateMatch.candidate_id == candidate.id)
            ).all()
        }
        applications = list(
            session.exec(select(Application).where(Application.candidate_id == candidate.id)).all()
        )
        for item in applications:
            linked_match = candidate_matches.get(item.vacancy_id)
            if not linked_match:
                continue
            item.match_score = linked_match.match_score
            item.ai_summary = linked_match.ai_summary
            item.parsed_data = sanitize_payload(
                {
                    **(item.parsed_data or {}),
                    "matching": candidate.parsed_data.get("matching") if candidate.parsed_data else None,
                    "applied_fit_explanation": linked_match.fit_explanation,
                    "matched_skills": linked_match.matched_skills,
                }
            )
            session.add(item)

        session.commit()
        processed += 1

    return {
        "processed_count": processed,
        "skipped_count": len(skipped),
        "skipped": skipped,
    }


def _parse_resume_with_context(session: Session, cv_text: str, vacancy: Vacancy | None) -> CandidateParseResult:
    active_vacancies = list(
        session.exec(select(Vacancy).where(Vacancy.status == VacancyStatus.OPEN)).all()
    )
    vacancy_context = (
        {
            "id": vacancy.id,
            "title": vacancy.title,
            "required_skills": vacancy.required_skills,
            "experience_level": vacancy.experience_level,
            "description": vacancy.description,
        }
        if vacancy
        else None
    )
    active_vacancy_contexts = [
        {
            "id": item.id,
            "title": item.title,
            "required_skills": item.required_skills,
            "experience_level": item.experience_level,
            "description": item.description,
        }
        for item in active_vacancies
    ]
    return parse_candidate_with_openai(
        cv_text=cv_text,
        vacancy_context=vacancy_context,
        active_vacancies=active_vacancy_contexts,
    )


def _replace_role_suggestions(
    session: Session,
    candidate_id: int,
    suggestions: list,
) -> list[CandidateRoleSuggestion]:
    session.exec(delete(CandidateRoleSuggestion).where(CandidateRoleSuggestion.candidate_id == candidate_id))
    session.commit()

    records: list[CandidateRoleSuggestion] = []
    for suggestion in suggestions:
        record = CandidateRoleSuggestion(
            candidate_id=candidate_id,
            role_title=suggestion.role_title,
            department=suggestion.department,
            confidence_score=suggestion.confidence_score,
            reason=suggestion.reason,
        )
        session.add(record)
        records.append(record)

    if records:
        session.commit()
        for record in records:
            session.refresh(record)

    return records


def _upsert_candidate_matches(
    session: Session,
    candidate_id: int,
    parse_result: CandidateParseResult,
    applied_vacancy: Vacancy | None,
) -> CandidateMatch | None:
    if not parse_result.vacancy_matches:
        return None

    applied_match_row: CandidateMatch | None = None
    for vacancy_match in parse_result.vacancy_matches:
        statement = select(CandidateMatch).where(
            CandidateMatch.candidate_id == candidate_id,
            CandidateMatch.vacancy_id == vacancy_match.vacancy_id,
        )
        match = session.exec(statement).first()

        if match is None:
            match = CandidateMatch(
                candidate_id=candidate_id,
                vacancy_id=vacancy_match.vacancy_id,
                match_score=vacancy_match.score,
            )

        match.match_score = vacancy_match.score
        match.ai_summary = vacancy_match.ai_summary
        match.fit_explanation = vacancy_match.fit_explanation
        match.matched_skills = vacancy_match.matched_skills

        session.add(match)
        session.commit()
        session.refresh(match)

        if applied_vacancy and vacancy_match.vacancy_id == applied_vacancy.id:
            applied_match_row = match

    return applied_match_row


def _build_resume_fallback_email(pdf_content: dict) -> str:
    seed = pdf_content.get("resume_path") or pdf_content.get("filename") or "resume"
    checksum = adler32(seed.encode("utf-8")) & 0xFFFFFFFF
    return f"candidate-{checksum}@placeholder.local"


def _find_existing_candidate_by_email(session: Session, email: str | None) -> Candidate | None:
    if not email:
        return None

    statement = select(Candidate).where(Candidate.email == email)
    return session.exec(statement).first()


def _find_existing_candidate_by_resume_identity(
    session: Session,
    *,
    resume_path: str | None,
    file_checksum: str | None,
) -> Candidate | None:
    candidates = list(session.exec(select(Candidate)).all())
    for candidate in candidates:
        parsed_data = candidate.parsed_data or {}
        parsed_resume_path = parsed_data.get("resume_path")
        parsed_file_checksum = parsed_data.get("file_checksum")
        if file_checksum and parsed_file_checksum == file_checksum:
            return candidate
        if resume_path and parsed_resume_path == resume_path:
            return candidate
    return None


def _find_existing_candidate(
    session: Session,
    *,
    email: str | None,
    resume_path: str | None,
    file_checksum: str | None,
) -> Candidate | None:
    by_resume = _find_existing_candidate_by_resume_identity(
        session,
        resume_path=resume_path,
        file_checksum=file_checksum,
    )
    if by_resume is not None:
        return by_resume
    return _find_existing_candidate_by_email(session, email)
