from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.config import settings
from app.models.application import Application
from app.models.vacancy import Vacancy
from app.services.application_service import ingest_public_application
from app.services.cv_pipeline_service import store_resume_from_bytes


_website_application_engine: Engine | None = None


@dataclass
class WebsiteApplicationRow:
    legacy_job_application_id: int
    website_job_info_id: int
    vacancy_id: int | None
    name: str | None
    email: str | None
    phone: str | None
    address: str | None
    hear: str | None
    cover_letter: str | None
    resume_data: bytes | None
    resume_mime: str | None
    resume_filename: str | None


def sync_website_job_applications(
    session: Session,
    *,
    limit: int = 25,
    legacy_application_ids: list[int] | None = None,
) -> dict[str, object]:
    rows = _load_website_job_application_rows(
        limit=limit,
        legacy_application_ids=legacy_application_ids,
    )
    synced_legacy_ids = _load_synced_legacy_application_ids(session)

    synced_count = 0
    skipped: list[dict[str, object]] = []
    synced_ids: list[int] = []

    for row in rows:
        if row.legacy_job_application_id in synced_legacy_ids:
            skipped.append(
                {
                    "legacy_job_application_id": row.legacy_job_application_id,
                    "reason": "already_synced",
                }
            )
            continue

        if not row.vacancy_id:
            skipped.append(
                {
                    "legacy_job_application_id": row.legacy_job_application_id,
                    "reason": "missing_hr_vacancy_id",
                    "website_job_info_id": row.website_job_info_id,
                }
            )
            continue

        if not row.email or not row.name:
            skipped.append(
                {
                    "legacy_job_application_id": row.legacy_job_application_id,
                    "reason": "missing_candidate_identity",
                }
            )
            continue

        if not row.resume_data:
            skipped.append(
                {
                    "legacy_job_application_id": row.legacy_job_application_id,
                    "reason": "missing_resume_blob",
                }
            )
            continue

        vacancy = session.get(Vacancy, row.vacancy_id)
        if vacancy is None:
            skipped.append(
                {
                    "legacy_job_application_id": row.legacy_job_application_id,
                    "reason": "vacancy_not_found_in_hr_app",
                    "vacancy_id": row.vacancy_id,
                }
            )
            continue

        stored_resume = store_resume_from_bytes(
            file_bytes=row.resume_data,
            filename=row.resume_filename,
            content_type=row.resume_mime,
        )
        ingest_public_application(
            session=session,
            vacancy=vacancy,
            stored_resume=stored_resume,
            candidate_email=row.email,
            candidate_name=row.name,
            candidate_phone=row.phone,
            address=row.address,
            how_did_you_hear=row.hear,
            cover_letter=row.cover_letter,
            location=row.address,
            source_label="website_job_apply",
            legacy_application_id=row.legacy_job_application_id,
            website_job_info_id=row.website_job_info_id,
        )
        synced_count += 1
        synced_ids.append(row.legacy_job_application_id)

    return {
        "fetched_count": len(rows),
        "synced_count": synced_count,
        "synced_legacy_job_application_ids": synced_ids,
        "skipped_count": len(skipped),
        "skipped": skipped,
    }


def _get_website_application_engine() -> Engine:
    global _website_application_engine
    if _website_application_engine is None:
        connection_url = settings.website_database_url or settings.database_url
        _website_application_engine = create_engine(connection_url, echo=False)
    return _website_application_engine


def _load_website_job_application_rows(
    *,
    limit: int,
    legacy_application_ids: list[int] | None,
) -> list[WebsiteApplicationRow]:
    where_clause = ""
    params: dict[str, object] = {"limit": max(1, min(limit, 200))}

    if legacy_application_ids:
        placeholders: list[str] = []
        normalized_ids = [int(item) for item in legacy_application_ids]
        for index, legacy_id in enumerate(normalized_ids):
            key = f"legacy_id_{index}"
            params[key] = legacy_id
            placeholders.append(f":{key}")
        where_clause = f"WHERE ja.job_applications_id IN ({', '.join(placeholders)})"

    query = text(
        f"""
        SELECT
            ja.job_applications_id,
            ji.job_info_id,
            ji.hr_vacancy_id,
            ja.name,
            ja.email,
            ja.phone,
            ja.address,
            ja.hear,
            ja.message,
            ja.resume_data,
            ja.resume_mime,
            ja.resume_filename
        FROM job_applications AS ja
        LEFT JOIN jobs_infos AS ji
          ON CAST(ja.job_category_id AS TEXT) = CAST(ji.job_info_id AS TEXT)
        {where_clause}
        ORDER BY ja.job_applications_id DESC
        LIMIT :limit
        """
    )

    with _get_website_application_engine().begin() as connection:
        result = connection.execute(query, params).fetchall()

    return [
        WebsiteApplicationRow(
            legacy_job_application_id=int(row[0]),
            website_job_info_id=int(row[1]) if row[1] is not None else 0,
            vacancy_id=int(row[2]) if row[2] is not None else None,
            name=str(row[3]).strip() if row[3] is not None else None,
            email=str(row[4]).strip() if row[4] is not None else None,
            phone=str(row[5]).strip() if row[5] is not None else None,
            address=str(row[6]).strip() if row[6] is not None else None,
            hear=str(row[7]).strip() if row[7] is not None else None,
            cover_letter=str(row[8]).strip() if row[8] is not None else None,
            resume_data=bytes(row[9]) if row[9] is not None else None,
            resume_mime=str(row[10]).strip() if row[10] is not None else None,
            resume_filename=str(row[11]).strip() if row[11] is not None else None,
        )
        for row in result
    ]


def _load_synced_legacy_application_ids(session: Session) -> set[int]:
    synced_ids: set[int] = set()
    applications = session.exec(select(Application)).all()
    for application in applications:
        parsed_data = application.parsed_data or {}
        intake_metadata = parsed_data.get("intake_metadata")
        if not isinstance(intake_metadata, dict):
            continue
        legacy_id = intake_metadata.get("legacy_job_application_id")
        if isinstance(legacy_id, int):
            synced_ids.add(legacy_id)
            continue
        if isinstance(legacy_id, str) and legacy_id.strip().isdigit():
            synced_ids.add(int(legacy_id.strip()))
    return synced_ids
