from __future__ import annotations

import logging
import re
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.config import settings
from app.models.vacancy import Vacancy
from app.models.website_publication import WebsitePublication
from app.schemas.website_publish import WebsitePublishRead
from app.services.uploadthing_service import upload_pdf_file_to_uploadthing
from app.services.website_pdf_service import (
    build_website_pdf_filename,
    build_website_pdf_for_vacancy,
    build_website_pdf_url,
)
from app.services.settings_service import get_general_settings_runtime, get_website_pdf_settings_runtime


_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_website_engine: Engine | None = None
logger = logging.getLogger(__name__)


def build_website_publish_preview(vacancy: Vacancy, *, public_base_url: str) -> WebsitePublishRead:
    mapped_fields = _build_mapped_fields(vacancy, public_base_url=public_base_url)
    return WebsitePublishRead(
        success=True,
        dry_run=True,
        message="Website payload preview generated.",
        published=bool(mapped_fields["published"]),
        action="preview",
        job_info_id=None,
        pdf_generated=False,
        pdf_filename=str(mapped_fields.get("pdf_filename") or ""),
        pdf_url=str(mapped_fields.get("pdf_url") or ""),
        mapped_fields=mapped_fields,
    )


def generate_website_pdf_preview(vacancy: Vacancy, *, public_base_url: str) -> WebsitePublishRead:
    _pdf_path, filename = build_website_pdf_for_vacancy(vacancy)
    mapped_fields = _build_mapped_fields(vacancy, public_base_url=public_base_url)
    pdf_url = str(mapped_fields.get("pdf_url") or "")
    return WebsitePublishRead(
        success=True,
        dry_run=False,
        message="Website PDF generated locally. Review it before publishing.",
        published=False,
        action="generated_pdf",
        job_info_id=None,
        pdf_generated=True,
        pdf_filename=filename,
        pdf_url=pdf_url,
        mapped_fields=mapped_fields,
    )


def publish_vacancy_to_website(session: Session, vacancy: Vacancy, *, public_base_url: str) -> WebsitePublishRead:
    pdf_path, filename = build_website_pdf_for_vacancy(vacancy)
    uploaded_pdf = upload_pdf_file_to_uploadthing(pdf_path)
    mapped_fields = _build_mapped_fields(
        vacancy,
        public_base_url=public_base_url,
        pdf_url=uploaded_pdf.ufs_url,
    )
    website_settings = get_website_pdf_settings_runtime(session=session)
    schema_name, table_name = _parse_table_name(website_settings.active_website_publish_table_name)
    qualified_table_name = _qualify_table_name(schema_name, table_name)

    try:
        with _get_website_engine().begin() as connection:
            columns = _load_table_columns(connection, schema_name, table_name)
            if not columns:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        f"Website jobs table '{website_settings.active_website_publish_table_name}' was not found. "
                        "Set WEBSITE_DATABASE_URL and WEBSITE_JOBS_TABLE to the website database."
                    ),
                )

            _ensure_required_columns(columns)
            job_info_id_column = _resolve_job_info_id_column(columns)
            payload = _filter_insertable_payload(mapped_fields, columns)
            lookup_id = _resolve_existing_job_info_id(
                session=session,
                connection=connection,
                qualified_table_name=qualified_table_name,
                job_info_id_column=job_info_id_column,
                columns=columns,
                vacancy=vacancy,
            )

            if lookup_id is None:
                job_info_id = _insert_job_info(
                    connection=connection,
                    qualified_table_name=qualified_table_name,
                    payload=payload,
                    job_info_id_column=job_info_id_column,
                )
                action = "created"
                message = "Vacancy published to website."
            else:
                _update_job_info(
                    connection=connection,
                    qualified_table_name=qualified_table_name,
                    payload=payload,
                    job_info_id_column=job_info_id_column,
                    job_info_id=lookup_id,
                    columns=columns,
                )
                job_info_id = lookup_id
                action = "updated"
                message = "Website publication updated."
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Website publish database request failed: {exc.__class__.__name__}.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Website publish failed: {exc}",
        ) from exc

    _upsert_publication_mapping(session=session, vacancy_id=vacancy.id, job_info_id=job_info_id)

    return WebsitePublishRead(
        success=True,
        dry_run=False,
        message=message,
        published=bool(mapped_fields["published"]),
        action=action,
        job_info_id=job_info_id,
        pdf_generated=True,
        pdf_filename=filename,
        pdf_url=str(mapped_fields.get("pdf_url") or ""),
        mapped_fields=mapped_fields,
    )


