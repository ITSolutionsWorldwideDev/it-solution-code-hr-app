from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
import requests

from app.config import settings
from app.services.ai_service import parse_candidate_text, sanitize_text

logger = logging.getLogger(__name__)

GEMINI_RETRYABLE_STATUS_CODES = {429, 500, 503}
GEMINI_MAX_RETRIES = 3


class RoleSuggestionResult(BaseModel):
    role_title: str
    department: str | None = None
    confidence_score: float
    reason: str | None = None


class CandidateParseResult(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: str | None = None
    education: str | None = None
    ai_summary: str
    fit_explanation: str | None = None
    role_suggestions: list[RoleSuggestionResult] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    match_score: float | None = None
    matching_result: "CandidateMatchingResult | None" = None
    vacancy_matches: list["VacancyPortfolioMatchResult"] = Field(default_factory=list)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    experience_years: int = 0
    selected_vacancy_id: int | None = None
    selected_vacancy_title: str | None = None


class ConsolidatedParserResponse(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: str | None = None
    education: str | None = None
    experience_years: int = 0
    executive_summary: str
    fit_score: float | None = None
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    selected_vacancy_id: int | None = None
    selected_vacancy_title: str | None = None


class VacancyPortfolioMatchResult(BaseModel):
    vacancy_id: int
    role_name: str
    score: float
    ai_summary: str
    fit_explanation: str
    matched_skills: list[str] = Field(default_factory=list)


class AppliedMatchResult(BaseModel):
    vacancy_id: str
    role_name: str
    score: float
    analysis: str


class PotentialMatchResult(BaseModel):
    vacancy_id: str
    role_name: str
    score: float
    discovery_reason: str


class TalentInsightsResult(BaseModel):
    overall_score: float
    top_skills_identified: list[str] = Field(default_factory=list)
    seniority_level: str


class CandidateMatchingResult(BaseModel):
    applied_match: AppliedMatchResult | None = None
    potential_match: PotentialMatchResult | None = None
    talent_insights: TalentInsightsResult


class JobDescriptionGenerationResult(BaseModel):
    generated_job_description: str
    generated_required_skills: list[str] = Field(default_factory=list)
    summary: str | None = None
    suggested_max_budget: str | None = None


SKILL_ALIASES: dict[str, set[str]] = {
    "python": {"python"},
    "java": {"java"},
    "c++": {"c++", "cpp"},
    "sql": {"sql", "postgresql", "postgres", "mysql", "database", "databases"},
    "api": {"api", "apis", "rest", "restful", "restful apis", "rest apis"},
    "git": {"git", "github", "gitlab", "version control"},
    "docker": {"docker", "container", "containers"},
    "kubernetes": {"kubernetes", "k8s"},
    "javascript": {"javascript", "js"},
    "typescript": {"typescript", "ts"},
    "react": {"react", "next.js", "nextjs"},
    "backend": {"backend", "backend services", "microservices", "server-side"},
}

ROLE_PROFILES = [
    ("Software Developer", {"developer", "software developer", "backend", "api", "python", "java", "c++"}),
    ("Backend Developer", {"backend", "api", "python", "sql", "microservices"}),
    ("Full Stack Developer", {"react", "javascript", "typescript", "api", "sql"}),
    ("Data Analyst", {"power bi", "excel", "sql", "analytics", "reporting"}),
    ("IT Support Technician", {"support", "help desk", "service desk", "windows", "troubleshooting"}),
]


def _get_vertex_model(model_name: str):
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vertex AI dependencies are not available on this backend.",
        ) from exc

    vertexai.init(project=settings.vertex_project_id, location=settings.vertex_location)
    return GenerativeModel(model_name)


def _configured_vertex_models() -> list[str]:
    candidates = settings.vertex_generative_models or [settings.vertex_generative_model]
    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        normalized = sanitize_text(candidate)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _is_retryable_vertex_model_error(message: str) -> bool:
    lowered = message.lower()
    return any(
        token in lowered
        for token in {
            "publisher model",
            "was not found",
            "does not have access",
            "404",
            "not found",
        }
    )


def _extract_json_object(raw_text: str) -> dict[str, Any] | None:
    stripped = raw_text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None

    try:
        parsed = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def _normalize_matching_payload(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return payload

    normalized = dict(payload)
    for key in ("applied_match", "potential_match"):
        match = normalized.get(key)
        if isinstance(match, dict) and "vacancy_id" in match and match["vacancy_id"] is not None:
            match = dict(match)
            match["vacancy_id"] = str(match["vacancy_id"])
            normalized[key] = match
    return normalized


def _generate_vertex_text(prompt: str) -> str:
    if settings.gemini_api_key:
        return _generate_gemini_text(prompt)

    if not settings.vertex_project_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vertex AI is not configured. Set VERTEX_PROJECT_ID before using AI features.",
        )

    attempted_models: list[str] = []
    errors: list[str] = []

    for model_name in _configured_vertex_models():
        attempted_models.append(model_name)
        try:
            model = _get_vertex_model(model_name)
            response = model.generate_content(prompt)
            text = sanitize_text(getattr(response, "text", None) or "") or ""
            if text:
                return text
            errors.append(f"{model_name}: empty text response")
        except Exception as exc:
            message = sanitize_text(str(exc)) or repr(exc)
            errors.append(f"{model_name}: {message}")
            if not _is_retryable_vertex_model_error(message):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        f"Vertex AI request failed for model '{model_name}' in region "
                        f"'{settings.vertex_location}': {message}"
                    ),
                ) from exc

    attempted = ", ".join(attempted_models) or settings.vertex_generative_model
    diagnostic = "; ".join(errors[-3:])
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            f"Vertex AI request failed for all configured models in region '{settings.vertex_location}'. "
            f"Attempted models: {attempted}. Last errors: {diagnostic}"
        ),
    )


