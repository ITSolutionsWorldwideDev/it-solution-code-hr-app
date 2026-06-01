from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime
from functools import lru_cache
from hashlib import sha256
from typing import Any

import requests
from sqlalchemy import text
from sqlmodel import Session, select

from app.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.potential_match import PotentialMatch
from app.models.vacancy import Vacancy
from app.schemas.potential_match import HiddenPotentialDiscoveryRead, VacancyDiscoverySummaryRead
from app.schemas.talent_suggestion import TalentSuggestionRead
from app.services.crud import get_or_404


def suggest_talent_for_vacancy(
    session: Session,
    vacancy_id: int,
    *,
    limit: int = 50,
) -> list[TalentSuggestionRead]:
    vacancy = get_or_404(session, Vacancy, vacancy_id)
    vacancy_text = _build_vacancy_text(vacancy)
    vacancy_embedding = _embed_text(vacancy_text)

    candidate_pool = _find_top_candidates_by_vector_search(
        session=session,
        vacancy=vacancy,
        vacancy_embedding=vacancy_embedding,
        limit=limit,
    )

    if not candidate_pool:
        return []

    application_lookup = _load_application_status(session, vacancy_id, [candidate.id for candidate in candidate_pool])
    refined_scores = _refine_candidates_for_vacancy(vacancy, candidate_pool, application_lookup)

    sorted_candidates = sorted(refined_scores, key=lambda item: item["match_score"], reverse=True)
    return [
        TalentSuggestionRead(
            candidate_id=str(item["candidate"].id),
            name=item["candidate"].name,
            match_score=int(item["match_score"]),
            is_discovery=bool(item["is_discovery"]),
            discovery_reason=str(item["discovery_reason"]),
            original_applied_role=str(item["original_applied_role"]),
        )
        for item in sorted_candidates
    ]


def trigger_talent_discovery_for_vacancy(
    session: Session,
    vacancy_id: int,
    *,
    limit: int = 50,
    discovery_threshold: int = 70,
) -> VacancyDiscoverySummaryRead:
    vacancy = get_or_404(session, Vacancy, vacancy_id)
    vacancy_text = _build_vacancy_text(vacancy)
    vacancy_embedding = _embed_text(vacancy_text)

    candidate_pool = _find_top_discovery_candidates_by_vector_search(
        session=session,
        vacancy_id=vacancy_id,
        vacancy_embedding=vacancy_embedding,
        limit=limit,
    )

    if not candidate_pool:
        return VacancyDiscoverySummaryRead(vacancy_id=vacancy_id, new_discoveries=[])

    application_lookup = _load_application_status(session, vacancy_id, [candidate.id for candidate in candidate_pool])
    refined_scores = _evaluate_hidden_potential_candidates(vacancy, candidate_pool)
    _upsert_potential_matches(session, vacancy_id, refined_scores)

    sorted_refined_scores = sorted(refined_scores, key=lambda entry: entry["potential_score"], reverse=True)

    new_discoveries = [
        HiddenPotentialDiscoveryRead(
            candidate_id=item["candidate"].id,
            candidate_name=item["candidate"].name,
            original_role=application_lookup.get(
                item["candidate"].id,
                {"original_applied_role": "No prior application"},
            )["original_applied_role"],
            potential_score=int(item["potential_score"]),
            reason=str(item["justification"]),
        )
        for item in sorted_refined_scores
        if int(item["potential_score"]) > discovery_threshold
    ]
    top_candidates = [
        HiddenPotentialDiscoveryRead(
            candidate_id=item["candidate"].id,
            candidate_name=item["candidate"].name,
            original_role=application_lookup.get(
                item["candidate"].id,
                {"original_applied_role": "No prior application"},
            )["original_applied_role"],
            potential_score=int(item["potential_score"]),
            reason=str(item["justification"]),
        )
        for item in sorted_refined_scores[:10]
    ]
    return VacancyDiscoverySummaryRead(
        vacancy_id=vacancy_id,
        new_discoveries=new_discoveries,
        top_candidates=top_candidates,
    )


def _build_vacancy_text(vacancy: Vacancy) -> str:
    requirements = ", ".join(vacancy.required_skills or [])
    return " ".join(
        part
        for part in [
            vacancy.title,
            vacancy.description,
            requirements,
            vacancy.experience_level or "",
        ]
        if part
    )


