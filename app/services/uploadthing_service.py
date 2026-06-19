from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from fastapi import HTTPException, status

from app.config import settings


_UPLOADTHING_API_BASE_URL = "https://api.uploadthing.com"
_UPLOADTHING_TIMEOUT_SECONDS = 60


@dataclass(frozen=True)
class UploadThingPreparedUpload:
    key: str
    url: str


@dataclass(frozen=True)
class UploadThingUploadedFile:
    key: str
    ufs_url: str
    file_hash: str | None


def upload_pdf_file_to_uploadthing(pdf_path: Path, *, custom_id: str | None = None) -> UploadThingUploadedFile:
    if not pdf_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generated PDF file was not found: {pdf_path.name}.",
        )

    file_size = pdf_path.stat().st_size
    prepared = _prepare_upload(
        file_name=pdf_path.name,
        file_size=file_size,
        file_type="application/pdf",
        custom_id=custom_id,
    )

    with pdf_path.open("rb") as file_handle:
        return _upload_prepared_file(
            prepared=prepared,
            file_name=pdf_path.name,
            file_handle=file_handle,
            file_type="application/pdf",
        )


def upload_pdf_bytes_to_uploadthing(
    *,
    filename: str,
    content: bytes,
    custom_id: str | None = None,
) -> UploadThingUploadedFile:
    prepared = _prepare_upload(
        file_name=filename,
        file_size=len(content),
        file_type="application/pdf",
        custom_id=custom_id,
    )
    return _upload_prepared_file(
        prepared=prepared,
        file_name=filename,
        file_handle=content,
        file_type="application/pdf",
    )


def _prepare_upload(
    *,
    file_name: str,
    file_size: int,
    file_type: str,
    custom_id: str | None,
) -> UploadThingPreparedUpload:
    api_key = _resolve_uploadthing_api_key()
    payload: dict[str, Any] = {
        "fileName": file_name,
        "fileSize": file_size,
        "fileType": file_type,
        "contentDisposition": "inline",
    }
    if custom_id:
        payload["customId"] = custom_id

    try:
        response = requests.post(
            f"{_UPLOADTHING_API_BASE_URL}/v7/prepareUpload",
            headers={
                "x-uploadthing-api-key": api_key,
                "content-type": "application/json",
            },
            json=payload,
            timeout=_UPLOADTHING_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UploadThing prepareUpload request failed: {exc.__class__.__name__}.",
        ) from exc

    response_payload = _parse_json_response(response, action="prepareUpload")
    if response.status_code >= 400:
        message = _extract_uploadthing_error_message(response_payload)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UploadThing prepareUpload failed: {message}",
        )

    upload_url = str(response_payload.get("url") or "").strip()
    upload_key = str(response_payload.get("key") or "").strip()
    if not upload_url or not upload_key:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UploadThing prepareUpload response did not include url and key.",
        )

    return UploadThingPreparedUpload(key=upload_key, url=upload_url)


def _upload_prepared_file(
    *,
    prepared: UploadThingPreparedUpload,
    file_name: str,
    file_handle,
    file_type: str,
) -> UploadThingUploadedFile:
    try:
        response = requests.put(
            prepared.url,
            files={"file": (file_name, file_handle, file_type)},
            headers={"Range": "bytes=0-"},
            timeout=_UPLOADTHING_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UploadThing file upload failed: {exc.__class__.__name__}.",
        ) from exc

    response_payload = _parse_json_response(response, action="file upload")
    if response.status_code >= 400:
        message = _extract_uploadthing_error_message(response_payload)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UploadThing file upload failed: {message}",
        )

    ufs_url = str(response_payload.get("ufsUrl") or "").strip()
    if not ufs_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UploadThing upload response did not include ufsUrl.",
        )

    return UploadThingUploadedFile(
        key=str(response_payload.get("key") or prepared.key),
        ufs_url=ufs_url,
        file_hash=str(response_payload.get("fileHash") or "") or None,
    )


def _resolve_uploadthing_api_key() -> str:
    api_key = (settings.uploadthing_secret or "").strip()
    if api_key:
        _validate_token_consistency()
        return api_key

    token = (settings.uploadthing_token or "").strip()
    if token:
        token_data = _decode_uploadthing_token(token)
        return token_data["apiKey"]

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=(
            "UploadThing is not configured. Set UPLOADTHING_SECRET or UPLOADTHING_TOKEN "
            "before publishing vacancies to the website."
        ),
    )


def _validate_token_consistency() -> None:
    token = (settings.uploadthing_token or "").strip()
    if not token:
        return

    token_data = _decode_uploadthing_token(token)
    configured_app_id = (settings.uploadthing_app_id or "").strip()
    configured_secret = (settings.uploadthing_secret or "").strip()

    if configured_app_id and configured_app_id != token_data["appId"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="UPLOADTHING_APP_ID does not match the provided UPLOADTHING_TOKEN.",
        )

    if configured_secret and configured_secret != token_data["apiKey"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="UPLOADTHING_SECRET does not match the provided UPLOADTHING_TOKEN.",
        )


def _decode_uploadthing_token(token: str) -> dict[str, Any]:
    try:
        padded = token + "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        payload = json.loads(raw)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="UPLOADTHING_TOKEN is invalid and could not be decoded.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="UPLOADTHING_TOKEN payload is invalid.",
        )

    api_key = str(payload.get("apiKey") or "").strip()
    app_id = str(payload.get("appId") or "").strip()
    if not api_key or not app_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="UPLOADTHING_TOKEN is missing apiKey or appId data.",
        )
    return {"apiKey": api_key, "appId": app_id}


def _parse_json_response(response: requests.Response, *, action: str) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UploadThing {action} returned a non-JSON response.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UploadThing {action} returned an unexpected response shape.",
        )
    return payload


def _extract_uploadthing_error_message(payload: dict[str, Any]) -> str:
    for key in ("error", "message"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "unknown UploadThing error"