def _generate_gemini_text(
    prompt: str | None = None,
    *,
    system_prompt: str | None = None,
    user_prompt: str | None = None,
) -> str:
    if prompt is None:
        prompt = "\n\n".join(part for part in [system_prompt, user_prompt] if part)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini prompt content was empty.",
        )

    attempted_models: list[str] = []
    errors: list[str] = []

    for model_name in _configured_vertex_models():
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        attempted_models.append(model_name)

        for attempt in range(1, GEMINI_MAX_RETRIES + 1):
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
                    timeout=60,
                )
            except requests.RequestException as exc:
                message = sanitize_text(str(exc)) or repr(exc)
                if attempt < GEMINI_MAX_RETRIES:
                    time.sleep(1.5 * attempt)
                    continue
                errors.append(f"{model_name}: {message}")
                continue

            if not response.ok:
                detail = sanitize_text(response.text) or f"status {response.status_code}"
                if response.status_code in GEMINI_RETRYABLE_STATUS_CODES and attempt < GEMINI_MAX_RETRIES:
                    time.sleep(1.5 * attempt)
                    continue
                errors.append(f"{model_name}: {detail}")
                break

            payload = response.json()
            candidates = payload.get("candidates")
            if not isinstance(candidates, list):
                errors.append(f"{model_name}: invalid candidates payload")
                break

            for candidate in candidates:
                content = candidate.get("content") if isinstance(candidate, dict) else None
                parts = content.get("parts") if isinstance(content, dict) else None
                if not isinstance(parts, list):
                    continue
                text = "".join(
                    part.get("text", "")
                    for part in parts
                    if isinstance(part, dict) and isinstance(part.get("text"), str)
                ).strip()
                if text:
                    return text

            errors.append(f"{model_name}: no text content returned")
            break

    diagnostic = "; ".join(errors[-3:]) or "unknown Gemini error"
    logger.warning("Gemini text generation failed. Attempted models: %s. Errors: %s", attempted_models, diagnostic)
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            f"Gemini API request failed for all configured models due to provider capacity or availability. "
            f"Attempted models: {', '.join(attempted_models)}. Last errors: {diagnostic}"
        ),
    )


def _trim_text(value: str | None, *, max_length: int) -> str | None:
    if value is None:
        return None

    compact = " ".join(value.split())
    if len(compact) <= max_length:
        return compact
    return compact[: max_length - 1].rstrip() + "..."


def _normalize_skill_token(skill: str) -> str | None:
    normalized = sanitize_text(skill.lower()) if skill else None
    if not normalized:
        return None

    for canonical, aliases in SKILL_ALIASES.items():
        if normalized in aliases or any(alias in normalized for alias in aliases):
            return canonical

    return normalized


def _extract_text_years(cv_text: str) -> int:
    matches = re.findall(r"(\d+)\+?\s*(?:years|yrs)", cv_text.lower())
    if not matches:
        return 0
    return max(int(match) for match in matches)


def _infer_years_from_profile(cv_text: str) -> int:
    lowered = cv_text.lower()
    if "senior" in lowered:
        return 5
    if "mid-level" in lowered or "medior" in lowered:
        return 3
    if "junior" in lowered:
        return 1
    return 0


def _candidate_years(cv_text: str) -> int:
    explicit = _extract_text_years(cv_text)
    if explicit > 0:
        return explicit
    return _infer_years_from_profile(cv_text)


def _collect_candidate_signals(parsed_candidate: dict, cv_text: str) -> set[str]:
    lowered = cv_text.lower()
    signals: set[str] = set()

    for skill in parsed_candidate.get("skills", []):
        canonical = _normalize_skill_token(skill)
        if canonical:
            signals.add(canonical)

    for canonical, aliases in SKILL_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            signals.add(canonical)

    if any(token in lowered for token in {"developer", "software engineer", "software developer"}):
        signals.add("developer")
    if any(token in lowered for token in {"backend", "back-end", "server-side"}):
        signals.add("backend")
    if "junior" in lowered:
        signals.add("junior")
    if any(token in lowered for token in {"analyst", "analytics", "reporting"}):
        signals.add("analyst")

    return signals


def _collect_vacancy_signals(vacancy_context: dict[str, Any] | None) -> tuple[set[str], set[str], str]:
    if vacancy_context is None:
        return set(), set(), ""

    title = sanitize_text(str(vacancy_context.get("title") or "")) or ""
    required_skills = vacancy_context.get("required_skills", []) or []

    title_signals: set[str] = set()
    lowered_title = title.lower()
    if "developer" in lowered_title or "engineer" in lowered_title:
        title_signals.add("developer")
    if "backend" in lowered_title or "back-end" in lowered_title:
        title_signals.add("backend")
    if "data" in lowered_title or "analyst" in lowered_title:
        title_signals.add("analyst")
    if "junior" in lowered_title:
        title_signals.add("junior")

    skill_signals: set[str] = set()
    for skill in required_skills:
        canonical = _normalize_skill_token(str(skill))
        if canonical:
            skill_signals.add(canonical)

    return title_signals, skill_signals, title


def _score_candidate_against_vacancy(
    parsed_candidate: dict,
    cv_text: str,
    vacancy_context: dict[str, Any] | None,
) -> tuple[float, list[str], str]:
    if vacancy_context is None:
        return 0.0, [], "No vacancy selected for vacancy-fit scoring."

    title_signals, vacancy_skill_signals, vacancy_title = _collect_vacancy_signals(vacancy_context)
    candidate_signals = _collect_candidate_signals(parsed_candidate, cv_text)

    overlap = sorted(candidate_signals.intersection(vacancy_skill_signals))
    skill_score = 0.0
    if vacancy_skill_signals:
        skill_score = (len(overlap) / len(vacancy_skill_signals)) * 45

    title_alignment = 0.0
    if title_signals.intersection(candidate_signals):
        title_alignment = 20.0
    elif "developer" in vacancy_title.lower() and {
        "python",
        "java",
        "c++",
        "backend",
        "api",
        "sql",
    }.intersection(candidate_signals):
        title_alignment = 14.0

    adjacent_bonus = 0.0
    developer_bundle = {"python", "java", "c++", "backend", "api", "sql", "git"}
    if "developer" in vacancy_title.lower():
        adjacent_bonus = min(15.0, len(candidate_signals.intersection(developer_bundle)) * 3.0)
    elif "data" in vacancy_title.lower():
        adjacent_bonus = min(15.0, len(candidate_signals.intersection({"sql", "python", "analyst"})) * 4.0)

    years = _candidate_years(cv_text)

    transferable_bonus = 0.0
    if not overlap and candidate_signals:
        if years >= 2:
            transferable_bonus += 8.0
        elif years >= 1:
            transferable_bonus += 5.0

        if parsed_candidate.get("experience"):
            transferable_bonus += 4.0

        transferable_bonus = min(12.0, transferable_bonus)

    experience_alignment = 0.0
    vacancy_experience = str(vacancy_context.get("experience_level") or "").lower()
    if years >= 5:
        experience_alignment = 10.0
    elif years >= 2:
        experience_alignment = 8.0
    elif years >= 1:
        experience_alignment = 6.0
    elif "junior" in vacancy_experience or "junior" in vacancy_title.lower():
        experience_alignment = 6.0

    education_bonus = 0.0
    education_text = (parsed_candidate.get("education") or "").lower()
    if any(token in education_text for token in {"bachelor", "master", "university", "computer", "information technology"}):
        education_bonus = 5.0

    raw_score = min(
        100.0,
        round(
            skill_score
            + title_alignment
            + adjacent_bonus
            + transferable_bonus
            + experience_alignment
            + education_bonus,
            2,
        ),
    )

    if raw_score == 0 and candidate_signals:
        raw_score = 15.0

    score = _bucket_match_score(raw_score)

    fit_parts = []
    if overlap:
        fit_parts.append(f"Direct skill overlap with the vacancy: {', '.join(overlap[:5])}.")
    if "developer" in vacancy_title.lower() and developer_bundle.intersection(candidate_signals):
        fit_parts.append("Developer profile signals were detected from the CV based on coding, backend, API, database, and Git experience.")
    if years > 0:
        fit_parts.append(f"Detected roughly {years} year{'s' if years != 1 else ''} of relevant experience from the resume.")
    if education_bonus > 0:
        fit_parts.append("Relevant technical education was identified in the CV.")
    if transferable_bonus > 0:
        fit_parts.append("The score also includes transferable experience signals, even where exact vacancy-skill overlap was limited.")

    if not fit_parts:
        fit_parts.append("The candidate shows some relevant profile signals, but there were limited exact matches to the vacancy requirements.")

    return score, overlap, " ".join(fit_parts).strip()