def _build_candidate_text(candidate: Candidate) -> str:
    parsed_fields = candidate.parsed_data.get("parsed_fields", {}) if isinstance(candidate.parsed_data, dict) else {}
    return " ".join(
        part
        for part in [
            candidate.name,
            " ".join(candidate.skills or []),
            candidate.experience or "",
            candidate.education or "",
            candidate.ai_summary or "",
            str(parsed_fields.get("experience") or ""),
            str(parsed_fields.get("education") or ""),
        ]
        if part
    )


def _find_top_candidates_by_vector_search(
    *,
    session: Session,
    vacancy: Vacancy,
    vacancy_embedding: list[float],
    limit: int,
) -> list[Candidate]:
    vector_literal = "[" + ",".join(f"{value:.8f}" for value in vacancy_embedding) + "]"

    try:
        rows = session.execute(
            text(
                """
                SELECT c.id
                FROM candidate_embeddings ce
                JOIN candidate c ON c.id = ce.candidate_id
                ORDER BY ce.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            ),
            {"embedding": vector_literal, "limit": limit},
        ).fetchall()
        ordered_ids = [int(row[0]) for row in rows]
        if ordered_ids:
            candidates = list(session.exec(select(Candidate).where(Candidate.id.in_(ordered_ids))).all())
            candidate_by_id = {candidate.id: candidate for candidate in candidates}
            return [candidate_by_id[candidate_id] for candidate_id in ordered_ids if candidate_id in candidate_by_id]
    except Exception:
        session.rollback()

    candidates = list(session.exec(select(Candidate)).all())
    scored_candidates = []
    for candidate in candidates:
        candidate_embedding = _candidate_embedding(candidate)
        similarity = _cosine_similarity(vacancy_embedding, candidate_embedding)
        scored_candidates.append((similarity, candidate))

    scored_candidates.sort(key=lambda item: item[0], reverse=True)
    return [candidate for _, candidate in scored_candidates[:limit]]


def _find_top_discovery_candidates_by_vector_search(
    *,
    session: Session,
    vacancy_id: int,
    vacancy_embedding: list[float],
    limit: int,
) -> list[Candidate]:
    vector_literal = "[" + ",".join(f"{value:.8f}" for value in vacancy_embedding) + "]"

    try:
        rows = session.execute(
            text(
                """
                SELECT c.id
                FROM candidate_embeddings ce
                JOIN candidate c ON c.id = ce.candidate_id
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM application a
                    WHERE a.candidate_id = c.id
                      AND a.vacancy_id = :vacancy_id
                )
                ORDER BY ce.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            ),
            {"embedding": vector_literal, "limit": limit, "vacancy_id": vacancy_id},
        ).fetchall()
        ordered_ids = [int(row[0]) for row in rows]
        if ordered_ids:
            candidates = list(session.exec(select(Candidate).where(Candidate.id.in_(ordered_ids))).all())
            candidate_by_id = {candidate.id: candidate for candidate in candidates}
            return [candidate_by_id[candidate_id] for candidate_id in ordered_ids if candidate_id in candidate_by_id]
    except Exception:
        session.rollback()

    applied_candidate_ids = {
        candidate_id
        for candidate_id in session.exec(
            select(Application.candidate_id).where(Application.vacancy_id == vacancy_id)
        ).all()
    }
    candidates = list(session.exec(select(Candidate)).all())
    scored_candidates = []
    for candidate in candidates:
        if candidate.id in applied_candidate_ids:
            continue
        candidate_embedding = _candidate_embedding(candidate)
        similarity = _cosine_similarity(vacancy_embedding, candidate_embedding)
        scored_candidates.append((similarity, candidate))

    scored_candidates.sort(key=lambda item: item[0], reverse=True)
    return [candidate for _, candidate in scored_candidates[:limit]]


