from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
import requests

from app.config import settings
from app.services.ai_service import parse_candidate_text, sanitize_text


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
    match_score: float = 0.0
    matching_result: "CandidateMatchingResult | None" = None
    vacancy_matches: list["VacancyPortfolioMatchResult"] = Field(default_factory=list)


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


class CandidateExtractionResult(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: str | None = None
    education: str | None = None


class ResumeFormattingResult(BaseModel):
    formatted_cv: str


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


def _generate_gemini_text(prompt: str) -> str:
    model_name = settings.vertex_generative_model or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API request failed: {exc}",
        ) from exc

    if not response.ok:
        detail = sanitize_text(response.text) or f"status {response.status_code}"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API returned an error for model '{model_name}': {detail}",
        )

    payload = response.json()
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini API returned an invalid response payload.",
        )

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

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Gemini API returned no text content.",
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
) -> CandidateMatchingResult:
    fallback = _build_fallback_matching_result(
        parsed_candidate=parsed_candidate,
        applied_match=applied_match,
        potential_match=potential_match,
        vacancy_matches=vacancy_matches,
    )

    if not settings.vertex_project_id:
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
        payload = _extract_json_object(raw_text)
        parsed = CandidateMatchingResult.model_validate(payload) if payload else None
    except Exception:
        return fallback

    if not parsed:
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
                    selected_vacancy_reason or "This candidate was parsed directly against the selected vacancy.",
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