def _bucket_match_score(value: float) -> float:
    bounded = max(0.0, min(100.0, value))
    bucketed = int(round(bounded / 10.0) * 10)
    return float(max(0, min(100, bucketed)))


def _bucket_talent_score(value: float) -> float:
    bounded = max(0.0, min(100.0, value))
    bucketed = int(round(bounded / 5.0) * 5)
    return float(max(0, min(100, bucketed)))


def _infer_seniority_level(years: int) -> str:
    if years >= 8:
        return "Senior"
    if years >= 4:
        return "Mid-Senior"
    if years >= 2:
        return "Mid-Level"
    if years >= 1:
        return "Junior"
    return "Entry-Level"


def _compute_overall_talent_score(
    *,
    vacancy_matches: list[VacancyPortfolioMatchResult],
    top_skills: list[str],
    years: int,
) -> float:
    ordered_scores = sorted((match.score for match in vacancy_matches), reverse=True)
    best_score = ordered_scores[0] if ordered_scores else 0.0
    second_best = ordered_scores[1] if len(ordered_scores) > 1 else 0.0
    strong_fit_count = sum(1 for score in ordered_scores if score >= 50.0)
    adjacent_fit_count = sum(1 for score in ordered_scores if score >= 30.0)

    raw_score = (
        best_score * 0.45
        + second_best * 0.2
        + min(18.0, len(top_skills) * 2.5)
        + min(18.0, years * 2.5)
        + min(12.0, strong_fit_count * 4.0)
        + min(8.0, adjacent_fit_count * 2.0)
    )

    return _bucket_talent_score(raw_score)


def _build_fallback_matching_result(
    *,
    parsed_candidate: dict[str, Any],
    applied_match: VacancyPortfolioMatchResult | None,
    potential_match: VacancyPortfolioMatchResult | None,
    vacancy_matches: list[VacancyPortfolioMatchResult],
) -> CandidateMatchingResult:
    years = _candidate_years(" ".join(
        str(value or "")
        for value in [
            parsed_candidate.get("experience"),
            parsed_candidate.get("education"),
        ]
    ))
    top_skills = [skill for skill in parsed_candidate.get("skills", []) if isinstance(skill, str)][:5]

    if not top_skills:
        matched_skills = []
        for match in sorted(vacancy_matches, key=lambda item: item.score, reverse=True):
            matched_skills.extend(match.matched_skills)
        seen: set[str] = set()
        deduped_skills: list[str] = []
        for skill in matched_skills:
            lowered = skill.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            deduped_skills.append(skill)
            if len(deduped_skills) == 5:
                break
        top_skills = deduped_skills

    overall_score = _compute_overall_talent_score(
        vacancy_matches=vacancy_matches,
        top_skills=top_skills,
        years=years,
    )

    return CandidateMatchingResult(
        applied_match=(
            AppliedMatchResult(
                vacancy_id=str(applied_match.vacancy_id),
                role_name=applied_match.role_name,
                score=applied_match.score,
                analysis=applied_match.fit_explanation,
            )
            if applied_match
            else None
        ),
        potential_match=(
            PotentialMatchResult(
                vacancy_id=str(potential_match.vacancy_id),
                role_name=potential_match.role_name,
                score=potential_match.score,
                discovery_reason=potential_match.fit_explanation,
            )
            if potential_match
            else None
        ),
        talent_insights=TalentInsightsResult(
            overall_score=overall_score,
            top_skills_identified=top_skills,
            seniority_level=_infer_seniority_level(years),
        ),
    )


def _generate_matching_result_with_openai(
    *,
    parsed_candidate: dict[str, Any],
    applied_match: VacancyPortfolioMatchResult | None,
    potential_match: VacancyPortfolioMatchResult | None,
    vacancy_matches: list[VacancyPortfolioMatchResult],
    require_ai: bool = False,
) -> CandidateMatchingResult:
    fallback = _build_fallback_matching_result(
        parsed_candidate=parsed_candidate,
        applied_match=applied_match,
        potential_match=potential_match,
        vacancy_matches=vacancy_matches,
    )

    if not settings.gemini_api_key and not settings.vertex_project_id:
        return fallback

    compact_matches = [
        {
            "vacancy_id": match.vacancy_id,
            "role_name": match.role_name,
            "score": match.score,
            "matched_skills": match.matched_skills[:6],
            "fit_explanation": match.fit_explanation,
        }
        for match in sorted(vacancy_matches, key=lambda item: item.score, reverse=True)[:8]
    ]

    system_prompt = (
        "You are a critical recruitment matching analyst.\n\n"
        "You will receive one candidate profile plus scored vacancy matches.\n"
        "Return JSON only.\n"
        "Preserve the provided numeric scores exactly.\n"
        "Do not inflate scores.\n"
        "Write one short applied-role analysis sentence, one short hidden-potential reason sentence, "
        "and talent insights with concise top skills and seniority."
    )
    user_prompt = (
        "Candidate profile:\n"
        f"{parsed_candidate}\n\n"
        "Applied match:\n"
        f"{applied_match.model_dump() if applied_match else None}\n\n"
        "Best alternative match:\n"
        f"{potential_match.model_dump() if potential_match else None}\n\n"
        "Top scored vacancy matches:\n"
        f"{compact_matches}\n\n"
        "Return a JSON object with this exact structure:\n"
        "{\n"
        '  "applied_match": {"vacancy_id": "string", "role_name": "string", "score": number, "analysis": "string"},\n'
        '  "potential_match": {"vacancy_id": "string", "role_name": "string", "score": number, "discovery_reason": "string"},\n'
        '  "talent_insights": {"overall_score": number, "top_skills_identified": ["string"], "seniority_level": "string"}\n'
        "}\n"
        "If no applied or alternative match exists, keep the object null in spirit by mirroring the provided fallback semantics."
    )

    try:
        raw_text = _generate_vertex_text(f"{system_prompt}\n\n{user_prompt}")
        payload = _normalize_matching_payload(_extract_json_object(raw_text))
        parsed = CandidateMatchingResult.model_validate(payload) if payload else None
    except Exception as exc:
        if require_ai:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Candidate matching AI failed: {sanitize_text(str(exc)) or repr(exc)}",
            ) from exc
        logger.warning("Candidate matching AI failed; using fallback. Reason: %s", exc)
        return fallback

    if not parsed:
        if require_ai:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Candidate matching AI returned an invalid response.",
            )
        return fallback

    if parsed.applied_match and fallback.applied_match:
        parsed.applied_match.score = fallback.applied_match.score
        parsed.applied_match.vacancy_id = fallback.applied_match.vacancy_id
        parsed.applied_match.role_name = fallback.applied_match.role_name
    elif fallback.applied_match:
        parsed.applied_match = fallback.applied_match

    if parsed.potential_match and fallback.potential_match:
        parsed.potential_match.score = fallback.potential_match.score
        parsed.potential_match.vacancy_id = fallback.potential_match.vacancy_id
        parsed.potential_match.role_name = fallback.potential_match.role_name
    elif fallback.potential_match:
        parsed.potential_match = fallback.potential_match

    parsed.talent_insights.overall_score = fallback.talent_insights.overall_score
    if not parsed.talent_insights.top_skills_identified:
        parsed.talent_insights.top_skills_identified = fallback.talent_insights.top_skills_identified
    if not parsed.talent_insights.seniority_level:
        parsed.talent_insights.seniority_level = fallback.talent_insights.seniority_level

    return parsed