def _load_application_status(
    session: Session,
    target_vacancy_id: int,
    candidate_ids: list[int],
) -> dict[int, dict[str, Any]]:
    if not candidate_ids:
        return {}

    applications = list(
        session.exec(
            select(Application).where(Application.candidate_id.in_(candidate_ids))
        ).all()
    )

    vacancy_ids = {application.vacancy_id for application in applications}
    vacancy_titles = {
        vacancy.id: vacancy.title
        for vacancy in session.exec(select(Vacancy).where(Vacancy.id.in_(vacancy_ids))).all()
    } if vacancy_ids else {}

    by_candidate: dict[int, list[Application]] = defaultdict(list)
    for application in applications:
        by_candidate[application.candidate_id].append(application)

    lookup: dict[int, dict[str, Any]] = {}
    for candidate_id, items in by_candidate.items():
        ordered = sorted(items, key=lambda item: item.created_at, reverse=True)
        has_target_application = any(item.vacancy_id == target_vacancy_id for item in items)
        latest_application = ordered[0] if ordered else None
        lookup[candidate_id] = {
            "is_discovery": not has_target_application,
            "original_applied_role": (
                vacancy_titles.get(latest_application.vacancy_id, "No prior application")
                if latest_application
                else "No prior application"
            ),
        }

    return lookup


def _refine_candidates_for_vacancy(
    vacancy: Vacancy,
    candidates: list[Candidate],
    application_lookup: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    vertex_results = _evaluate_candidates_with_vertex_ai(vacancy, candidates)
    if vertex_results is None:
        vertex_results = _heuristic_candidate_refinement(vacancy, candidates)

    results = []
    for candidate in candidates:
        application_info = application_lookup.get(
            candidate.id,
            {"is_discovery": True, "original_applied_role": "No prior application"},
        )
        refined = vertex_results.get(candidate.id, {"match_score": 0, "discovery_reason": "No refined score available."})
        results.append(
            {
                "candidate": candidate,
                "match_score": max(0, min(100, int(refined["match_score"]))),
                "is_discovery": application_info["is_discovery"],
                "discovery_reason": refined["discovery_reason"],
                "original_applied_role": application_info["original_applied_role"],
            }
        )

    return results


def _evaluate_hidden_potential_candidates(
    vacancy: Vacancy,
    candidates: list[Candidate],
) -> list[dict[str, Any]]:
    refined_lookup = (
        _evaluate_candidates_with_vertex_ai(vacancy, candidates)
        or _heuristic_candidate_refinement(vacancy, candidates)
    )

    results: list[dict[str, Any]] = []
    for candidate in candidates:
        refined = refined_lookup.get(
            candidate.id,
            {"match_score": 0, "discovery_reason": f"Candidate shows limited current alignment with the {vacancy.title} vacancy."},
        )
        results.append(
            {
                "candidate": candidate,
                "potential_score": max(0, min(100, int(refined["match_score"]))),
                "justification": str(refined["discovery_reason"]).strip(),
            }
        )
    return results


def _evaluate_candidates_with_vertex_ai(
    vacancy: Vacancy,
    candidates: list[Candidate],
) -> dict[int, dict[str, Any]] | None:
    if settings.gemini_api_key:
        return _evaluate_candidates_with_gemini(vacancy, candidates)

    if not settings.vertex_project_id:
        return None

    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
    except Exception:
        return None

    vertexai.init(project=settings.vertex_project_id, location=settings.vertex_location)
    model = GenerativeModel(settings.vertex_generative_model)

    candidate_payload = [
        {
            "candidate_id": candidate.id,
            "name": candidate.name,
            "skills": candidate.skills,
            "experience": candidate.experience,
            "education": candidate.education,
            "parsed_data": candidate.parsed_data.get("parsed_fields", {}) if isinstance(candidate.parsed_data, dict) else {},
        }
        for candidate in candidates
    ]

    prompt = (
        "You are an expert recruiting evaluator.\n"
        "For the vacancy below, evaluate each candidate specifically for this role.\n"
        "Be critical and conservative.\n"
        "Return JSON only as an array of objects with keys: candidate_id, match_score, discovery_reason.\n"
        "discovery_reason must be exactly one sentence and explain why the candidate is a hidden gem for this vacancy.\n\n"
        f"VACANCY:\nTitle: {vacancy.title}\nDescription: {vacancy.description}\nRequired skills: {vacancy.required_skills}\nExperience level: {vacancy.experience_level}\n\n"
        f"CANDIDATES:\n{json.dumps(candidate_payload, ensure_ascii=True)}"
    )

    try:
        response = model.generate_content(prompt)
        raw_text = getattr(response, "text", None) or ""
        parsed = _extract_json_array(raw_text)
    except Exception:
        return None

    results: dict[int, dict[str, Any]] = {}
    for item in parsed:
        try:
            candidate_id = int(item["candidate_id"])
            results[candidate_id] = {
                "match_score": int(float(item["match_score"])),
                "discovery_reason": str(item["discovery_reason"]).strip(),
            }
        except Exception:
            continue

    return results or None


def _evaluate_candidates_with_gemini(
    vacancy: Vacancy,
    candidates: list[Candidate],
) -> dict[int, dict[str, Any]] | None:
    model_name = settings.vertex_generative_model or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

    candidate_payload = [
        {
            "candidate_id": candidate.id,
            "name": candidate.name,
            "skills": candidate.skills,
            "experience": candidate.experience,
            "education": candidate.education,
            "parsed_data": candidate.parsed_data.get("parsed_fields", {}) if isinstance(candidate.parsed_data, dict) else {},
        }
        for candidate in candidates
    ]

    prompt = (
        "You are an expert recruiting evaluator.\n"
        "For the vacancy below, evaluate each candidate specifically for this role.\n"
        "Be critical and conservative.\n"
        "Return JSON only as an array of objects with keys: candidate_id, match_score, discovery_reason.\n"
        "discovery_reason must be exactly one sentence and explain why the candidate is a hidden gem for this vacancy.\n\n"
        f"VACANCY:\nTitle: {vacancy.title}\nDescription: {vacancy.description}\nRequired skills: {vacancy.required_skills}\nExperience level: {vacancy.experience_level}\n\n"
        f"CANDIDATES:\n{json.dumps(candidate_payload, ensure_ascii=True)}"
    )

    try:
        response = requests.post(
            url,
            params={"key": settings.gemini_api_key},
            json={
                "contents": [
                    {
                        "parts": [
                            {
                                "text": prompt,
                            }
                        ]
                    }
                ]
            },
            timeout=90,
        )
    except requests.RequestException:
        return None

    if not response.ok:
        return None

    payload = response.json()
    candidates_payload = payload.get("candidates")
    if not isinstance(candidates_payload, list):
        return None

    raw_text = ""
    for candidate in candidates_payload:
        content = candidate.get("content") if isinstance(candidate, dict) else None
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list):
            continue
        raw_text = "".join(
            part.get("text", "")
            for part in parts
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        ).strip()
        if raw_text:
            break

    parsed = _extract_json_array(raw_text)
    results: dict[int, dict[str, Any]] = {}
    for item in parsed:
        try:
            candidate_id = int(item["candidate_id"])
            results[candidate_id] = {
                "match_score": int(float(item["match_score"])),
                "discovery_reason": str(item["discovery_reason"]).strip(),
            }
        except Exception:
            continue

    return results or None