def parse_candidate_with_openai(
    *,
    cv_text: str,
    vacancy_context: dict[str, Any] | None = None,
    active_vacancies: list[dict[str, Any]] | None = None,
) -> CandidateParseResult:
    parsed_candidate = _extract_candidate_details(cv_text)
    candidate_signals = _collect_candidate_signals(parsed_candidate, cv_text)
    scoring_pool = list(active_vacancies or [])
    if vacancy_context and not any(item.get("id") == vacancy_context.get("id") for item in scoring_pool):
        scoring_pool.append(vacancy_context)

    vacancy_matches: list[VacancyPortfolioMatchResult] = []
    for vacancy_item in scoring_pool:
        score, matched_skills, fit_explanation = _score_candidate_against_vacancy(
            parsed_candidate,
            cv_text,
            vacancy_item,
        )
        vacancy_matches.append(
            VacancyPortfolioMatchResult(
                vacancy_id=int(vacancy_item["id"]),
                role_name=str(vacancy_item.get("title") or f"Vacancy #{vacancy_item['id']}"),
                score=score,
                ai_summary=_build_candidate_summary(
                    parsed_candidate=parsed_candidate,
                    vacancy_context=vacancy_item,
                    match_score=score,
                    matched_skills=matched_skills,
                    fit_explanation=fit_explanation,
                ),
                fit_explanation=fit_explanation,
                matched_skills=matched_skills[:10],
            )
        )

    applied_portfolio_match = None
    if vacancy_context:
        applied_portfolio_match = next(
            (match for match in vacancy_matches if match.vacancy_id == int(vacancy_context["id"])),
            None,
        )

    potential_portfolio_match = next(
        (
            match
            for match in sorted(vacancy_matches, key=lambda item: item.score, reverse=True)
            if not vacancy_context or match.vacancy_id != int(vacancy_context["id"])
        ),
        None,
    )

    if applied_portfolio_match is None and vacancy_context:
        match_score = 0.0
        matched_skills = []
        fit_explanation = "No applied vacancy match could be computed."
    elif applied_portfolio_match is None and vacancy_matches:
        applied_portfolio_match = max(vacancy_matches, key=lambda item: item.score)
        match_score = applied_portfolio_match.score
        matched_skills = applied_portfolio_match.matched_skills
        fit_explanation = applied_portfolio_match.fit_explanation
    else:
        match_score = applied_portfolio_match.score if applied_portfolio_match else 0.0
        matched_skills = applied_portfolio_match.matched_skills if applied_portfolio_match else []
        fit_explanation = applied_portfolio_match.fit_explanation if applied_portfolio_match else "No vacancy selected for vacancy-fit scoring."

    ai_summary = _build_candidate_summary(
        parsed_candidate=parsed_candidate,
        vacancy_context=vacancy_context,
        match_score=match_score,
        matched_skills=matched_skills,
        fit_explanation=fit_explanation,
    )
    matching_result = _generate_matching_result_with_openai(
        parsed_candidate=parsed_candidate,
        applied_match=applied_portfolio_match,
        potential_match=potential_portfolio_match,
        vacancy_matches=vacancy_matches,
    )

    return CandidateParseResult(
        name=parsed_candidate.get("name"),
        email=parsed_candidate.get("email"),
        phone=parsed_candidate.get("phone"),
        skills=parsed_candidate.get("skills", [])[:10],
        experience=sanitize_text(parsed_candidate.get("experience")),
        education=sanitize_text(parsed_candidate.get("education")),
        ai_summary=ai_summary,
        fit_explanation=fit_explanation,
        role_suggestions=_build_role_suggestions(
            candidate_signals,
            vacancy_context,
            selected_vacancy_score=match_score,
            selected_vacancy_reason=fit_explanation,
        ),
        matched_skills=matched_skills[:10],
        match_score=match_score,
        matching_result=matching_result,
        vacancy_matches=vacancy_matches,
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
    vacancy_title = (vacancy_context.get("title") if vacancy_context else None) or "the selected vacancy"
    skill_text = ", ".join(parsed_candidate.get("skills", [])[:6]) or "general professional experience"
    experience_text = parsed_candidate.get("experience") or "limited experience could be clearly extracted from the CV"
    education_text = parsed_candidate.get("education") or "no strong education signal was identified"

    if match_score >= 75:
        opener = f"{candidate_name} appears to be a strong fit for {vacancy_title}."
    elif match_score >= 55:
        opener = f"{candidate_name} appears to be a relevant candidate for {vacancy_title}, with several useful overlaps."
    elif match_score >= 35:
        opener = f"{candidate_name} shows partial alignment with {vacancy_title}, although the fit is mixed."
    else:
        opener = f"{candidate_name} does not currently look like a strong direct fit for {vacancy_title}, but there may still be some transferable value."

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


def _extract_candidate_details(cv_text: str) -> dict[str, Any]:
    fallback = parse_candidate_text(cv_text)
    if not settings.vertex_project_id:
        return fallback

    system_prompt = (
        "You are an expert recruitment CV parser.\n\n"
        "Extract structured candidate information from raw resume text.\n"
        "Return only facts that are explicitly present in the CV or strongly supported by the CV text.\n"
        "Do not invent, infer, or guess missing information.\n\n"
        "Field rules:\n"
        "- name: return only the candidate's full personal name, without labels like 'Name:' or 'Candidate Name:'.\n"
        "- email: return the best real candidate email address.\n"
        "- phone: return only a real phone number. Never return dates, year ranges, scores, IDs, or section numbers.\n"
        "- skills: return a concise list of real professional or technical skills explicitly mentioned in the CV. Use lowercase tokens.\n"
        "- experience: summarize the candidate's relevant work experience in 1 to 3 short sentences.\n"
        "- education: summarize the most relevant education in 1 to 2 short sentences.\n\n"
        "Extraction constraints:\n"
        "- Ignore headers, footers, page numbers, duplicated labels, OCR/PDF noise, and decorative text.\n"
        "- Ignore vacancy text, job posting text, legal boilerplate, and non-candidate content.\n"
        "- Do not include prefixes such as 'name:', 'phone:', or 'email:' inside values.\n"
        "- Do not return placeholder emails unless there is no real email in the CV.\n"
        "- Do not treat year ranges such as '2022-2024' as phone numbers.\n"
        "- Exclude soft skills like 'hardworking', 'team player', or 'communication' unless they are clearly framed as a concrete professional skill.\n"
        "- If a field is missing, return null for that field.\n\n"
        "Prioritize accuracy and cleanliness over completeness."
    )
    user_prompt = (
        "Extract the candidate profile from the following raw CV text.\n\n"
        "Return structured candidate details only.\n\n"
        f"CV TEXT:\n{cv_text}"
    )

    try:
        raw_text = _generate_vertex_text(
            f"{system_prompt}\n\nReturn JSON only with keys: name, email, phone, skills, experience, education.\n\n{user_prompt}"
        )
        payload = _extract_json_object(raw_text)
        extraction = CandidateExtractionResult.model_validate(payload) if payload else None
    except Exception:
        return fallback

    if not extraction:
        return fallback

    return {
        "name": sanitize_text(extraction.name) or fallback.get("name"),
        "email": sanitize_text(extraction.email) or fallback.get("email"),
        "phone": sanitize_text(extraction.phone) or fallback.get("phone"),
        "skills": [
            skill
            for skill in {
                sanitize_text(skill.lower()) if skill else None
                for skill in (extraction.skills or [])
            }
            if skill
        ] or fallback.get("skills", []),
        "experience": sanitize_text(extraction.experience) or fallback.get("experience"),
        "education": sanitize_text(extraction.education) or fallback.get("education"),
    }


def format_resume_preview(cv_text: str) -> str:
    fallback = _fallback_resume_preview(cv_text)
    if not settings.vertex_project_id:
        return fallback

    system_prompt = (
        "You are an expert CV editor.\n\n"
        "Restructure raw extracted resume text into a readable CV format.\n"
        "Use clear section headings and bullet points.\n"
        "For each work experience item, use this structure when possible:\n"
        "- Date\n"
        "- Company\n"
        "- Role\n"
        "- Responsibilities\n\n"
        "Rules:\n"
        "- Preserve the original chronology from the source text.\n"
        "- Do not invent missing details.\n"
        "- Clean up PDF noise, duplicated labels, and broken spacing.\n"
        "- Keep the output concise, readable, and professional.\n"
        "- Return plain text only.\n"
    )
    user_prompt = (
        "Restructure the following raw CV text into a readable CV layout.\n\n"
        f"CV TEXT:\n{cv_text}"
    )

    try:
        formatted = _generate_vertex_text(
            f"{system_prompt}\n\nReturn plain text only. Do not return JSON, markdown fences, or commentary.\n\n{user_prompt}"
        )
        return formatted or fallback
    except Exception:
        return fallback


def _fallback_resume_preview(cv_text: str) -> str:
    cleaned = " ".join(cv_text.split())
    if not cleaned:
        return "No extracted text stored yet."

    cleaned = cleaned.replace("PERSONAL INFORMATION", "\nPERSONAL INFORMATION\n")
    cleaned = cleaned.replace("WORK EXPERIENCE", "\nWORK EXPERIENCE\n")
    cleaned = cleaned.replace("Date ", "\nDate: ")
    cleaned = cleaned.replace("Name/address of company", "\nCompany: ")
    cleaned = cleaned.replace("Type of job", "\nRole: ")
    cleaned = cleaned.replace("Principal responsibilities", "\nResponsibilities: ")
    cleaned = cleaned.replace("Email ", "\nEmail: ")
    cleaned = cleaned.replace("Telephone No ", "\nTelephone: ")

    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    normalized_lines: list[str] = []
    for line in lines:
        if line.startswith(("Date:", "Company:", "Role:", "Responsibilities:", "Email:", "Telephone:")):
            normalized_lines.append(f"- {line}")
        else:
            normalized_lines.append(line)

    return "\n".join(normalized_lines)


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

    if not settings.vertex_project_id:
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
    except Exception:
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