def _build_role_suggestions(
    candidate_signals: set[str],
    vacancy_context: dict[str, Any] | None,
    *,
    selected_vacancy_score: float | None = None,
    selected_vacancy_reason: str | None = None,
) -> list[RoleSuggestionResult]:
    suggestions: list[RoleSuggestionResult] = []
    vacancy_title = (vacancy_context.get("title") if vacancy_context else "") or ""

    for role_title, role_signals in ROLE_PROFILES:
        overlap = candidate_signals.intersection(role_signals)
        if not overlap:
            continue

        confidence = min(98.0, 45.0 + len(overlap) * 12.5)
        if vacancy_title and role_title.lower() in vacancy_title.lower():
            confidence = min(99.0, confidence + 8.0)

        suggestions.append(
            RoleSuggestionResult(
                role_title=role_title,
                department=_guess_department(role_title, vacancy_context),
                confidence_score=round(confidence, 2),
                reason=_trim_text(
                    f"Matched signals: {', '.join(sorted(overlap)[:4])}.",
                    max_length=120,
                ),
            )
        )

    if vacancy_title:
        suggestions.insert(
            0,
            RoleSuggestionResult(
                role_title=vacancy_title,
                department=_guess_department(vacancy_title, vacancy_context),
                confidence_score=round(selected_vacancy_score if selected_vacancy_score is not None else 0.0, 2),
                reason=_trim_text(
                    selected_vacancy_reason or "This candidate was parsed directly against the chosen vacancy.",
                    max_length=160,
                ),
            ),
        )

    deduped: list[RoleSuggestionResult] = []
    seen_titles: set[str] = set()
    for suggestion in suggestions:
        if suggestion.role_title in seen_titles:
            continue
        deduped.append(suggestion)
        seen_titles.add(suggestion.role_title)
        if len(deduped) == 4:
            break

    return deduped


def _guess_department(role_title: str, vacancy_context: dict[str, Any] | None) -> str | None:
    if vacancy_context and vacancy_context.get("title") and role_title == vacancy_context.get("title"):
        return None

    lowered = role_title.lower()
    if any(token in lowered for token in {"developer", "engineer", "support"}):
        return "Engineering"
    if "analyst" in lowered or "data" in lowered:
        return "Data"
    return None


def _compact_vacancy_context(vacancy: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(vacancy["id"]),
        "title": sanitize_text(str(vacancy.get("title") or "")) or f"Vacancy #{vacancy['id']}",
        "experience_level": sanitize_text(str(vacancy.get("experience_level") or "")) or None,
        "required_skills": [
            sanitize_text(str(skill).lower())
            for skill in (vacancy.get("required_skills") or [])
            if sanitize_text(str(skill).lower())
        ][:10],
        "description": _trim_text(sanitize_text(str(vacancy.get("description") or "")), max_length=500),
    }


def _build_vacancy_context_text(
    vacancy_context: dict[str, Any] | None,
    active_vacancies: list[dict[str, Any]] | None,
) -> tuple[str | None, list[dict[str, Any]]]:
    if vacancy_context is not None:
        compact = _compact_vacancy_context(vacancy_context)
        return (
            "One explicit vacancy was selected. Score only against this role and return its id/title.\n"
            f"{json.dumps(compact, ensure_ascii=True)}",
            [compact],
        )

    normalized_vacancies = [_compact_vacancy_context(item) for item in (active_vacancies or []) if item.get("id") is not None]
    if not normalized_vacancies:
        return None, []

    return (
        "No explicit vacancy was selected. Review these open vacancies, choose the single best fit, "
        "and return its id/title only if there is a credible match.\n"
        f"{json.dumps(normalized_vacancies, ensure_ascii=True)}",
        normalized_vacancies,
    ), normalized_vacancies


def _normalize_bullet_items(values: list[str] | None, *, limit: int) -> list[str]:
    normalized: list[str] = []
    for value in values or []:
        cleaned = sanitize_text(value)
        if not cleaned:
            continue
        normalized.append(cleaned.lstrip("- ").strip())
        if len(normalized) == limit:
            break
    return normalized


def _coerce_fit_score(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(100.0, round(numeric, 2)))


def _build_fit_explanation(summary: str, pros: list[str], cons: list[str]) -> str:
    parts = [sanitize_text(summary) or ""]
    if pros:
        parts.append(f"Sterke punten: {'; '.join(pros[:3])}.")
    if cons:
        parts.append(f"Aandachtspunten: {'; '.join(cons[:2])}.")
    return sanitize_text(" ".join(part for part in parts if part).strip()) or "Geen fit-uitleg beschikbaar."


