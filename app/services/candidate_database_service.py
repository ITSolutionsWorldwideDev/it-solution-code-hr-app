from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy
from app.schemas.candidate import (
    CandidateDatabaseRecordRead,
    CandidateDatabaseResponseRead,
    CandidateDatabaseVacancyOptionRead,
)


def _parse_api_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value if value.endswith("Z") or "+" in value[10:] else f"{value}Z"
    try:
        parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed


def _format_added_date(value: str | None) -> str:
    parsed = _parse_api_datetime(value)
    if not parsed:
        return "Recently added"
    return parsed.strftime("%b %d, %Y")


def _as_string(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if numeric == numeric else None
    if isinstance(value, str) and value.strip():
        try:
            numeric = float(value)
        except ValueError:
            return None
        return numeric if numeric == numeric else None
    return None


def _normalize_text(value: str) -> str:
    return value.strip().lower()


def _get_candidate_initials(name: str) -> str:
    words = [part.strip() for part in name.split() if part.strip()]
    if not words:
        return "CV"
    return "".join(part[0].upper() for part in words[:2])


def _sort_time_value(value: str | None) -> float:
    parsed = _parse_api_datetime(value)
    return parsed.timestamp() if parsed is not None else 0.0


def _extract_experience_years(candidate: Candidate) -> int | None:
    parsed_data = candidate.parsed_data or {}

    for source in (parsed_data.get("years_experience"), parsed_data.get("experience_years")):
        if isinstance(source, (int, float)) and source == source:
            return max(0, round(float(source)))
        if isinstance(source, str):
            import re

            match = re.search(r"(\d+(?:\.\d+)?)", source)
            if match:
                return max(0, round(float(match.group(1))))

    if isinstance(candidate.experience, str):
        normalized = candidate.experience.strip().lower()
        import re

        match = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:years?|yrs?)(?:\s+of\s+experience|\s+experience)?",
            normalized,
        )
        if not match and normalized.replace(".", "", 1).isdigit():
            return max(0, round(float(normalized)))
        if match:
            return max(0, round(float(match.group(1))))

    return None


def _get_candidate_matching(candidate: Candidate) -> dict[str, Any] | None:
    matching = (candidate.parsed_data or {}).get("matching")
    return matching if isinstance(matching, dict) else None


def _is_placeholder_candidate(candidate: Candidate) -> bool:
    parse_status = (candidate.parsed_data or {}).get("parse_status")
    return (
        candidate.name == "Pending Candidate"
        or candidate.email.endswith("@placeholder.local")
        or parse_status == "pending"
    )


def _score_candidate_against_vacancy(candidate: Candidate, vacancy: Vacancy) -> int:
    normalized_skills = sorted(
        {
            _normalize_text(skill)
            for skill in (candidate.skills or [])
            if isinstance(skill, str) and skill.strip()
        }
    )
    vacancy_skills = sorted(
        {
            _normalize_text(skill)
            for skill in (vacancy.required_skills or [])
            if isinstance(skill, str) and skill.strip()
        }
    )

    overlap_count = len([skill for skill in vacancy_skills if skill in normalized_skills])
    overlap_score = (overlap_count / len(vacancy_skills)) * 70 if vacancy_skills else 0

    search_text = _normalize_text(
        " ".join(
            [
                vacancy.title,
                vacancy.description,
                vacancy.experience_level or "",
                *vacancy_skills,
            ]
        )
    )
    keyword_hits = len([skill for skill in normalized_skills if skill in search_text])
    keyword_score = min(20, keyword_hits * 4)

    summary_blob = _normalize_text(
        " ".join(
            [
                candidate.ai_summary or "",
                candidate.experience or "",
                candidate.education or "",
            ]
        )
    )
    title_tokens = [
        _normalize_text(token)
        for token in vacancy.title.split()
        if len(_normalize_text(token)) >= 4
    ]
    title_matches = len([token for token in title_tokens if token in summary_blob])
    title_score = min(10, title_matches * 5)

    return max(0, min(100, round(overlap_score + keyword_score + title_score)))


def _infer_talent_pool_match(candidate: Candidate, vacancies: list[Vacancy]) -> dict[str, Any] | None:
    open_vacancies = [vacancy for vacancy in vacancies if vacancy.status.value == "open"]
    if not open_vacancies:
        return None

    best_vacancy: Vacancy | None = None
    best_score: int | None = None
    for vacancy in open_vacancies:
        score = _score_candidate_against_vacancy(candidate, vacancy)
        if best_score is None or score > best_score:
            best_vacancy = vacancy
            best_score = score

    if best_vacancy is None or best_score is None:
        return None

    return {
        "vacancy_id": best_vacancy.id,
        "vacancy_title": best_vacancy.title,
        "score": best_score,
    }


