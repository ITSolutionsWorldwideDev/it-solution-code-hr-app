from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zlib import adler32

from sqlalchemy import delete
from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.candidate_match import CandidateMatch
from app.models.candidate_role_suggestion import CandidateRoleSuggestion
from app.models.enums import VacancyStatus
from app.models.employee import Employee
from app.models.parse_job import ParseJob
from app.models.potential_match import PotentialMatch
from app.models.vacancy import Vacancy
from app.schemas.candidate import CandidateCreate
from app.services.ai_service import (
    apply_parsed_data_to_candidate,
    build_parsed_data,
    calculate_match_score,
    extract_pdf_content,
    generate_ai_summary,
    parse_candidate_text,
    sanitize_payload,
    sanitize_text,
)
from app.services.crud import get_or_404
from app.services.openai_service import CandidateParseResult, parse_candidate_with_openai


def create_candidate_from_cv(
    session: Session,
    pdf_content: dict,
    vacancy_id: int | None = None,
    submitted_email: str | None = None,
) -> tuple[Candidate, Vacancy | None, dict, CandidateMatch | None, list[CandidateRoleSuggestion], dict | None]:
    vacancy = get_or_404(session, Vacancy, vacancy_id) if vacancy_id else None
    cv_text = pdf_content["extracted_text"]
    parse_result = _parse_resume_with_context(session, cv_text, vacancy)
    resolved_vacancy = _resolve_selected_vacancy(session, vacancy, parse_result)
    parsed_candidate = _parsed_candidate_payload(parse_result)
    if submitted_email:
        parsed_candidate["email"] = sanitize_text(submitted_email) or parsed_candidate.get("email")
    parsed_data = build_parsed_data(pdf_content, parsed_candidate, resolved_vacancy)
    if parse_result.matching_result:
        parsed_data["matching"] = sanitize_payload(parse_result.matching_result.model_dump())
    parsed_data["formatted_resume_preview"] = sanitize_text(cv_text[:5000]) or cv_text[:5000]
    existing_candidate = _find_existing_candidate(
        session,
        email=parsed_candidate.get("email"),
        resume_path=pdf_content.get("resume_path"),
        file_checksum=pdf_content.get("file_checksum"),
    )
    existing_candidate = _resolve_email_conflict_candidate(
        session,
        candidate=existing_candidate,
        parsed_email=parsed_candidate.get("email"),
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
        applied_match = _upsert_candidate_matches(session, existing_candidate.id, parse_result, resolved_vacancy)
        session.refresh(existing_candidate)
        return (
            existing_candidate,
            resolved_vacancy,
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
    applied_match = _upsert_candidate_matches(session, candidate.id, parse_result, resolved_vacancy)
    session.refresh(candidate)
    return (
        candidate,
        resolved_vacancy,
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
    resolved_vacancy = _resolve_selected_vacancy(session, vacancy, parse_result)
    parsed_candidate = _parsed_candidate_payload(parse_result)
    if submitted_email:
        parsed_candidate["email"] = sanitize_text(submitted_email) or parsed_candidate.get("email")
    parsed_data = build_parsed_data(pdf_content, parsed_candidate, resolved_vacancy)
    if parse_result.matching_result:
        parsed_data["matching"] = sanitize_payload(parse_result.matching_result.model_dump())
    parsed_data["formatted_resume_preview"] = sanitize_text(cv_text[:5000]) or cv_text[:5000]
    candidate = _resolve_email_conflict_candidate(
        session,
        candidate=candidate,
        parsed_email=parsed_candidate.get("email"),
    )

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
    applied_match = _upsert_candidate_matches(session, candidate.id, parse_result, resolved_vacancy)
    session.refresh(candidate)
    return (
        candidate,
        resolved_vacancy,
        parsed_candidate,
        applied_match,
        role_suggestions,
        parse_result.matching_result.model_dump() if parse_result.matching_result else None,
    )


def _parsed_candidate_payload(parse_result: CandidateParseResult) -> dict:
    return sanitize_payload(
        {
            "name": parse_result.name,
            "email": parse_result.email,
            "phone": parse_result.phone,
            "skills": parse_result.skills[:10],
            "experience": parse_result.experience,
            "education": parse_result.education,
            "ai_summary": parse_result.ai_summary,
            "match_score": parse_result.match_score,
            "fit_explanation": parse_result.fit_explanation,
            "pros": parse_result.pros,
            "cons": parse_result.cons,
            "experience_years": parse_result.experience_years,
            "selected_vacancy_id": parse_result.selected_vacancy_id,
            "selected_vacancy_title": parse_result.selected_vacancy_title,
            "matched_skills": parse_result.matched_skills,
        }
    )


def _resolve_selected_vacancy(
    session: Session,
    vacancy: Vacancy | None,
    parse_result: CandidateParseResult,
) -> Vacancy | None:
    if vacancy is not None:
        return vacancy
    if parse_result.selected_vacancy_id is None:
        return None
    return session.get(Vacancy, parse_result.selected_vacancy_id)


def create_candidate_from_cv_fast(
    session: Session,
    pdf_content: dict,
    vacancy_id: int | None = None,
    submitted_email: str | None = None,
) -> tuple[Candidate, Vacancy | None, dict, CandidateMatch | None, list[CandidateRoleSuggestion], dict | None]:
    vacancy = get_or_404(session, Vacancy, vacancy_id) if vacancy_id else None
    cv_text = pdf_content["extracted_text"]
    parsed_candidate = sanitize_payload(parse_candidate_text(cv_text))
    if submitted_email:
        parsed_candidate["email"] = sanitize_text(submitted_email) or parsed_candidate.get("email")

    matched_skills = _compute_matched_skills(parsed_candidate, vacancy)
    match_score = calculate_match_score(parsed_candidate, vacancy)
    fit_explanation = _build_fast_fit_explanation(vacancy, matched_skills)
    ai_summary = generate_ai_summary(parsed_candidate, vacancy)

    parsed_candidate["ai_summary"] = ai_summary
    parsed_candidate["match_score"] = match_score
    parsed_candidate["fit_explanation"] = fit_explanation

    parsed_data = build_parsed_data(pdf_content, parsed_candidate, vacancy)
    parsed_data["fit_explanation"] = fit_explanation
    parsed_data["formatted_resume_preview"] = sanitize_text(cv_text[:5000]) or cv_text[:5000]
    if vacancy:
        parsed_data["matching"] = sanitize_payload(
            {
                "applied_match": {
                    "vacancy_id": str(vacancy.id),
                    "role_name": vacancy.title,
                    "score": match_score,
                }
            }
        )

    existing_candidate = _find_existing_candidate(
        session,
        email=parsed_candidate.get("email"),
        resume_path=pdf_content.get("resume_path"),
        file_checksum=pdf_content.get("file_checksum"),
    )
    existing_candidate = _resolve_email_conflict_candidate(
        session,
        candidate=existing_candidate,
        parsed_email=parsed_candidate.get("email"),
    )

    if existing_candidate is not None:
        apply_parsed_data_to_candidate(
            existing_candidate,
            parsed_candidate,
            ai_summary,
            match_score,
            parsed_data,
        )
        session.add(existing_candidate)
        session.commit()
        session.refresh(existing_candidate)
        applied_match = _upsert_fast_candidate_match(
            session=session,
            candidate_id=existing_candidate.id,
            vacancy=vacancy,
            match_score=match_score,
            ai_summary=ai_summary,
            fit_explanation=fit_explanation,
            matched_skills=matched_skills,
        )
        session.refresh(existing_candidate)
        return existing_candidate, vacancy, parsed_candidate, applied_match, [], parsed_data.get("matching")

    payload = CandidateCreate(
        name=sanitize_text(parsed_candidate.get("name")) or "Unknown Candidate",
        email=sanitize_text(parsed_candidate.get("email")) or _build_resume_fallback_email(pdf_content),
        phone=sanitize_text(parsed_candidate.get("phone")),
        skills=parsed_candidate.get("skills", []),
        experience=sanitize_text(parsed_candidate.get("experience")),
        education=sanitize_text(parsed_candidate.get("education")),
        ai_summary=sanitize_text(ai_summary),
        match_score=match_score,
        parsed_data=parsed_data,
    )
    candidate = Candidate(**payload.model_dump())
    session.add(candidate)
    session.commit()
    session.refresh(candidate)

    applied_match = _upsert_fast_candidate_match(
        session=session,
        candidate_id=candidate.id,
        vacancy=vacancy,
        match_score=match_score,
        ai_summary=ai_summary,
        fit_explanation=fit_explanation,
        matched_skills=matched_skills,
    )
    session.refresh(candidate)
    return candidate, vacancy, parsed_candidate, applied_match, [], parsed_data.get("matching")


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
        require_ai=False,
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
        session.exec(delete(CandidateMatch).where(CandidateMatch.candidate_id == candidate_id))
        session.commit()
        return None

    selected_match = parse_result.vacancy_matches[0]
    session.exec(
        delete(CandidateMatch).where(
            CandidateMatch.candidate_id == candidate_id,
            CandidateMatch.vacancy_id != selected_match.vacancy_id,
        )
    )
    session.commit()

    statement = select(CandidateMatch).where(
        CandidateMatch.candidate_id == candidate_id,
        CandidateMatch.vacancy_id == selected_match.vacancy_id,
    )
    match = session.exec(statement).first()

    if match is None:
        match = CandidateMatch(
            candidate_id=candidate_id,
            vacancy_id=selected_match.vacancy_id,
            match_score=selected_match.score,
        )

    match.match_score = selected_match.score
    match.ai_summary = selected_match.ai_summary
    match.fit_explanation = selected_match.fit_explanation
    match.matched_skills = selected_match.matched_skills
    match.created_at = datetime.utcnow()

    session.add(match)
    session.commit()
    session.refresh(match)

    if applied_vacancy and match.vacancy_id != applied_vacancy.id:
        return None
    return match


def _build_resume_fallback_email(pdf_content: dict) -> str:
    seed = pdf_content.get("resume_path") or pdf_content.get("filename") or "resume"
    checksum = adler32(seed.encode("utf-8")) & 0xFFFFFFFF
    return f"candidate-{checksum}@placeholder.local"


def _compute_matched_skills(parsed_candidate: dict, vacancy: Vacancy | None) -> list[str]:
    if vacancy is None:
        return []

    vacancy_skills = {skill.lower() for skill in (vacancy.required_skills or []) if isinstance(skill, str)}
    candidate_skills = [
        skill for skill in parsed_candidate.get("skills", []) if isinstance(skill, str) and skill.lower() in vacancy_skills
    ]
    return candidate_skills[:10]


def _build_fast_fit_explanation(vacancy: Vacancy | None, matched_skills: list[str]) -> str:
    if vacancy is None:
        return "Fast parse completed without a linked vacancy."
    if matched_skills:
        return f"Fast parse identified overlap with {vacancy.title}: {', '.join(matched_skills[:6])}."
    return f"Fast parse completed for {vacancy.title}, but no strong direct skill overlap was identified."


def _upsert_fast_candidate_match(
    *,
    session: Session,
    candidate_id: int,
    vacancy: Vacancy | None,
    match_score: float,
    ai_summary: str,
    fit_explanation: str,
    matched_skills: list[str],
) -> CandidateMatch | None:
    if vacancy is None:
        return None

    statement = select(CandidateMatch).where(
        CandidateMatch.candidate_id == candidate_id,
        CandidateMatch.vacancy_id == vacancy.id,
    )
    match = session.exec(statement).first()
    if match is None:
        match = CandidateMatch(
            candidate_id=candidate_id,
            vacancy_id=vacancy.id,
            match_score=match_score,
        )

    match.match_score = match_score
    match.ai_summary = ai_summary
    match.fit_explanation = fit_explanation
    match.matched_skills = matched_skills
    match.created_at = datetime.utcnow()

    session.add(match)
    session.commit()
    session.refresh(match)
    return match


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
    matching_candidates: list[Candidate] = []
    for candidate in candidates:
        parsed_data = candidate.parsed_data or {}
        parsed_resume_path = parsed_data.get("resume_path")
        parsed_file_checksum = parsed_data.get("file_checksum")
        if file_checksum and parsed_file_checksum == file_checksum:
            matching_candidates.append(candidate)
            continue
        if resume_path and parsed_resume_path == resume_path:
            matching_candidates.append(candidate)

    if not matching_candidates:
        return None

    canonical_candidate = _choose_canonical_candidate(matching_candidates)
    for duplicate_candidate in matching_candidates:
        if duplicate_candidate.id == canonical_candidate.id:
            continue
        canonical_candidate = _merge_candidate_records(
            session,
            source_candidate=duplicate_candidate,
            target_candidate=canonical_candidate,
        )

    return canonical_candidate


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


def _resolve_email_conflict_candidate(
    session: Session,
    *,
    candidate: Candidate | None,
    parsed_email: str | None,
) -> Candidate | None:
    normalized_email = sanitize_text(parsed_email)
    if normalized_email is None:
        return candidate

    email_candidate = _find_existing_candidate_by_email(session, normalized_email)
    if email_candidate is None:
        return candidate

    if candidate is None:
        return email_candidate

    if email_candidate.id == candidate.id:
        return candidate

    return _merge_candidate_records(
        session,
        source_candidate=candidate,
        target_candidate=email_candidate,
    )


def _choose_canonical_candidate(candidates: list[Candidate]) -> Candidate:
    def parsed_at_value(candidate: Candidate) -> float:
        parsed_data = candidate.parsed_data or {}
        parsed_at = parsed_data.get("parsed_at")
        if isinstance(parsed_at, str):
            try:
                normalized = parsed_at if parsed_at.endswith("Z") else f"{parsed_at}Z"
                return datetime.fromisoformat(normalized.replace("Z", "+00:00")).timestamp()
            except ValueError:
                return 0.0
        return 0.0

    return sorted(
        candidates,
        key=lambda candidate: (
            not _is_placeholder_like_candidate(candidate),
            parsed_at_value(candidate),
            candidate.id,
        ),
        reverse=True,
    )[0]


def _is_placeholder_like_candidate(candidate: Candidate) -> bool:
    return candidate.name == "Pending Candidate" or candidate.email.endswith("@placeholder.local")


def _merge_candidate_records(
    session: Session,
    *,
    source_candidate: Candidate,
    target_candidate: Candidate,
) -> Candidate:
    if source_candidate.id == target_candidate.id:
        return target_candidate

    for application in session.exec(
        select(Application).where(Application.candidate_id == source_candidate.id)
    ).all():
        application.candidate_id = target_candidate.id
        session.add(application)

    for parse_job in session.exec(
        select(ParseJob).where(ParseJob.candidate_id == source_candidate.id)
    ).all():
        parse_job.candidate_id = target_candidate.id
        session.add(parse_job)

    for role_suggestion in session.exec(
        select(CandidateRoleSuggestion).where(CandidateRoleSuggestion.candidate_id == source_candidate.id)
    ).all():
        role_suggestion.candidate_id = target_candidate.id
        session.add(role_suggestion)

    target_match_vacancy_ids = {
        match.vacancy_id
        for match in session.exec(
            select(CandidateMatch).where(CandidateMatch.candidate_id == target_candidate.id)
        ).all()
    }
    for match in session.exec(
        select(CandidateMatch).where(CandidateMatch.candidate_id == source_candidate.id)
    ).all():
        if match.vacancy_id in target_match_vacancy_ids:
            session.delete(match)
            continue
        match.candidate_id = target_candidate.id
        session.add(match)

    target_potential_vacancy_ids = {
        match.vacancy_id
        for match in session.exec(
            select(PotentialMatch).where(PotentialMatch.candidate_id == target_candidate.id)
        ).all()
    }
    for potential_match in session.exec(
        select(PotentialMatch).where(PotentialMatch.candidate_id == source_candidate.id)
    ).all():
        if potential_match.vacancy_id in target_potential_vacancy_ids:
            session.delete(potential_match)
            continue
        potential_match.candidate_id = target_candidate.id
        session.add(potential_match)

    source_employee = session.exec(
        select(Employee).where(Employee.candidate_id == source_candidate.id)
    ).first()
    target_employee = session.exec(
        select(Employee).where(Employee.candidate_id == target_candidate.id)
    ).first()
    if source_employee is not None:
        if target_employee is None:
            source_employee.candidate_id = target_candidate.id
            session.add(source_employee)
        else:
            source_employee.candidate_id = None
            session.add(source_employee)

    session.delete(source_candidate)
    session.commit()
    session.refresh(target_candidate)
    return target_candidate