def fallback_non_ai_parser(
    cv_text: str,
    *,
    vacancy_context: dict[str, Any] | None = None,
    active_vacancies: list[dict[str, Any]] | None = None,
) -> ConsolidatedParserResponse:
    parsed = parse_candidate_text(cv_text)
    selected_vacancy = vacancy_context
    fit_score: float | None = None
    fit_explanation = "Parsing tijdelijk beperkt beschikbaar wegens verbindingsfout met de AI-engine."

    if selected_vacancy is None and active_vacancies:
        best_score = -1.0
        best_vacancy: dict[str, Any] | None = None
        for vacancy_item in active_vacancies:
            score, _, _ = _score_candidate_against_vacancy(parsed, cv_text, vacancy_item)
            if score > best_score:
                best_score = score
                best_vacancy = vacancy_item
        selected_vacancy = best_vacancy if best_score >= 50.0 else None
        fit_score = best_score if selected_vacancy is not None else None
    elif selected_vacancy is not None:
        fit_score, _, _ = _score_candidate_against_vacancy(parsed, cv_text, selected_vacancy)

    title = sanitize_text(str(selected_vacancy.get("title") or "")) if selected_vacancy else None
    summary = (
        f"{parsed.get('name') or 'Deze kandidaat'} heeft een basisprofiel kunnen opleveren uit de CV, "
        "maar de AI-parser was tijdelijk offline."
    )
    if title:
        summary += f" Eerste indicatie voor {title}: beperkte fallback-score beschikbaar."

    pros = _normalize_bullet_items(parsed.get("skills", [])[:3], limit=3)
    return ConsolidatedParserResponse(
        name=sanitize_text(parsed.get("name")),
        email=sanitize_text(parsed.get("email")),
        phone=sanitize_text(parsed.get("phone")),
        skills=[skill for skill in parsed.get("skills", []) if isinstance(skill, str)][:8],
        experience=sanitize_text(parsed.get("experience")),
        education=sanitize_text(parsed.get("education")),
        experience_years=_candidate_years(cv_text),
        executive_summary=sanitize_text(summary) or "Parsing tijdelijk beperkt beschikbaar wegens verbindingsfout met de AI-engine.",
        fit_score=fit_score,
        pros=pros,
        cons=["AI Parser is momenteel offline"],
        selected_vacancy_id=int(selected_vacancy["id"]) if selected_vacancy and selected_vacancy.get("id") is not None else None,
        selected_vacancy_title=title,
    )


def parse_candidate_with_openai(
    *,
    cv_text: str,
    vacancy_context: dict[str, Any] | None = None,
    active_vacancies: list[dict[str, Any]] | None = None,
    require_ai: bool = True,
) -> CandidateParseResult:
    vacancy_context_text, normalized_vacancies = _build_vacancy_context_text(vacancy_context, active_vacancies)

    system_prompt = """You are an elite, enterprise-grade AI Resume Parser and Recruitment Match Analyst. Your goal is to extract structured information from raw CV text, generate a lightning-fast "Executive Summary" for recruiters, and perform a smart, context-aware match score against provided job openings.

CRITICAL RULES:
1. Strict Factuality: Extract ONLY facts explicitly stated or strongly supported. Never hallucinate or guess fields.
2. Tone & Conciseness: Write like a sharp, top-tier executive recruiter. Keep text blocks extremely brief and punchy for a "quick check" UI (maximum 2-3 sentences for summaries).
3. Strict JSON output: You must ONLY return a valid JSON object matching the exact schema provided. Do not wrap it in markdown code blocks, and do not add trailing text.
4. Flexible Matching (No Keyword Penalties): Do not score rigidly based on exact keyword overlap. Understand synonyms and adjacent expertise.
5. Vacancy Selection: If one explicit vacancy is provided, score only that vacancy. If several open vacancies are provided, choose the single best fit only when there is a credible role match. Otherwise leave the vacancy fields null.

SCORING CRITERIA (0 - 100):
- 85-100: Exceptional fit; possesses all core skills, required seniority, and contextually aligns perfectly.
- 70-84: Solid fit; missing minor nice-to-haves but highly capable of performing the role effectively.
- 50-69: Potential fit; transferable skills or adjacent experience, but requires upskilling or lacks direct domain authority.
- 0-49: Poor fit; no alignment with the open role.
- If NO vacancy context is provided, set fit_score to null and selected vacancy fields to null.
"""

    user_prompt = f"""Analyze the following candidate information and execute the parse, summary, and match scoring.

--- OPEN VACANCY CONTEXT (IF APPLICABLE) ---
{vacancy_context_text if vacancy_context_text else "No specific vacancy provided. Parse for general Talent Pool."}

--- RAW CV TEXT ---
{cv_text}

--- REQUIRED JSON OUTPUT SCHEMA ---
{{
  "name": "Extract full name or null",
  "email": "Extract email or null",
  "phone": "Extract clean phone number or null",
  "skills": ["List of top 8 core hard skills max"],
  "experience": "Maximum 2 short sentences on relevant work experience or null",
  "education": "Maximum 2 short sentences on relevant education or null",
  "experience_years": 0,
  "executive_summary": "A punchy, maximum 2-to-3 sentence summary in Dutch explaining exactly who this candidate is, their seniority, and why they fit (or don't fit) the vacancy context.",
  "fit_score": 0,
  "selected_vacancy_id": 0,
  "selected_vacancy_title": "Best matching vacancy title or null",
  "pros": [
    "Maximum 3 bullet-points in Dutch highlighting key strengths matching the vacancy or general expertise"
  ],
  "cons": [
    "Maximum 2 bullet-points in Dutch highlighting critical gaps, missing tech stacks, or red flags. If none, leave empty"
  ]
}}

Return JSON only."""

    try:
        raw_response = _generate_gemini_text(system_prompt=system_prompt, user_prompt=user_prompt)
        cleaned_response = raw_response.strip()
        if cleaned_response.startswith("```"):
            cleaned_response = re.sub(r"^```(?:json)?\s*", "", cleaned_response)
            cleaned_response = re.sub(r"\s*```$", "", cleaned_response)
        payload = _extract_json_object(cleaned_response)
        parsed_payload = ConsolidatedParserResponse.model_validate(payload) if payload else None
        if not parsed_payload:
            raise ValueError("Consolidated parser returned invalid JSON.")
    except Exception as exc:
        logger.error("Gemini single-prompt parsing failed: %s", exc)
        if require_ai:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Candidate parsing AI failed: {sanitize_text(str(exc)) or repr(exc)}",
            ) from exc
        parsed_payload = fallback_non_ai_parser(
            cv_text,
            vacancy_context=vacancy_context,
            active_vacancies=normalized_vacancies,
        )

    if parsed_payload is None:
        parsed_payload = fallback_non_ai_parser(
            cv_text,
            vacancy_context=vacancy_context,
            active_vacancies=normalized_vacancies,
        )

    selected_vacancy: dict[str, Any] | None = None
    if vacancy_context is not None:
        selected_vacancy = vacancy_context
    elif parsed_payload.selected_vacancy_id is not None:
        selected_vacancy = next(
            (item for item in normalized_vacancies if int(item["id"]) == int(parsed_payload.selected_vacancy_id)),
            None,
        )
    elif parsed_payload.selected_vacancy_title:
        normalized_title = sanitize_text(parsed_payload.selected_vacancy_title or "")
        if normalized_title:
            selected_vacancy = next(
                (
                    item
                    for item in normalized_vacancies
                    if sanitize_text(str(item.get("title") or "")).lower() == normalized_title.lower()
                ),
                None,
            )

    fit_score = _coerce_fit_score(parsed_payload.fit_score)
    is_talent_pool_parse = vacancy_context is None

    if selected_vacancy is None and not normalized_vacancies:
        fit_score = None

    selected_vacancy_title = (
        sanitize_text(str(selected_vacancy.get("title") or ""))
        if selected_vacancy is not None
        else sanitize_text(parsed_payload.selected_vacancy_title)
    )
    selected_vacancy_id = int(selected_vacancy["id"]) if selected_vacancy is not None else None
    matched_skills = [skill for skill in parsed_payload.skills[:8] if isinstance(skill, str)]
    fit_explanation = _build_fit_explanation(
        sanitize_text(parsed_payload.executive_summary) or "",
        _normalize_bullet_items(parsed_payload.pros, limit=3),
        _normalize_bullet_items(parsed_payload.cons, limit=2),
    )

    vacancy_matches: list[VacancyPortfolioMatchResult] = []
    matching_result: CandidateMatchingResult | None = None
    if selected_vacancy_id is not None and fit_score is not None:
        vacancy_match = VacancyPortfolioMatchResult(
            vacancy_id=selected_vacancy_id,
            role_name=selected_vacancy_title or f"Vacancy #{selected_vacancy_id}",
            score=fit_score,
            ai_summary=sanitize_text(parsed_payload.executive_summary) or "",
            fit_explanation=fit_explanation,
            matched_skills=matched_skills,
        )
        vacancy_matches.append(vacancy_match)
        matching_result = CandidateMatchingResult(
            applied_match=(
                None
                if is_talent_pool_parse
                else AppliedMatchResult(
                    vacancy_id=str(selected_vacancy_id),
                    role_name=vacancy_match.role_name,
                    score=fit_score,
                    analysis=fit_explanation,
                )
            ),
            potential_match=(
                PotentialMatchResult(
                    vacancy_id=str(selected_vacancy_id),
                    role_name=vacancy_match.role_name,
                    score=fit_score,
                    discovery_reason=fit_explanation,
                )
                if is_talent_pool_parse
                else None
            ),
            talent_insights=TalentInsightsResult(
                overall_score=fit_score,
                top_skills_identified=matched_skills[:5],
                seniority_level=_infer_seniority_level(max(0, int(parsed_payload.experience_years))),
            ),
        )

    return CandidateParseResult(
        name=sanitize_text(parsed_payload.name),
        email=sanitize_text(parsed_payload.email),
        phone=sanitize_text(parsed_payload.phone),
        skills=[
            skill
            for skill in {
                sanitize_text(skill.lower()) if isinstance(skill, str) else None
                for skill in parsed_payload.skills[:8]
            }
            if skill
        ],
        experience=sanitize_text(parsed_payload.experience),
        education=sanitize_text(parsed_payload.education),
        ai_summary=sanitize_text(parsed_payload.executive_summary) or "Geen executive summary beschikbaar.",
        fit_explanation=fit_explanation,
        role_suggestions=[],
        matched_skills=matched_skills,
        match_score=fit_score,
        matching_result=matching_result,
        vacancy_matches=vacancy_matches,
        pros=_normalize_bullet_items(parsed_payload.pros, limit=3),
        cons=_normalize_bullet_items(parsed_payload.cons, limit=2),
        experience_years=max(0, int(parsed_payload.experience_years)),
        selected_vacancy_id=selected_vacancy_id,
        selected_vacancy_title=selected_vacancy_title,
    )