def _heuristic_candidate_refinement(
    vacancy: Vacancy,
    candidates: list[Candidate],
) -> dict[int, dict[str, Any]]:
    vacancy_skills = {skill.lower() for skill in vacancy.required_skills or []}
    vacancy_text = _build_vacancy_text(vacancy).lower()
    results: dict[int, dict[str, Any]] = {}

    for candidate in candidates:
        candidate_skills = {skill.lower() for skill in candidate.skills or []}
        overlap = sorted(candidate_skills.intersection(vacancy_skills))
        overlap_score = (len(overlap) / len(vacancy_skills)) * 55 if vacancy_skills else 0.0
        text_score = _cosine_similarity(_embed_text(vacancy_text), _candidate_embedding(candidate)) * 25.0
        seniority_score = 12.0 if _estimate_years(candidate.experience) >= 5 else 8.0 if _estimate_years(candidate.experience) >= 2 else 4.0
        transfer_score = 8.0 if not overlap and candidate.skills else 0.0
        raw_score = overlap_score + text_score + seniority_score + transfer_score
        match_score = int(max(0, min(100, round(raw_score / 5.0) * 5)))

        if overlap:
            reason = f"Candidate shows direct overlap in {', '.join(overlap[:3])}, which maps well to the {vacancy.title} requirements."
        elif candidate.skills:
            transferable = ", ".join(candidate.skills[:3])
            reason = f"Candidate brings transferable strengths in {transferable}, which could translate well into the {vacancy.title} role."
        else:
            reason = f"Candidate profile shows partial relevance to the {vacancy.title} vacancy, but the alignment is still moderate."

        results[candidate.id] = {
            "match_score": match_score,
            "discovery_reason": reason,
        }

    return results


@lru_cache(maxsize=1)
def _load_sentence_transformer():
    try:
        from sentence_transformers import SentenceTransformer
    except Exception:
        return None
    return SentenceTransformer(settings.talent_vector_model)