def _get_readiness_status(candidate: Candidate) -> str:
    parsed_data = candidate.parsed_data or {}
    parse_status = parsed_data.get("parse_status")
    parse_status_value = parse_status.lower() if isinstance(parse_status, str) else None
    has_summary = isinstance(candidate.ai_summary, str) and bool(candidate.ai_summary.strip())
    fit_score = _as_number(parsed_data.get("fit_score"))
    if fit_score is None:
        fit_score = candidate.match_score

    if parse_status_value in {"failed", "pending"} or not has_summary:
        return "needs_review"
    if fit_score is not None and fit_score >= 70:
        return "strong_match"
    if fit_score is not None and fit_score >= 50:
        return "potential_fit"
    return "low_fit"


def get_candidate_database_payload(session: Session) -> CandidateDatabaseResponseRead:
    candidates = list(session.exec(select(Candidate)).all())
    applications = list(session.exec(select(Application)).all())
    vacancies = list(session.exec(select(Vacancy)).all())

    vacancy_by_id = {vacancy.id: vacancy for vacancy in vacancies}
    applications_by_candidate: dict[int, list[Application]] = {}
    for application in applications:
        applications_by_candidate.setdefault(application.candidate_id, []).append(application)

    records: list[dict[str, Any]] = []

    for candidate in candidates:
        parsed_data = candidate.parsed_data or {}
        linked_applications = sorted(
            applications_by_candidate.get(candidate.id, []),
            key=lambda application: application.created_at,
            reverse=True,
        )
        latest_application = linked_applications[0] if linked_applications else None
        linked_vacancy = vacancy_by_id.get(latest_application.vacancy_id) if latest_application else None
        matching = _get_candidate_matching(candidate) or {}
        inferred_talent_pool_match = _infer_talent_pool_match(candidate, vacancies)
        selected_vacancy_id = _as_number(parsed_data.get("selected_vacancy_id"))
        selected_vacancy_id_int = int(selected_vacancy_id) if selected_vacancy_id is not None else None
        selected_vacancy_title = _as_string(parsed_data.get("selected_vacancy_title"))
        selected_vacancy = vacancy_by_id.get(selected_vacancy_id_int) if selected_vacancy_id_int is not None else None
        if selected_vacancy is None and inferred_talent_pool_match is not None:
            selected_vacancy = vacancy_by_id.get(inferred_talent_pool_match["vacancy_id"])

        has_applied_vacancy = linked_vacancy is not None
        potential_match = matching.get("potential_match") if isinstance(matching.get("potential_match"), dict) else {}
        applied_match = matching.get("applied_match") if isinstance(matching.get("applied_match"), dict) else {}
        talent_insights = matching.get("talent_insights") if isinstance(matching.get("talent_insights"), dict) else {}

        talent_pool_potential_title = (
            selected_vacancy.title if selected_vacancy is not None else None
        ) or selected_vacancy_title or _as_string(potential_match.get("role_name")) or (
            inferred_talent_pool_match["vacancy_title"] if inferred_talent_pool_match is not None else None
        )
        matched_vacancy_title = (
            _as_string(applied_match.get("role_name"))
            or _as_string(potential_match.get("role_name"))
            or _as_string(parsed_data.get("role_title"))
            or _as_string(parsed_data.get("job_title"))
        )
        role_title = (
            linked_vacancy.title if linked_vacancy is not None else None
        ) or talent_pool_potential_title or matched_vacancy_title or "No linked vacancy"
        vacancy_label = (
            "Applied vacancy"
            if has_applied_vacancy
            else "Talent pool best match"
            if talent_pool_potential_title
            else "Best vacancy match"
        )
        potential_role = talent_pool_potential_title or _as_string(potential_match.get("role_name"))
        stage = latest_application.stage.value if latest_application is not None else "parsed"
        raw_added_at = _as_string(parsed_data.get("parsed_at")) or (
            latest_application.created_at.isoformat() if latest_application is not None else None
        )
        experience_years = _extract_experience_years(candidate)
        applied_match_score = _as_number(applied_match.get("score"))
        if applied_match_score is None and has_applied_vacancy and latest_application is not None:
            applied_match_score = latest_application.ranking_score
        if applied_match_score is None and latest_application is not None:
            applied_match_score = latest_application.match_score
        if applied_match_score is None and has_applied_vacancy:
            applied_match_score = candidate.match_score

        overall_talent_score = _as_number(parsed_data.get("fit_score"))
        if overall_talent_score is None:
            overall_talent_score = _as_number(talent_insights.get("overall_score"))
        if overall_talent_score is None:
            overall_talent_score = _as_number(potential_match.get("score"))
        if overall_talent_score is None:
            overall_talent_score = candidate.match_score
        if overall_talent_score is None and inferred_talent_pool_match is not None:
            overall_talent_score = float(inferred_talent_pool_match["score"])
        if overall_talent_score is None:
            overall_talent_score = applied_match_score
        parse_status = _as_string(parsed_data.get("parse_status"))
        dedupe_key = (
            _as_string(parsed_data.get("file_checksum"))
            or candidate.email.strip().lower()
            or candidate.name.strip().lower()
        )
        search_blob = " ".join(
            [
                candidate.name,
                candidate.email,
                role_title,
                role_title,
                potential_role or "",
                " ".join(candidate.skills or []),
                candidate.ai_summary or "",
                _as_string(parsed_data.get("executive_summary")) or "",
            ]
        ).lower()

        records.append(
            {
                "id": candidate.id,
                "initials": _get_candidate_initials(candidate.name),
                "name": candidate.name,
                "email": candidate.email,
                "phone": _as_string(parsed_data.get("phone")) or candidate.phone,
                "raw_added_at": raw_added_at,
                "added_at": _format_added_date(raw_added_at),
                "dedupe_key": dedupe_key.lower(),
                "vacancy_id": latest_application.vacancy_id if has_applied_vacancy and latest_application else (
                    selected_vacancy_id_int
                    if selected_vacancy_id_int is not None
                    else (inferred_talent_pool_match["vacancy_id"] if inferred_talent_pool_match is not None else None)
                ),
                "vacancy_ids": list(
                    dict.fromkeys(
                        [
                            *[application.vacancy_id for application in linked_applications],
                            *([selected_vacancy_id_int] if selected_vacancy_id_int is not None else []),
                            *(
                                [inferred_talent_pool_match["vacancy_id"]]
                                if inferred_talent_pool_match is not None
                                else []
                            ),
                        ]
                    )
                ),
                "role_title": role_title,
                "vacancy_title": role_title,
                "vacancy_label": vacancy_label,
                "potential_role": potential_role,
                "experience_years": experience_years,
                "applied_match_score": applied_match_score,
                "overall_talent_score": overall_talent_score,
                "stage": stage,
                "parse_status": parse_status,
                "is_placeholder": _is_placeholder_candidate(candidate),
                "search_blob": search_blob,
                "ai_summary": candidate.ai_summary or _as_string(parsed_data.get("executive_summary")) or "No parsed summary available yet.",
                "skills": candidate.skills or [],
                "experience": candidate.experience or "No experience parsed yet.",
                "education": candidate.education or "No education parsed yet.",
                "parsed_data": parsed_data,
                "readiness_status": _get_readiness_status(candidate),
            }
        )

    records.sort(
        key=lambda record: (
            -_sort_time_value(record["raw_added_at"]),
            -(record["experience_years"] if record["experience_years"] is not None else -1),
            record["name"],
        ),
    )

    deduped_by_identity: dict[str, dict[str, Any]] = {}
    for record in records:
        identity_key = f'{record["dedupe_key"]}|{record["vacancy_id"] or "no-vacancy"}'
        existing = deduped_by_identity.get(identity_key)
        if existing is None:
            deduped_by_identity[identity_key] = record
            continue
        existing_time = _parse_api_datetime(existing["raw_added_at"]) or datetime.min
        record_time = _parse_api_datetime(record["raw_added_at"]) or datetime.min
        if record_time >= existing_time:
            deduped_by_identity[identity_key] = record

    deduped_by_candidate: dict[str, dict[str, Any]] = {}
    for record in deduped_by_identity.values():
        candidate_key = record["dedupe_key"]
        existing = deduped_by_candidate.get(candidate_key)
        if existing is None:
            deduped_by_candidate[candidate_key] = record
            continue
        existing_time = _parse_api_datetime(existing["raw_added_at"]) or datetime.min
        record_time = _parse_api_datetime(record["raw_added_at"]) or datetime.min
        if record_time >= existing_time:
            deduped_by_candidate[candidate_key] = record

    visible_records = [
        CandidateDatabaseRecordRead(
            id=record["id"],
            initials=record["initials"],
            name=record["name"],
            email=record["email"],
            phone=record["phone"],
            raw_added_at=record["raw_added_at"],
            added_at=record["added_at"],
            vacancy_ids=record["vacancy_ids"],
            role_title=record["role_title"],
            vacancy_title=record["vacancy_title"],
            vacancy_label=record["vacancy_label"],
            potential_role=record["potential_role"],
            experience_years=record["experience_years"],
            applied_match_score=record["applied_match_score"],
            overall_talent_score=record["overall_talent_score"],
            stage=record["stage"],
            parse_status=record["parse_status"],
            search_blob=record["search_blob"],
            ai_summary=record["ai_summary"],
            skills=record["skills"],
            experience=record["experience"],
            education=record["education"],
            parsed_data=record["parsed_data"],
            readiness_status=record["readiness_status"],
        )
        for record in deduped_by_candidate.values()
        if not record["is_placeholder"]
    ]

    vacancy_options = [
        CandidateDatabaseVacancyOptionRead(
            id=vacancy.id,
            title=vacancy.title,
            status=vacancy.status.value,
        )
        for vacancy in vacancies
    ]

    open_vacancy_count = len([vacancy for vacancy in vacancies if vacancy.status.value == "open"])

    return CandidateDatabaseResponseRead(
        records=visible_records,
        vacancy_options=vacancy_options,
        open_vacancy_count=open_vacancy_count,
        total_candidate_count=len(candidates),
    )
