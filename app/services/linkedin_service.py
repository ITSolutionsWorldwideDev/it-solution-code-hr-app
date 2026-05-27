from __future__ import annotations

import json
import re
import ssl
from http.client import RemoteDisconnected
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.config import settings
from app.models.vacancy import Vacancy
from app.schemas.linkedin import LinkedInPreviewRead


def build_linkedin_preview(vacancy: Vacancy, dry_run: bool = True) -> LinkedInPreviewRead:
    apply_url = f"{settings.public_apply_base_url.rstrip('/')}/{vacancy.id}"
    suggested_post_text = _build_suggested_post_text(vacancy=vacancy, apply_url=apply_url)

    payload = {
        "vacancy_id": vacancy.id,
        "title": vacancy.title,
        "description": suggested_post_text,
        "summary": vacancy.ai_summary,
        "experience_level": vacancy.experience_level,
        "required_skills": vacancy.required_skills,
        "location": _get_vacancy_location(vacancy),
        "employment_type": _get_employment_type(vacancy),
        "apply_url": apply_url,
        "suggested_post_text": suggested_post_text,
        "dry_run": dry_run,
    }

    request = Request(
        settings.n8n_linkedin_preview_webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore") or str(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"n8n preview webhook returned an error: {detail}",
        ) from exc
    except URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the n8n LinkedIn preview webhook.",
        ) from exc
    except ssl.SSLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The n8n LinkedIn preview webhook failed its SSL/TLS handshake.",
        ) from exc
    except RemoteDisconnected as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The n8n LinkedIn preview webhook closed the connection unexpectedly.",
        ) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The n8n LinkedIn preview webhook returned invalid JSON.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LinkedIn preview webhook request failed: {exc.__class__.__name__}.",
        ) from exc

    try:
        normalized_payload = _normalize_preview_response(
            response_payload=response_payload,
            vacancy=vacancy,
            apply_url=apply_url,
            suggested_post_text=suggested_post_text,
        )
        return LinkedInPreviewRead(**normalized_payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="n8n returned an invalid LinkedIn preview response.",
        ) from exc


def _normalize_preview_response(
    response_payload: dict,
    vacancy: Vacancy,
    apply_url: str,
    suggested_post_text: str,
) -> dict:
    normalized = dict(response_payload)

    success_value = normalized.get("success")
    if isinstance(success_value, str):
        normalized["success"] = success_value.strip().lower() == "true"
    else:
        normalized["success"] = bool(success_value)

    dry_run_value = normalized.get("dry_run")
    if isinstance(dry_run_value, str):
        normalized["dry_run"] = dry_run_value.strip().lower() == "true"
    else:
        normalized["dry_run"] = bool(dry_run_value)

    if not normalized.get("message"):
        normalized["message"] = (
            "LinkedIn preview generated."
            if normalized["dry_run"]
            else "LinkedIn post published."
        )

    returned_apply_url = str(normalized.get("apply_url") or "").strip()
    if (not returned_apply_url) or ("example.com/apply/123" in returned_apply_url):
        normalized["apply_url"] = apply_url

    returned_post_text = str(normalized.get("post_text") or "").strip()
    if (not returned_post_text) or ("Solliciteer via onze website." in returned_post_text):
        normalized["post_text"] = suggested_post_text.replace(apply_url, normalized["apply_url"])
    else:
        normalized["post_text"] = _ensure_apply_url_in_post_text(
            post_text=returned_post_text,
            apply_url=normalized["apply_url"],
        )

    return normalized


def _ensure_apply_url_in_post_text(*, post_text: str, apply_url: str) -> str:
    cleaned_post = post_text.strip()
    if apply_url in cleaned_post:
        return cleaned_post

    placeholder_pattern = r"\[PLAK HIER JE URL\]"
    if re.search(placeholder_pattern, cleaned_post, re.IGNORECASE):
        return re.sub(placeholder_pattern, apply_url, cleaned_post, flags=re.IGNORECASE).strip()

    how_to_apply_pattern = r"(How to Apply\s*\n(?:.*\n?)*)"
    match = re.search(how_to_apply_pattern, cleaned_post, re.IGNORECASE)

    if match:
        section = match.group(1).rstrip()
        updated_section = f"{section}\n\nApply here:\n{apply_url}"
        return cleaned_post.replace(section, updated_section, 1).strip()

    joiner = "\n\n" if cleaned_post else ""
    return f"{cleaned_post}{joiner}How to Apply\nApply here:\n{apply_url}".strip()


def _get_vacancy_location(vacancy: Vacancy) -> str:
    parsed_data = vacancy.parsed_data or {}
    location = str(parsed_data.get("location") or "").strip()
    return location or "Location not set"


def _get_employment_type(vacancy: Vacancy) -> str:
    parsed_data = vacancy.parsed_data or {}
    employment_type = str(parsed_data.get("employment_type") or "").strip()
    return employment_type or "Full-time"


def _build_suggested_post_text(*, vacancy: Vacancy, apply_url: str) -> str:
    description = str(vacancy.description or "").strip()
    if not description:
        return apply_url

    return _ensure_apply_url_in_post_text(post_text=description, apply_url=apply_url)