def delete_vacancy_from_website(session: Session, vacancy: Vacancy, *, public_base_url: str) -> WebsitePublishRead:
    mapped_fields = _build_mapped_fields(vacancy, public_base_url=public_base_url)
    website_settings = get_website_pdf_settings_runtime(session=session)
    schema_name, table_name = _parse_table_name(website_settings.active_website_publish_table_name)
    qualified_table_name = _qualify_table_name(schema_name, table_name)

    try:
        with _get_website_engine().begin() as connection:
            columns = _load_table_columns(connection, schema_name, table_name)
            if not columns:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        f"Website jobs table '{website_settings.active_website_publish_table_name}' was not found. "
                        "Set WEBSITE_DATABASE_URL and WEBSITE_JOBS_TABLE to the website database."
                    ),
                )

            job_info_id_column = _resolve_job_info_id_column(columns)
            lookup_id = _resolve_existing_job_info_id(
                session=session,
                connection=connection,
                qualified_table_name=qualified_table_name,
                job_info_id_column=job_info_id_column,
                columns=columns,
                vacancy=vacancy,
            )

            if lookup_id is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="This vacancy is not currently published to the website.",
                )

            connection.execute(
                text(
                    f"DELETE FROM {qualified_table_name} "
                    f"WHERE {_quote_identifier(job_info_id_column)} = :job_info_id"
                ),
                {"job_info_id": lookup_id},
            )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Website delete database request failed: {exc.__class__.__name__}.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Website delete failed: {exc}",
        ) from exc

    _delete_publication_mapping(session=session, vacancy_id=vacancy.id)

    return WebsitePublishRead(
        success=True,
        dry_run=False,
        message="Vacancy removed from website.",
        published=False,
        action="deleted",
        job_info_id=lookup_id,
        pdf_generated=False,
        pdf_filename=str(mapped_fields.get("pdf_filename") or ""),
        pdf_url=str(mapped_fields.get("pdf_url") or ""),
        mapped_fields=mapped_fields,
    )


def auto_publish_vacancy_to_website(session: Session, vacancy: Vacancy, *, public_base_url: str) -> WebsitePublishRead | None:
    try:
        return publish_vacancy_to_website(session, vacancy, public_base_url=public_base_url)
    except HTTPException as exc:
        logger.warning(
            "Automatic website publish failed for vacancy %s: %s",
            vacancy.id,
            exc.detail,
        )
    except Exception:
        logger.exception("Automatic website publish crashed for vacancy %s", vacancy.id)
    return None


def _build_mapped_fields(
    vacancy: Vacancy,
    *,
    public_base_url: str,
    pdf_url: str | None = None,
) -> dict[str, object]:
    general_settings = get_general_settings_runtime()
    website_settings = get_website_pdf_settings_runtime()
    title = str(vacancy.title or "").strip()

    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vacancy title is required before publishing to the website.",
        )

    parsed_data = vacancy.parsed_data or {}
    location = str(parsed_data.get("location") or "").strip() or "Location not set"
    employment_type = str(parsed_data.get("employment_type") or "").strip() or "Full-time"
    content = str(vacancy.description or "").strip()
    pdf_filename = build_website_pdf_filename(vacancy)
    resolved_pdf_url = pdf_url or build_website_pdf_url(filename=pdf_filename, public_base_url=public_base_url)
    apply_url = f"{general_settings.public_apply_base_url.rstrip('/')}/{vacancy.id}"
    slug = _build_website_job_slug(title)

    created_by = website_settings.website_publisher_user_id
    if created_by is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A website publisher user id is required for website publishing.",
        )

    return {
        "title": title,
        "location": location,
        "type": employment_type,
        "content": content,
        "hr_vacancy_id": vacancy.id,
        "slug": slug,
        "apply_url": apply_url,
        "summary": str(vacancy.ai_summary or "").strip(),
        "pdf_filename": pdf_filename,
        "pdf_url": resolved_pdf_url,
        "published": 1,
        "created_by": created_by,
    }


def _build_website_job_slug(title: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower()
    return slug or "vacancy"


def _get_website_engine() -> Engine:
    global _website_engine
    if _website_engine is None:
        connection_url = settings.website_database_url or settings.database_url
        _website_engine = create_engine(connection_url, echo=False)
    return _website_engine


def _parse_table_name(value: str) -> tuple[str, str]:
    cleaned = value.strip()
    if "." in cleaned:
        schema_name, table_name = cleaned.split(".", 1)
    else:
        schema_name, table_name = "public", cleaned

    for part in (schema_name, table_name):
        if not _IDENTIFIER_PATTERN.match(part):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid website table identifier: {value}.",
            )

    return schema_name, table_name


def _qualify_table_name(schema_name: str, table_name: str) -> str:
    return f'"{schema_name}"."{table_name}"'


