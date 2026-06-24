from __future__ import annotations

import json
import re
import ssl
from http.client import RemoteDisconnected
from urllib.parse import urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.config import settings
from app.models.vacancy import Vacancy
from app.schemas.linkedin import LinkedInPreviewRead


def build_linkedin_preview(
    vacancy: Vacancy,
    dry_run: bool = True,
    public_apply_base_url: str | None = None,
) -> LinkedInPreviewRead:
    apply_base_url = _resolve_public_apply_base_url(public_apply_base_url)
    apply_url = f"{apply_base_url.rstrip('/')}/{vacancy.id}"
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
    if not returned_post_text:
        normalized["post_text"] = suggested_post_text.replace(apply_url, normalized["apply_url"])
    else:
        normalized["post_text"] = _normalize_linkedin_post_text(
            post_text=returned_post_text,
            apply_url=normalized["apply_url"],
        )

    return normalized


def _normalize_linkedin_post_text(*, post_text: str, apply_url: str) -> str:
    clean_url = apply_url
    if "localhost" in apply_url or "127.0.0.1" in apply_url:
        clean_url = "[Application Link]"

    cleaned = post_text.strip().replace("\r\n", "\n")
    cleaned = re.sub(r"â€¢|•", "* ", cleaned)
    cleaned = re.sub(r"\s*#{1,6}\s*", "", cleaned)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = cleaned.replace("[application link generated after approval]", clean_url)
    cleaned = cleaned.replace("[Application Link]", clean_url)
    cleaned = cleaned.replace("[PLAK HIER JE URL]", clean_url)
    cleaned = re.sub(r"(?im)^Apply here:\s*.+$", f"Apply here: {clean_url}", cleaned)
    cleaned = re.sub(r"(?im)^Location:\s*", "Location: ", cleaned)
    cleaned = re.sub(r"(?im)^Job Type:\s*", "Job Type: ", cleaned)
    cleaned = re.sub(r"(?im)^Employment Type:\s*", "Employment Type: ", cleaned)
    cleaned = re.sub(r"(?im)^Salary Indication:\s*", "Salary: ", cleaned)
    cleaned = re.sub(r"(?im)^Compensation:\s*", "Compensation: ", cleaned)
    cleaned = re.sub(r"(?im)^Apply here:\s*", "Apply here: ", cleaned)
    cleaned = re.sub(r"(?m)^\s*---\s*$", "", cleaned)
    cleaned = re.sub(r"(?m)^\s*\*\s*$", "", cleaned)
    cleaned = re.sub(r"(?m)^\s*\*\s*\*\s*$", "", cleaned)
    cleaned = re.sub(
        r"(?im)^(About Us|The Role|Key Responsibilities|Requirements & Qualifications|What We Offer|How to Apply)\s*$",
        r"\n\1\n",
        cleaned,
    )
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


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
        return "[Application Link]" if ("localhost" in apply_url or "127.0.0.1" in apply_url) else apply_url

    return _normalize_linkedin_post_text(post_text=description, apply_url=apply_url)


def _resolve_public_apply_base_url(candidate: str | None) -> str:
    normalized = _normalize_public_apply_base_url(candidate)
    if normalized:
        return normalized

    fallback = _normalize_public_apply_base_url(settings.public_apply_base_url)
    if fallback:
        return fallback

    return "http://localhost:3000/apply"


def _normalize_public_apply_base_url(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip().rstrip("/")
    if not candidate:
        return None

    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return None

    is_local = hostname in {"localhost", "127.0.0.1"}
    is_vercel = hostname.endswith(".vercel.app")
    if not (is_local or is_vercel):
        return None

    path = parsed.path.rstrip("/")
    if not path.endswith("/apply"):
        path = f"{path}/apply" if path else "/apply"

    return f"{parsed.scheme}://{parsed.netloc}{path}"