def _build_candidate_summary(
    *,
    parsed_candidate: dict[str, Any],
    vacancy_context: dict[str, Any] | None,
    match_score: float,
    matched_skills: list[str],
    fit_explanation: str,
) -> str:
    candidate_name = parsed_candidate.get("name") or "Candidate"
    vacancy_title = (vacancy_context.get("title") if vacancy_context else None)
    target_label = vacancy_title or "the best matching open vacancy"
    skill_text = ", ".join(parsed_candidate.get("skills", [])[:6]) or "general professional experience"
    experience_text = parsed_candidate.get("experience") or "limited experience could be clearly extracted from the CV"
    education_text = parsed_candidate.get("education") or "no strong education signal was identified"

    if match_score >= 75:
        opener = f"{candidate_name} appears to be a strong fit for {target_label}."
    elif match_score >= 55:
        opener = f"{candidate_name} appears to be a relevant candidate for {target_label}, with several useful overlaps."
    elif match_score >= 35:
        opener = f"{candidate_name} shows partial alignment with {target_label}, although the fit is mixed."
    else:
        opener = f"{candidate_name} does not currently look like a strong direct fit for {target_label}, but there may still be some transferable value."

    if matched_skills:
        skills_sentence = f"The clearest matching skills are {', '.join(matched_skills[:5])}."
    else:
        skills_sentence = f"The profile mentions strengths such as {skill_text}, but there were limited exact matches against the vacancy requirements."

    summary = (
        f"{opener} "
        f"{skills_sentence} "
        f"Experience snapshot: {experience_text}. "
        f"Education snapshot: {education_text}. "
        f"Overall assessment: {fit_explanation}"
    )

    return sanitize_text(summary) or ""


def _infer_required_skills_from_text(*values: str) -> list[str]:
    lowered = " ".join(value.lower() for value in values if value).strip()
    detected: list[str] = []

    for canonical, aliases in SKILL_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            detected.append(canonical)

    extra_keywords = [
        "agile",
        "scrum",
        "aws",
        "azure",
        "gcp",
        "fastapi",
        "sqlmodel",
        "postgresql",
        "node.js",
    ]
    for keyword in extra_keywords:
        if keyword in lowered and keyword not in detected:
            detected.append(keyword)

    return detected[:10]


def _estimate_budget(
    *,
    budget: str | None,
    seniority: str | None,
    years_experience: str | None,
    country: str | None,
) -> str | None:
    if budget:
        return sanitize_text(budget)

    clean_country = sanitize_text(country or "").lower()
    context = " ".join(filter(None, [seniority, years_experience, clean_country])).lower()

    salary_bands = {
        "netherlands": ("EUR 45,000 - 65,000 gross annually", "EUR 65,000 - 90,000 gross annually", "EUR 90,000 - 120,000 gross annually"),
        "belgium": ("EUR 42,000 - 60,000 gross annually", "EUR 60,000 - 82,000 gross annually", "EUR 82,000 - 110,000 gross annually"),
        "germany": ("EUR 50,000 - 70,000 gross annually", "EUR 70,000 - 95,000 gross annually", "EUR 95,000 - 125,000 gross annually"),
        "france": ("EUR 42,000 - 58,000 gross annually", "EUR 58,000 - 80,000 gross annually", "EUR 80,000 - 108,000 gross annually"),
        "united kingdom": ("GBP 38,000 - 55,000 gross annually", "GBP 55,000 - 78,000 gross annually", "GBP 78,000 - 105,000 gross annually"),
        "uk": ("GBP 38,000 - 55,000 gross annually", "GBP 55,000 - 78,000 gross annually", "GBP 78,000 - 105,000 gross annually"),
        "united states": ("USD 70,000 - 95,000 gross annually", "USD 95,000 - 130,000 gross annually", "USD 130,000 - 175,000 gross annually"),
        "usa": ("USD 70,000 - 95,000 gross annually", "USD 95,000 - 130,000 gross annually", "USD 130,000 - 175,000 gross annually"),
    }
    junior_band, mid_band, senior_band = salary_bands.get(
        clean_country,
        ("EUR 45,000 - 65,000 gross annually", "EUR 65,000 - 90,000 gross annually", "EUR 90,000 - 120,000 gross annually"),
    )

    if any(token in context for token in {"senior", "lead", "architect", "principal", "7", "8", "9", "10"}):
        return senior_band
    if any(token in context for token in {"mid", "medior", "intermediate", "3", "4", "5", "6"}):
        return mid_band
    return junior_band