def _quote_identifier(value: str) -> str:
    if not _IDENTIFIER_PATTERN.match(value):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid SQL identifier: {value}.",
        )
    return f'"{value}"'


def _load_table_columns(connection, schema_name: str, table_name: str) -> set[str]:
    result = connection.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema_name
              AND table_name = :table_name
            """
        ),
        {"schema_name": schema_name, "table_name": table_name},
    )
    return {str(row[0]) for row in result}


def _ensure_required_columns(columns: set[str]) -> None:
    missing = sorted({"title", "location", "type", "published", "created_by"} - columns)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Website jobs table is missing required columns: {', '.join(missing)}.",
        )


def _resolve_job_info_id_column(columns: set[str]) -> str:
    for candidate in ("job_info_id", "id"):
        if candidate in columns:
            return candidate

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Could not determine the primary key column for the website jobs table.",
    )


def _filter_insertable_payload(mapped_fields: dict[str, object], columns: set[str]) -> dict[str, object]:
    payload = {
        key: value
        for key, value in mapped_fields.items()
        if key in columns and key != "pdf_filename"
    }
    if "created_at" in columns:
        payload["created_at"] = datetime.utcnow()
    if "updated_at" in columns:
        payload["updated_at"] = datetime.utcnow()
    return payload


def _resolve_existing_job_info_id(
    *,
    session: Session,
    connection,
    qualified_table_name: str,
    job_info_id_column: str,
    columns: set[str],
    vacancy: Vacancy,
) -> int | None:
    mapping = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy.id)
    ).first()

    if mapping is not None:
        exists = connection.execute(
            text(
                f"SELECT {_quote_identifier(job_info_id_column)} FROM {qualified_table_name} "
                f"WHERE {_quote_identifier(job_info_id_column)} = :job_info_id"
            ),
            {"job_info_id": mapping.job_info_id},
        ).first()
        if exists is not None:
            return int(mapping.job_info_id)

    if {"title", job_info_id_column}.issubset(columns):
        matched = connection.execute(
            text(
                f"SELECT {_quote_identifier(job_info_id_column)} "
                f"FROM {qualified_table_name} "
                f"WHERE {_quote_identifier('title')} = :title "
                f"ORDER BY {_quote_identifier(job_info_id_column)} DESC LIMIT 1"
            ),
            {
                "title": vacancy.title.strip(),
            },
        ).first()
        if matched is not None:
            return int(matched[0])

    return None


def _insert_job_info(*, connection, qualified_table_name: str, payload: dict[str, object], job_info_id_column: str) -> int:
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No website publish fields matched the target table schema.",
        )

    column_names = list(payload.keys())
    column_sql = ", ".join(_quote_identifier(name) for name in column_names)
    value_sql = ", ".join(f":{name}" for name in column_names)

    result = connection.execute(
        text(
            f"INSERT INTO {qualified_table_name} ({column_sql}) "
            f"VALUES ({value_sql}) RETURNING {_quote_identifier(job_info_id_column)}"
        ),
        payload,
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Website publish insert did not return a job_info_id.",
        )
    return int(row[0])


def _update_job_info(
    *,
    connection,
    qualified_table_name: str,
    payload: dict[str, object],
    job_info_id_column: str,
    job_info_id: int,
    columns: set[str],
) -> None:
    update_payload = dict(payload)
    if "created_by" in update_payload:
        update_payload.pop("created_by")
    if "created_at" in columns:
        update_payload.pop("created_at", None)
    if "updated_at" in columns and "updated_at" not in update_payload:
        update_payload["updated_at"] = datetime.utcnow()

    assignments = ", ".join(
        f"{_quote_identifier(column_name)} = :{column_name}" for column_name in update_payload
    )
    connection.execute(
        text(
            f"UPDATE {qualified_table_name} SET {assignments} "
            f"WHERE {_quote_identifier(job_info_id_column)} = :job_info_id"
        ),
        {
            **update_payload,
            "job_info_id": job_info_id,
        },
    )


def _upsert_publication_mapping(*, session: Session, vacancy_id: int, job_info_id: int) -> None:
    mapping = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy_id)
    ).first()

    if mapping is None:
        mapping = WebsitePublication(vacancy_id=vacancy_id, job_info_id=job_info_id)
    else:
        mapping.job_info_id = job_info_id
        mapping.updated_at = datetime.utcnow()

    session.add(mapping)
    session.commit()


def _delete_publication_mapping(*, session: Session, vacancy_id: int) -> None:
    mapping = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy_id)
    ).first()
    if mapping is None:
        return

    session.delete(mapping)
    session.commit()