def _embed_text(text_value: str) -> list[float]:
    model = _load_sentence_transformer()
    if model is not None:
        vector = model.encode(text_value or "", normalize_embeddings=True)
        return [float(value) for value in vector.tolist()]

    if settings.gemini_api_key:
        embedding = _embed_text_with_gemini(text_value or "")
        if embedding:
            return embedding

    if settings.vertex_project_id:
        try:
            import vertexai
            from vertexai.language_models import TextEmbeddingModel

            vertexai.init(project=settings.vertex_project_id, location=settings.vertex_location)
            model = TextEmbeddingModel.from_pretrained(settings.vertex_embedding_model)
            embeddings = model.get_embeddings([text_value or ""])
            if embeddings:
                return [float(value) for value in embeddings[0].values]
        except Exception:
            pass

    return _hashed_embedding(text_value or "")


def _embed_text_with_gemini(text_value: str) -> list[float] | None:
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

    try:
        response = requests.post(
            url,
            params={"key": settings.gemini_api_key},
            json={
                "model": "models/gemini-embedding-001",
                "content": {
                    "parts": [
                        {
                            "text": text_value,
                        }
                    ]
                },
            },
            timeout=60,
        )
    except requests.RequestException:
        return None

    if not response.ok:
        return None

    payload = response.json()
    values = payload.get("embedding", {}).get("values")
    if isinstance(values, list) and values:
        return [float(value) for value in values if isinstance(value, (float, int))]
    return None


def _candidate_embedding(candidate: Candidate) -> list[float]:
    parsed_embedding = candidate.parsed_data.get("candidate_embedding") if isinstance(candidate.parsed_data, dict) else None
    if isinstance(parsed_embedding, list) and parsed_embedding and all(isinstance(item, (float, int)) for item in parsed_embedding):
        return [float(item) for item in parsed_embedding]
    return _embed_text(_candidate_resume_text(candidate) or _build_candidate_text(candidate))


def _candidate_resume_text(candidate: Candidate) -> str:
    if isinstance(candidate.parsed_data, dict):
        extracted_text = candidate.parsed_data.get("extracted_text")
        if isinstance(extracted_text, str) and extracted_text.strip():
            return extracted_text
    return _build_candidate_text(candidate)


def _hashed_embedding(text_value: str, dimensions: int = 64) -> list[float]:
    vector = [0.0] * dimensions
    for token in text_value.lower().split():
        digest = sha256(token.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:2], "big") % dimensions
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vector[bucket] += sign

    magnitude = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / magnitude for value in vector]


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    numerator = sum(left[index] * right[index] for index in range(size))
    left_norm = math.sqrt(sum(value * value for value in left[:size])) or 1.0
    right_norm = math.sqrt(sum(value * value for value in right[:size])) or 1.0
    return max(0.0, min(1.0, numerator / (left_norm * right_norm)))


def _estimate_years(experience_text: str | None) -> int:
    if not experience_text:
        return 0
    import re

    matches = re.findall(r"(\d+)\+?\s*(?:years|yrs)", experience_text.lower())
    if matches:
        return max(int(match) for match in matches)
    return 0


def _extract_json_array(raw_text: str) -> list[dict[str, Any]]:
    stripped = raw_text.strip()
    if not stripped:
        return []

    start = stripped.find("[")
    end = stripped.rfind("]")
    if start == -1 or end == -1 or end < start:
        return []

    try:
        parsed = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return []

    return parsed if isinstance(parsed, list) else []


def _upsert_potential_matches(
    session: Session,
    vacancy_id: int,
    refined_scores: list[dict[str, Any]],
) -> None:
    existing_records = {
        record.candidate_id: record
        for record in session.exec(
            select(PotentialMatch).where(PotentialMatch.vacancy_id == vacancy_id)
        ).all()
    }

    for item in refined_scores:
        candidate = item["candidate"]
        existing = existing_records.get(candidate.id)
        if existing is None:
            existing = PotentialMatch(
                candidate_id=candidate.id,
                vacancy_id=vacancy_id,
                potential_score=float(item["potential_score"]),
                justification=str(item["justification"]),
            )
        else:
            existing.potential_score = float(item["potential_score"])
            existing.justification = str(item["justification"])
            existing.last_computed_at = datetime.utcnow()
        session.add(existing)

    session.commit()