def _generate_job_description_fallback(
    *,
    job_title: str | None,
    department: str | None,
    budget: str | None,
    requirements: str | None,
    start_date: str | None = None,
    employment_type: str | None = None,
    work_hours: str | None = None,
    work_model: str | None = None,
    city: str | None = None,
    country: str | None = None,
    years_experience: str | None = None,
    perks: str | None = None,
    tone: str | None = None,
    seniority: str | None = None,
) -> JobDescriptionGenerationResult:
    normalized_job_title = sanitize_text(job_title or "") or "Open Position"
    normalized_department = sanitize_text(department or "") or "General"
    normalized_requirements = (
        sanitize_text(requirements or "")
        or "No specific requirements were provided, so write a realistic draft based on the role, department, and current hiring market."
    )
    location = ", ".join(part for part in [city, country] if part) or "the relevant hiring location"
    style = sanitize_text(tone) or "professional"
    seniority_label = sanitize_text(seniority) or "appropriate"
    experience_label = sanitize_text(years_experience) or "relevant"
    skills = _infer_required_skills_from_text(
        normalized_job_title,
        normalized_department,
        normalized_requirements,
        perks or "",
    )
    description = _build_long_form_job_description(
        job_title=normalized_job_title,
        department=normalized_department,
        location=location,
        salary_indication=_estimate_budget(
            budget=budget,
            seniority=seniority,
            years_experience=years_experience,
            country=country,
        ),
        employment_type=employment_type,
        work_hours=work_hours,
        work_model=work_model,
        years_experience=years_experience,
        perks=perks,
        requirements=normalized_requirements,
        skills=skills,
        tone=style,
        seniority=seniority_label,
        start_date=start_date,
        source_body="",
    )

    summary = (
        f"{normalized_job_title} for {normalized_department} in {location}, aimed at a {seniority_label.lower()} candidate with "
        f"{experience_label.lower()} experience."
    )

    return JobDescriptionGenerationResult(
        generated_job_description=description,
        generated_required_skills=skills,
        summary=summary,
        suggested_max_budget=_estimate_budget(
            budget=budget,
            seniority=seniority,
            years_experience=years_experience,
            country=country,
        ),
    )


def generate_job_description_with_openai(
    *,
    job_title: str | None,
    department: str | None,
    budget: str | None,
    requirements: str | None,
    start_date: str | None = None,
    employment_type: str | None = None,
    work_hours: str | None = None,
    work_model: str | None = None,
    city: str | None = None,
    country: str | None = None,
    years_experience: str | None = None,
    perks: str | None = None,
    tone: str | None = None,
    seniority: str | None = None,
) -> JobDescriptionGenerationResult:
    normalized_job_title = sanitize_text(job_title or "") or "Open Position"
    normalized_department = sanitize_text(department or "") or "General"
    normalized_requirements = (
        sanitize_text(requirements or "")
        or "No specific requirements were provided, so write a realistic draft based on the role, department, and current hiring market."
    )

    fallback = _generate_job_description_fallback(
        job_title=normalized_job_title,
        department=normalized_department,
        budget=budget,
        requirements=normalized_requirements,
        start_date=start_date,
        employment_type=employment_type,
        work_hours=work_hours,
        work_model=work_model,
        city=city,
        country=country,
        years_experience=years_experience,
        perks=perks,
        tone=tone,
        seniority=seniority,
    )

    if not settings.vertex_project_id and not settings.gemini_api_key:
        return fallback

    system_prompt = (
        "You are an expert HR writer. Produce professional, detailed, editable job descriptions "
        "for vacancy intake. The generated_job_description must be a rich long-form vacancy text with "
        "clear section headings such as Job Description, About Us, Position Overview, Key Responsibilities, "
        "Skills & Requirements, Qualifications, and What We Offer. Avoid short summary-style outputs. "
        "Return a polished description, extracted required skills, a short summary, and a realistic "
        "suggested max budget based on the role, location, work setup, and experience."
    )
    user_prompt = (
        f"Job title: {normalized_job_title}\n"
        f"Department: {normalized_department}\n"
        f"Budget: {budget or 'not specified'}\n"
        f"Start date: {start_date or 'not specified'}\n"
        f"Employment type: {employment_type or 'not specified'}\n"
        f"Work hours: {work_hours or 'not specified'}\n"
        f"Work model: {work_model or 'not specified'}\n"
        f"City: {city or 'not specified'}\n"
        f"Country: {country or 'not specified'}\n"
        f"Years of experience: {years_experience or 'not specified'}\n"
        f"Perks and benefits guidance: {perks or 'not specified'}\n"
        f"Tone: {tone or 'professional'}\n"
        f"Seniority: {seniority or 'not specified'}\n"
        f"Requirements from user: {normalized_requirements}"
    )

    try:
        raw_text = _generate_vertex_text(
            f"{system_prompt}\n\nReturn JSON only with keys: generated_job_description, generated_required_skills, summary, suggested_max_budget.\n\n"
            "The generated_job_description should read like a complete vacancy post, not like a short overview paragraph. "
            "Include section headings and enough detail for direct human editing.\n\n"
            f"{user_prompt}"
        )
        payload = _extract_json_object(raw_text)
        result = JobDescriptionGenerationResult.model_validate(payload) if payload else None
    except Exception as exc:
        logger.warning("Job description AI generation failed; using fallback. Reason: %s", exc)
        return fallback

    if not result:
        return fallback

    normalized_description = _build_long_form_job_description(
        job_title=normalized_job_title,
        department=normalized_department,
        location=", ".join(part for part in [city, country] if part) or "the relevant hiring location",
        salary_indication=result.suggested_max_budget
        or _estimate_budget(
            budget=budget,
            seniority=seniority,
            years_experience=years_experience,
            country=country,
        ),
        employment_type=employment_type,
        work_hours=work_hours,
        work_model=work_model,
        years_experience=years_experience,
        perks=perks,
        requirements=normalized_requirements,
        skills=result.generated_required_skills,
        tone=sanitize_text(tone) or "professional",
        seniority=sanitize_text(seniority) or "appropriate",
        start_date=start_date,
        source_body=result.generated_job_description,
    )

    result.generated_job_description = normalized_description

    return result


def _build_long_form_job_description(
    *,
    job_title: str,
    department: str,
    location: str,
    salary_indication: str | None,
    employment_type: str | None,
    work_hours: str | None,
    work_model: str | None,
    years_experience: str | None,
    perks: str | None,
    requirements: str,
    skills: list[str],
    tone: str,
    seniority: str,
    start_date: str | None,
    source_body: str,
) -> str:
    def _to_display_title(value: str) -> str:
        cleaned = sanitize_text(value)
        if not cleaned:
            return value

        small_words = {"and", "or", "of", "in", "for", "to", "with", "on", "at", "the", "a", "an"}
        words = cleaned.split()
        formatted_words: list[str] = []
        for index, word in enumerate(words):
            lower_word = word.lower()
            if index > 0 and lower_word in small_words:
                formatted_words.append(lower_word)
            else:
                formatted_words.append(lower_word.capitalize())
        return " ".join(formatted_words)

    clean_body = sanitize_text(source_body or "")
    clean_body = re.sub(r"(?m)^\s*#+\s*", "", clean_body).strip()
    clean_requirements = sanitize_text(requirements or "")
    clean_perks = sanitize_text(perks or "") or "Holiday allowance, pension plan, paid time off, learning budget, and home office support where relevant."
    display_job_title = _to_display_title(job_title)
    display_department = _to_display_title(department)

    requirement_lines = [
        line.strip(" -\t")
        for line in re.split(r"[\n,;]+", clean_requirements)
        if line.strip(" -\t")
    ]
    if not requirement_lines:
        requirement_lines = [
            f"Deliver strong results within the {display_department} team.",
            "Collaborate effectively with stakeholders and teammates.",
            "Communicate clearly and work in a structured way.",
        ]

    skill_lines = skills[:10] if skills else requirement_lines[:6]
    preferred_tools = skill_lines[:6]
    company_name = "IT Solutions Worldwide"
    experience_label = years_experience or "Minimum 1 year"
    job_type_parts = [employment_type or "Full-time"]
    if work_hours:
        job_type_parts.append(work_hours)
    job_type_label = ", ".join(job_type_parts)
    start_date_label = start_date or "To be agreed"
    salary_indication_label = salary_indication or "To be discussed"

    has_structured_sections = any(
        marker in clean_body.lower()
        for marker in (
            "about us",
            "position overview",
            "key responsibilities",
            "skills & requirements",
            "qualifications",
            "what we offer",
        )
    )

    body_section = clean_body if len(clean_body) >= 400 and not has_structured_sections else (
        f"We are seeking a detail-oriented and motivated {display_job_title} to join our global team. "
        f"In this role, you will be responsible for delivering reliable outcomes within the {display_department} function, "
        f"working with structured processes, clear stakeholder communication, and a strong focus on quality.\n\n"
        f"You will play an important role in translating day-to-day work into measurable business value while "
        f"maintaining consistency, ownership, and high professional standards."
    )

    about_us = (
        f"At {company_name}, we specialize in high-quality execution and measurable results. "
        f"Our {display_department} department plays an important role in supporting strategic decision-making, "
        f"operational consistency, and long-term growth. We foster a {((work_model or 'collaborative').lower())}-first, "
        f"collaborative culture built on ownership, clarity, and professional growth."
    )

    responsibility_labels = [
        "Core Delivery",
        "Process Improvement",
        "Documentation & Reporting",
        "Stakeholder Management",
        "Team Collaboration",
        "Operational Excellence",
    ]
    responsibility_items = requirement_lines[:]
    while len(responsibility_items) < 6:
        responsibility_items.append(
            f"Contribute to {display_department.lower()} priorities with structured execution and clear communication."
        )
    responsibilities = "\n".join(
        f"- {label}: {item}"
        for label, item in zip(responsibility_labels, responsibility_items[:6], strict=False)
    )

    skill_labels = [
        "Technical Proficiency",
        "Advanced Tools",
        "Analytical Rigor",
        "Communication",
        "Independence",
        "Professionalism",
    ]
    skill_items = skill_lines[:]
    while len(skill_items) < 6:
        skill_items.append("Strong ability to work in a structured, quality-focused environment.")
    requirements_block = "\n".join(
        f"- {label}: {item}"
        for label, item in zip(skill_labels, skill_items[:6], strict=False)
    )

    tools_block = "\n".join(f"- {line}" for line in preferred_tools) or "- Relevant tools and platforms based on the role"
    qualification_lines = [
        f"Bachelor's degree or equivalent professional experience related to the {display_job_title} role.",
        f"{experience_label} of relevant hands-on experience in a comparable role.",
        f"Demonstrable ability to deliver strong results within the {display_department} function.",
    ]
    qualifications_block = "\n".join(f"- {line}" for line in qualification_lines)
    kpi_lines = [
        "Delivery quality and consistency across assigned workstreams.",
        "Timely execution of priorities and stakeholder follow-through.",
        "Clear reporting, documentation, and communication standards.",
        f"Contribution to measurable {display_department.lower()} outcomes and business goals.",
    ]
    kpi_block = "\n".join(f"- {line}" for line in kpi_lines)
    offer_lines = [
        line.strip()
        for line in re.split(r"[\n,;]+", clean_perks)
        if line.strip()
    ]
    if not offer_lines:
        offer_lines = [
            "Competitive salary package with performance-based growth opportunities.",
            "Paid time off and holiday allowance.",
            "Learning and development support.",
            "A collaborative and professional working environment.",
        ]
    offer_block = "\n".join(f"- {line}" for line in offer_lines)

    return (
        f"{display_job_title} | {company_name}\n"
        f"Location: {location}\n"
        f"Job Type: {job_type_label}\n"
        f"Salary Indication: {salary_indication_label}\n"
        f"Experience: {experience_label}\n"
        f"Start Date: {start_date_label}\n\n"
        f"About {company_name}\n"
        f"{about_us}\n\n"
        f"Position Overview\n"
        f"{body_section}\n\n"
        f"Key Responsibilities\n"
        f"{responsibilities}\n\n"
        f"Skills & Requirements\n"
        f"{requirements_block}\n\n"
        f"Tools & Platforms (Preferred)\n"
        f"{tools_block}\n\n"
        f"Qualifications\n"
        f"{qualifications_block}\n\n"
        f"What We Offer\n"
        f"{offer_block}\n\n"
        f"Apply Here\n"
        f"To apply for this position, please submit your application and CV via the following link:\n\n"
        f"[PLAK HIER JE URL]\n\n"
        f"{company_name}\n"
        f"Excellence in Execution. Consistency in Results."
    ).strip()
