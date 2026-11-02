from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

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


_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_itww_engine: Engine | None = None
_ish_engine: Engine | None = None
_dinel_engine: Engine | None = None
logger = logging.getLogger(__name__)


def _normalize_portals(portal: str | None) -> list[str]:
    """
    Normalizes input target_portal string into a list of portals:
    ['itww', 'ish', 'dinel']
    """
    cleaned = (portal or "all").strip().lower()
    if cleaned in ("all", "all_portals", "all three", "all_three"):
        return ["itww", "ish", "dinel"]
    if cleaned in ("both", "itww_and_ish"):
        return ["itww", "ish"]

    parts = [p.strip() for p in cleaned.replace(";", ",").replace("&", ",").split(",") if p.strip()]
    resolved: list[str] = []
    for p in parts:
        if p in ("itww", "worldwide"):
            if "itww" not in resolved:
                resolved.append("itww")
        elif p in ("ish", "itsh", "hub"):
            if "ish" not in resolved:
                resolved.append("ish")
        elif p in ("dinel", "staff_outsourcing", "staffoutsourcing", "outsourcing"):
            if "dinel" not in resolved:
                resolved.append("dinel")
        elif p in ("all", "all_portals"):
            return ["itww", "ish", "dinel"]
        elif p == "both":
            for x in ("itww", "ish"):
                if x not in resolved:
                    resolved.append(x)

    return resolved or ["itww", "ish", "dinel"]


def _portal_label(portals: list[str] | str) -> str:
    if isinstance(portals, str):
        portals = _normalize_portals(portals)

    labels_map = {
        "itww": "IT Solutions Worldwide (ITWW)",
        "ish": "IT Solutions Hub (ISH)",
        "dinel": "Staff Outsourcing",
    }
    if set(portals) == {"itww", "ish", "dinel"}:
        return "All 3 Portals (ITWW, ISH & Staff Outsourcing)"
    if set(portals) == {"itww", "ish"}:
        return "ITWW & ISH"
    return ", ".join(labels_map.get(p, p) for p in portals)



def build_website_publish_preview(
    vacancy: Vacancy,
    *,
    public_base_url: str,
    target_portal: str = "all",
) -> WebsitePublishRead:
    portals = _normalize_portals(target_portal)
    mapped_fields = _build_mapped_fields(vacancy, public_base_url=public_base_url)
    return WebsitePublishRead(
        success=True,
        dry_run=True,
        message=f"Website payload preview generated for {_portal_label(portals)}.",
        published=bool(mapped_fields["published"]),
        action="preview",
        job_info_id=None,
        itww_job_info_id=None,
        ish_job_info_id=None,
        dinel_job_info_id=None,
        pdf_generated=False,
        pdf_filename=str(mapped_fields.get("pdf_filename") or ""),
        pdf_url=str(mapped_fields.get("pdf_url") or ""),
        target_portal=",".join(portals),
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
        itww_job_info_id=None,
        ish_job_info_id=None,
        dinel_job_info_id=None,
        pdf_generated=True,
        pdf_filename=filename,
        pdf_url=pdf_url,
        mapped_fields=mapped_fields,
    )


def publish_vacancy_to_website(
    session: Session,
    vacancy: Vacancy,
    *,
    public_base_url: str,
    target_portal: str = "all",
) -> WebsitePublishRead:
    portals = _normalize_portals(target_portal)
    target_portal_str = ",".join(portals)

    # Persist target_portal in vacancy parsed_data
    parsed = dict(vacancy.parsed_data or {})
    parsed["target_portal"] = target_portal_str
    vacancy.parsed_data = parsed
    session.add(vacancy)
    session.commit()

    # Generate PDF and upload if configured
    pdf_path, filename = build_website_pdf_for_vacancy(vacancy)
    try:
        uploaded_pdf = upload_pdf_file_to_uploadthing(pdf_path)
        pdf_url = uploaded_pdf.ufs_url
    except Exception:
        pdf_url = ""

    mapped_fields = _build_mapped_fields(
        vacancy,
        public_base_url=public_base_url,
        pdf_url=pdf_url or None,
    )

    # Fetch existing publication mappings to avoid duplicate creation
    existing_pub = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy.id)
    ).first()

    tracked_itww_id = (
        (existing_pub.itww_job_info_id if existing_pub else None)
        or parsed.get("itww_job_info_id")
    )
    tracked_ish_id = (
        (existing_pub.ish_job_info_id if existing_pub else None)
        or parsed.get("ish_job_info_id")
    )
    tracked_dinel_id = (
        (existing_pub.dinel_job_info_id if existing_pub else None)
        or parsed.get("dinel_job_info_id")
    )

    itww_job_info_id: int | None = tracked_itww_id
    ish_job_info_id: int | None = tracked_ish_id
    dinel_job_info_id: int | None = tracked_dinel_id
    actions_taken: list[str] = []

    # 1. Publish to ITWW (if in portals)
    if "itww" in portals:
        itww_engine = _get_itww_engine()
        if itww_engine:
            schema_name, table_name = _parse_table_name(settings.website_jobs_table)
            try:
                with itww_engine.begin() as conn:
                    itww_job_info_id, itww_act = _upsert_job_in_portal_db(
                        connection=conn,
                        schema_name=schema_name,
                        table_name=table_name,
                        mapped_fields=mapped_fields,
                        vacancy=vacancy,
                        portal_name="itww",
                        tracked_id=tracked_itww_id,
                    )
                    actions_taken.append(f"ITWW #{itww_job_info_id} ({itww_act})")
            except HTTPException:
                raise
            except SQLAlchemyError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"ITWW database publication error: {exc.__class__.__name__}",
                ) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to publish to ITWW: {exc}",
                ) from exc

    # 2. Publish to ISH (if in portals)
    if "ish" in portals:
        ish_engine = _get_ish_engine()
        if ish_engine:
            schema_name, table_name = _parse_table_name(settings.website_jobs_table)
            try:
                with ish_engine.begin() as conn:
                    ish_job_info_id, ish_act = _upsert_job_in_portal_db(
                        connection=conn,
                        schema_name=schema_name,
                        table_name=table_name,
                        mapped_fields=mapped_fields,
                        vacancy=vacancy,
                        portal_name="ish",
                        tracked_id=tracked_ish_id,
                    )
                    actions_taken.append(f"ISH #{ish_job_info_id} ({ish_act})")
            except HTTPException:
                raise
            except SQLAlchemyError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"ISH database publication error: {exc.__class__.__name__}",
                ) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to publish to ISH: {exc}",
                ) from exc

    # 3. Publish to Dinel (Staff Outsourcing) (if in portals)
    if "dinel" in portals:
        dinel_engine = _get_dinel_engine()
        if dinel_engine:
            schema_name, table_name = _parse_table_name(settings.dinel_jobs_table)
            try:
                with dinel_engine.begin() as conn:
                    dinel_job_info_id, dinel_act = _upsert_job_in_dinel_db(
                        connection=conn,
                        schema_name=schema_name,
                        table_name=table_name,
                        vacancy=vacancy,
                        tracked_id=tracked_dinel_id,
                    )
                    actions_taken.append(f"Staff Outsourcing #{dinel_job_info_id} ({dinel_act})")
            except HTTPException:
                raise
            except SQLAlchemyError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Staff Outsourcing database error: {exc.__class__.__name__}",
                ) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to publish to Staff Outsourcing: {exc}",
                ) from exc

    primary_job_info_id = itww_job_info_id or ish_job_info_id or dinel_job_info_id or vacancy.id

    # Update publication tracking in recruitment DB
    _upsert_publication_mapping(
        session=session,
        vacancy_id=vacancy.id,
        job_info_id=primary_job_info_id,
        itww_job_info_id=itww_job_info_id,
        ish_job_info_id=ish_job_info_id,
        dinel_job_info_id=dinel_job_info_id,
        target_portal=target_portal_str,
    )

    # Persist mapped IDs in vacancy parsed_data as well
    parsed["itww_job_info_id"] = itww_job_info_id
    parsed["ish_job_info_id"] = ish_job_info_id
    parsed["dinel_job_info_id"] = dinel_job_info_id
    vacancy.parsed_data = parsed
    session.add(vacancy)
    session.commit()

    overall_action = "created" if any("created" in a for a in actions_taken) else "updated"
    message = f"Vacancy published to {_portal_label(portals)}: {', '.join(actions_taken)}."

    return WebsitePublishRead(
        success=True,
        dry_run=False,
        message=message,
        published=bool(mapped_fields["published"]),
        action=overall_action,
        job_info_id=primary_job_info_id,
        itww_job_info_id=itww_job_info_id,
        ish_job_info_id=ish_job_info_id,
        dinel_job_info_id=dinel_job_info_id,
        pdf_generated=True,
        pdf_filename=filename,
        pdf_url=str(mapped_fields.get("pdf_url") or ""),
        target_portal=target_portal_str,
        mapped_fields=mapped_fields,
    )


def delete_vacancy_from_website(
    session: Session,
    vacancy: Vacancy,
    *,
    public_base_url: str,
) -> WebsitePublishRead:
    mapped_fields = _build_mapped_fields(vacancy, public_base_url=public_base_url)
    schema_name, table_name = _parse_table_name(settings.website_jobs_table)

    parsed = vacancy.parsed_data or {}
    existing_pub = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy.id)
    ).first()

    itww_id = (existing_pub.itww_job_info_id if existing_pub else None) or parsed.get("itww_job_info_id")
    ish_id = (existing_pub.ish_job_info_id if existing_pub else None) or parsed.get("ish_job_info_id")
    dinel_id = (existing_pub.dinel_job_info_id if existing_pub else None) or parsed.get("dinel_job_info_id")
    target_portal = (existing_pub.target_portal if existing_pub else None) or str(parsed.get("target_portal") or "all")

    v_title = (vacancy.title or "").strip()
    v_slug = _build_website_job_slug(v_title)

    deleted_notes: list[str] = []

    # 1. Delete from ITWW (by ID AND by title)
    itww_engine = _get_itww_engine()
    if itww_engine:
        try:
            with itww_engine.begin() as conn:
                conditions = []
                params = {}
                if itww_id:
                    conditions.append("job_info_id = :jid")
                    params["jid"] = itww_id
                if v_title:
                    conditions.append("LOWER(TRIM(title)) = LOWER(TRIM(:title))")
                    params["title"] = v_title
                if conditions:
                    sql = f"DELETE FROM {settings.website_jobs_table} WHERE {' OR '.join(conditions)}"
                    conn.execute(text(sql), params)
                    deleted_notes.append("ITWW")
        except Exception as exc:
            logger.warning("Could not delete from ITWW: %s", exc)

    # 2. Delete from ISH (by ID AND by title)
    ish_engine = _get_ish_engine()
    if ish_engine:
        try:
            with ish_engine.begin() as conn:
                conditions = []
                params = {}
                if ish_id:
                    conditions.append("job_info_id = :jid")
                    params["jid"] = ish_id
                if v_title:
                    conditions.append("LOWER(TRIM(title)) = LOWER(TRIM(:title))")
                    params["title"] = v_title
                if conditions:
                    sql = f"DELETE FROM {settings.website_jobs_table} WHERE {' OR '.join(conditions)}"
                    conn.execute(text(sql), params)
                    deleted_notes.append("ISH")
        except Exception as exc:
            logger.warning("Could not delete from ISH: %s", exc)

    # 3. Delete from Dinel (Staff Outsourcing) (by ID, by slug, AND by title)
    dinel_engine = _get_dinel_engine()
    if dinel_engine:
        try:
            with dinel_engine.begin() as conn:
                conditions = []
                params = {}
                if dinel_id:
                    conditions.append("id = :jid")
                    params["jid"] = dinel_id
                if v_slug:
                    conditions.append("slug = :slug")
                    params["slug"] = v_slug
                if v_title:
                    conditions.append("LOWER(TRIM(title)) = LOWER(TRIM(:title))")
                    params["title"] = v_title
                if conditions:
                    sql = f"DELETE FROM {settings.dinel_jobs_table} WHERE {' OR '.join(conditions)}"
                    conn.execute(text(sql), params)
                    deleted_notes.append("Staff Outsourcing")
        except Exception as exc:
            logger.warning("Could not delete from Staff Outsourcing: %s", exc)

    # Clean publication record
    _delete_publication_mapping(session=session, vacancy_id=vacancy.id)

    # Remove tracking from vacancy parsed_data
    parsed_updated = dict(parsed)
    parsed_updated.pop("itww_job_info_id", None)
    parsed_updated.pop("ish_job_info_id", None)
    parsed_updated.pop("dinel_job_info_id", None)
    vacancy.parsed_data = parsed_updated
    session.add(vacancy)
    session.commit()

    return WebsitePublishRead(
        success=True,
        dry_run=False,
        message=f"Vacancy removed from {', '.join(deleted_notes) if deleted_notes else 'career portals'}.",
        published=False,
        action="deleted",
        job_info_id=itww_id or ish_id or dinel_id,
        itww_job_info_id=None,
        ish_job_info_id=None,
        dinel_job_info_id=None,
        pdf_generated=False,
        pdf_filename=str(mapped_fields.get("pdf_filename") or ""),
        pdf_url=str(mapped_fields.get("pdf_url") or ""),
        target_portal=target_portal,
        mapped_fields=mapped_fields,
    )


def auto_publish_vacancy_to_website(
    session: Session,
    vacancy: Vacancy,
    *,
    public_base_url: str,
) -> WebsitePublishRead | None:
    try:
        target_portal = str((vacancy.parsed_data or {}).get("target_portal") or "both")
        return publish_vacancy_to_website(
            session,
            vacancy,
            public_base_url=public_base_url,
            target_portal=target_portal,
        )
    except HTTPException as exc:
        logger.warning(
            "Automatic website publish failed for vacancy %s: %s",
            vacancy.id,
            exc.detail,
        )
    except Exception:
        logger.exception("Automatic website publish crashed for vacancy %s", vacancy.id)
    return None


# -----------------------------------------------------------------------------
# INTERNAL HELPERS & SQL LAYER
# -----------------------------------------------------------------------------

def _compose_markdown_content(vacancy: Vacancy) -> str:
    """
    Builds the standardized markdown content required by both ITWW and ISH:
    ## About the Role
    ## Key Responsibilities
    ## Requirements
    ## Nice to Have
    ## Additional Information
    """
    parsed = vacancy.parsed_data or {}

    about_role = str(parsed.get("about_role") or parsed.get("aboutRole") or "").strip()
    resps = parsed.get("responsibilities") or parsed.get("whatYoullDo") or []
    reqs = parsed.get("requirements") or parsed.get("whatYoullBring") or list(vacancy.required_skills or [])
    nice = parsed.get("nice_to_have") or parsed.get("niceToHave") or []
    additional = str(parsed.get("additional_info") or parsed.get("additionalInfo") or "").strip()

    # If structured fields were saved explicitly in parsed_data
    if about_role or resps or reqs or nice or additional:
        sections: list[str] = []
        if about_role:
            sections.append(f"## About the Role\n\n{about_role}")
        elif vacancy.description:
            # Fallback for overview
            first_p = vacancy.description.split("\n\n")[0].strip()
            if first_p:
                sections.append(f"## About the Role\n\n{first_p}")

        if isinstance(resps, list) and resps:
            bullets = [f"- {str(r).strip().lstrip('-*• ')}" for r in resps if str(r).strip()]
            if bullets:
                sections.append(f"## Key Responsibilities\n\n" + "\n".join(bullets))

        if isinstance(reqs, list) and reqs:
            bullets = [f"- {str(r).strip().lstrip('-*• ')}" for r in reqs if str(r).strip()]
            if bullets:
                sections.append(f"## Requirements\n\n" + "\n".join(bullets))

        if isinstance(nice, list) and nice:
            bullets = [f"- {str(n).strip().lstrip('-*• ')}" for n in nice if str(n).strip()]
            if bullets:
                sections.append(f"## Nice to Have\n\n" + "\n".join(bullets))

        if additional:
            sections.append(f"## Additional Information\n\n{additional}")

        if sections:
            return "\n\n".join(sections)

    # If only description is available, check if already formatted with markdown headings
    desc = str(vacancy.description or "").strip()
    if (
        "## About the Role" in desc
        or "## Key Responsibilities" in desc
        or "## What You'll Do" in desc
        or "## What You’ll Do" in desc
        or "## Requirements" in desc
        or "## What You'll Bring" in desc
        or "## What You’ll Bring" in desc
    ):
        return desc

    # Otherwise parse unstructured text into standardized markdown
    lines = desc.split("\n")
    overview_lines: list[str] = []
    resp_lines: list[str] = []
    req_lines: list[str] = []
    nice_lines: list[str] = []
    other_lines: list[str] = []
    current_sec = "overview"

    for raw in lines:
        stripped = raw.strip()
        if not stripped:
            continue
        clean_heading = re.sub(r"^[#*_\s]+|[#*_\s:]+$", "", stripped).lower()
        if clean_heading in ("about the role", "position overview", "about us", "role overview"):
            current_sec = "overview"
            continue
        if clean_heading in ("responsibilities", "key responsibilities", "what you'll do", "duties", "core responsibilities"):
            current_sec = "resp"
            continue
        if clean_heading in ("requirements", "requirements & qualifications", "skills & requirements", "qualifications", "what you'll bring"):
            current_sec = "req"
            continue
        if clean_heading in ("nice to have", "what we offer", "benefits", "perks", "good to have"):
            current_sec = "nice"
            continue
        if clean_heading in ("additional information", "additional info", "notes"):
            current_sec = "other"
            continue

        item = re.sub(r"^[-*•\d+.)]+\s*", "", stripped)
        if current_sec == "overview":
            overview_lines.append(stripped)
        elif current_sec == "resp":
            resp_lines.append(f"- {item}")
        elif current_sec == "req":
            req_lines.append(f"- {item}")
        elif current_sec == "nice":
            nice_lines.append(f"- {item}")
        elif current_sec == "other":
            other_lines.append(stripped)

    composed: list[str] = []
    if overview_lines:
        composed.append(f"## About the Role\n\n" + "\n".join(overview_lines))
    if resp_lines:
        composed.append(f"## Key Responsibilities\n\n" + "\n".join(resp_lines))
    if req_lines:
        composed.append(f"## Requirements\n\n" + "\n".join(req_lines))
    elif vacancy.required_skills:
        skill_bullets = [f"- {s}" for s in vacancy.required_skills]
        composed.append(f"## Requirements\n\n" + "\n".join(skill_bullets))
    if nice_lines:
        composed.append(f"## Nice to Have\n\n" + "\n".join(nice_lines))
    if other_lines:
        composed.append(f"## Additional Information\n\n" + "\n".join(other_lines))

    return "\n\n".join(composed) if composed else desc


def _build_mapped_fields(
    vacancy: Vacancy,
    *,
    public_base_url: str,
    pdf_url: str | None = None,
) -> dict[str, object]:
    title = str(vacancy.title or "").strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vacancy title is required before publishing to the website.",
        )

    parsed_data = vacancy.parsed_data or {}
    location = str(parsed_data.get("location") or "").strip() or "Location not set"
    employment_type = str(parsed_data.get("employment_type") or "").strip() or "Full-time"
    content = _compose_markdown_content(vacancy)
    pdf_filename = build_website_pdf_filename(vacancy)
    resolved_pdf_url = pdf_url or str(parsed_data.get("pdf_url") or "") or build_website_pdf_url(filename=pdf_filename, public_base_url=public_base_url)
    apply_url = f"{settings.public_apply_base_url.rstrip('/')}/{vacancy.id}"
    slug = _build_website_job_slug(title)

    created_by = settings.website_publisher_user_id or 1

    return {
        "title": title,
        "location": location,
        "type": employment_type,
        "content": content,
        "slug": slug,
        "apply_url": apply_url,
        "summary": str(vacancy.ai_summary or "").strip(),
        "pdf_filename": pdf_filename,
        "pdf_url": resolved_pdf_url,
        "published": 1,
        "created_by": created_by,
        "hr_vacancy_id": vacancy.id,
    }


def _build_website_job_slug(title: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower()
    return slug or "vacancy"


def _get_itww_engine() -> Engine | None:
    global _itww_engine
    if _itww_engine is None and settings.itww_database_url:
        _itww_engine = create_engine(settings.itww_database_url, echo=False)
    return _itww_engine


def _get_ish_engine() -> Engine | None:
    global _ish_engine
    if _ish_engine is None and settings.ish_database_url:
        _ish_engine = create_engine(settings.ish_database_url, echo=False)
    return _ish_engine


def _get_dinel_engine() -> Engine | None:
    global _dinel_engine
    if _dinel_engine is None and settings.dinel_database_url:
        _dinel_engine = create_engine(settings.dinel_database_url, echo=False)
    return _dinel_engine


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


def _resolve_job_info_id_column(columns: set[str]) -> str:
    for candidate in ("job_info_id", "id"):
        if candidate in columns:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Could not determine the primary key column for jobs_infos table.",
    )


def _upsert_job_in_portal_db(
    *,
    connection,
    schema_name: str,
    table_name: str,
    mapped_fields: dict[str, object],
    vacancy: Vacancy,
    portal_name: str,
    tracked_id: int | None,
) -> tuple[int, str]:
    """
    Performs an intelligent deduplicated insert or update into the portal database.
    Guarantees no duplicate job rows are created.
    """
    columns = _load_table_columns(connection, schema_name, table_name)
    if not columns:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Target table '{schema_name}.{table_name}' was not found in {portal_name.upper()} database.",
        )

    job_info_id_column = _resolve_job_info_id_column(columns)
    qualified_table_name = _qualify_table_name(schema_name, table_name)

    lookup_id: int | None = None

    # 1. First check if tracked_id still exists in target DB
    if tracked_id:
        exists = connection.execute(
            text(
                f"SELECT {_quote_identifier(job_info_id_column)} FROM {qualified_table_name} "
                f"WHERE {_quote_identifier(job_info_id_column)} = :jid"
            ),
            {"jid": tracked_id},
        ).first()
        if exists:
            lookup_id = int(exists[0])

    # 2. If table supports hr_vacancy_id column (like ITWW)
    if lookup_id is None and "hr_vacancy_id" in columns:
        matched = connection.execute(
            text(
                f"SELECT {_quote_identifier(job_info_id_column)} FROM {qualified_table_name} "
                f"WHERE hr_vacancy_id = :vac_id ORDER BY {_quote_identifier(job_info_id_column)} DESC LIMIT 1"
            ),
            {"vac_id": vacancy.id},
        ).first()
        if matched:
            lookup_id = int(matched[0])

    # 3. Match by exact title if recent
    if lookup_id is None and "title" in columns:
        matched_title = connection.execute(
            text(
                f"SELECT {_quote_identifier(job_info_id_column)} FROM {qualified_table_name} "
                f"WHERE LOWER(TRIM(title)) = LOWER(TRIM(:title)) "
                f"ORDER BY {_quote_identifier(job_info_id_column)} DESC LIMIT 1"
            ),
            {"title": vacancy.title.strip()},
        ).first()
        if matched_title:
            lookup_id = int(matched_title[0])

    # Build payload with only existing columns
    payload: dict[str, Any] = {
        k: v for k, v in mapped_fields.items() if k in columns and k != "pdf_filename"
    }

    # Ensure foreign key created_by is valid (default 1)
    if "created_by" in columns:
        payload["created_by"] = 1

    if lookup_id is not None:
        # UPDATE existing record without creating duplicates
        update_payload = dict(payload)
        update_payload.pop("created_by", None)
        update_payload.pop("created_at", None)
        if "updated_at" in columns:
            update_payload["updated_at"] = datetime.utcnow()

        assignments = ", ".join(
            f"{_quote_identifier(col)} = :{col}" for col in update_payload
        )
        connection.execute(
            text(
                f"UPDATE {qualified_table_name} SET {assignments} "
                f"WHERE {_quote_identifier(job_info_id_column)} = :target_id"
            ),
            {**update_payload, "target_id": lookup_id},
        )
        return lookup_id, "updated"

    # INSERT new record
    if "created_at" in columns:
        payload["created_at"] = datetime.utcnow()
    if "updated_at" in columns:
        payload["updated_at"] = datetime.utcnow()

    column_names = list(payload.keys())
    col_sql = ", ".join(_quote_identifier(k) for k in column_names)
    val_sql = ", ".join(f":{k}" for k in column_names)

    res = connection.execute(
        text(
            f"INSERT INTO {qualified_table_name} ({col_sql}) "
            f"VALUES ({val_sql}) RETURNING {_quote_identifier(job_info_id_column)}"
        ),
        payload,
    )
    row = res.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Insert failed in {portal_name.upper()} database.",
        )
    return int(row[0]), "created"


def _format_bullets_for_display(items: list[Any] | str) -> str:
    if isinstance(items, list):
        bullets = [f"• {str(i).strip().lstrip('-*• ')}" for i in items if str(i).strip()]
        return "\n".join(bullets)
    return str(items or "").strip()


def _upsert_job_in_dinel_db(
    *,
    connection,
    schema_name: str,
    table_name: str,
    vacancy: Vacancy,
    tracked_id: int | None,
) -> tuple[int, str]:
    """
    Performs an intelligent deduplicated insert or update into Dinel's (Staff Outsourcing) jobs table.
    Guarantees no duplicate job rows are created.
    """
    parsed = vacancy.parsed_data or {}
    title = str(vacancy.title or "").strip() or "Untitled Vacancy"
    slug = _build_website_job_slug(title)
    location = str(parsed.get("location") or vacancy.location or "Netherlands").strip()

    raw_emp = str(parsed.get("employment_type") or parsed.get("job_type") or "full_time").lower()
    if "part" in raw_emp:
        emp_type = "PART_TIME"
    elif "contract" in raw_emp or "freelance" in raw_emp:
        emp_type = "CONTRACT"
    elif "intern" in raw_emp:
        emp_type = "INTERN"
    else:
        emp_type = "FULL_TIME"

    raw_work = str(parsed.get("workplace_type") or parsed.get("work_mode") or "onsite").lower()
    if "remote" in raw_work:
        work_type = "REMOTE"
    elif "hybrid" in raw_work:
        work_type = "HYBRID"
    else:
        work_type = "ONSITE"

    raw_exp = str(parsed.get("experience_level") or "mid").lower()
    if "lead" in raw_exp or "principal" in raw_exp:
        exp_level = "LEAD"
    elif "senior" in raw_exp or "sr" in raw_exp:
        exp_level = "SENIOR"
    elif "junior" in raw_exp or "entry" in raw_exp:
        exp_level = "JUNIOR"
    else:
        exp_level = "MID"

    intro_info = str(parsed.get("about_role") or parsed.get("aboutRole") or parsed.get("intro_information") or "").strip()
    if not intro_info and vacancy.description:
        intro_info = vacancy.description.split("\n\n")[0].strip()

    company_info = str(parsed.get("company_info") or parsed.get("company_information") or "").strip()

    resps = parsed.get("responsibilities") or parsed.get("whatYoullDo") or parsed.get("vacancy_information") or []
    vacancy_info = _format_bullets_for_display(resps)
    if not vacancy_info and vacancy.description:
        vacancy_info = vacancy.description

    reqs = parsed.get("requirements") or parsed.get("whatYoullBring") or list(vacancy.required_skills or [])
    requirements_text = _format_bullets_for_display(reqs)

    offers = parsed.get("offer_information") or parsed.get("benefits") or parsed.get("nice_to_have") or parsed.get("niceToHave") or []
    offer_info = _format_bullets_for_display(offers)

    add_info = str(parsed.get("additional_info") or parsed.get("additional_information") or parsed.get("additionalInfo") or "").strip()

    hours_val = parsed.get("hours_per_week")
    try:
        hours = int(hours_val) if hours_val is not None else 40
    except (ValueError, TypeError):
        hours = 40

    apply_url = f"{settings.public_apply_base_url.rstrip('/')}/{vacancy.id}"
    department = str(parsed.get("department") or (vacancy.department.name if vacancy.department else "") or "General").strip()

    qualified_table_name = _qualify_table_name(schema_name, table_name)

    lookup_id: int | None = None

    if tracked_id:
        chk = connection.execute(
            text(f"SELECT id FROM {qualified_table_name} WHERE id = :jid"),
            {"jid": tracked_id},
        ).first()
        if chk:
            lookup_id = int(chk[0])

    if lookup_id is None:
        chk_vac = connection.execute(
            text(f"SELECT id FROM {qualified_table_name} WHERE vacancy_id = :vac_id ORDER BY id DESC LIMIT 1"),
            {"vac_id": str(vacancy.id)},
        ).first()
        if chk_vac:
            lookup_id = int(chk_vac[0])

    if lookup_id is None and title:
        chk_title = connection.execute(
            text(f"SELECT id FROM {qualified_table_name} WHERE LOWER(TRIM(title)) = LOWER(TRIM(:title)) ORDER BY id DESC LIMIT 1"),
            {"title": title},
        ).first()
        if chk_title:
            lookup_id = int(chk_title[0])

    now = datetime.utcnow()

    if lookup_id is not None:
        connection.execute(
            text(
                f"""
                UPDATE {qualified_table_name}
                SET title = :title,
                    slug = :slug,
                    description = :description,
                    location = :location,
                    employment_type = :employment_type::employment_type,
                    workplace_type = :workplace_type::workplace_type,
                    department = :department,
                    experience_level = :experience_level::experience_level,
                    status = 'PUBLISHED'::job_status,
                    visibility = 'PUBLIC',
                    apply_url = :apply_url,
                    published_at = :published_at,
                    updated_at = :updated_at,
                    vacancy_id = :vacancy_id,
                    work_city = :location,
                    intro_information = :intro_information,
                    company_information = :company_information,
                    vacancy_information = :vacancy_information,
                    requirements = :requirements,
                    offer_information = :offer_information,
                    additional_information = :additional_information,
                    hours_per_week = :hours_per_week
                WHERE id = :target_id
                """
            ),
            {
                "title": title,
                "slug": slug,
                "description": intro_info or title,
                "location": location,
                "employment_type": emp_type,
                "workplace_type": work_type,
                "department": department,
                "experience_level": exp_level,
                "apply_url": apply_url,
                "published_at": now,
                "updated_at": now,
                "vacancy_id": str(vacancy.id),
                "intro_information": intro_info or None,
                "company_information": company_info or None,
                "vacancy_information": vacancy_info or None,
                "requirements": requirements_text or None,
                "offer_information": offer_info or None,
                "additional_information": add_info or None,
                "hours_per_week": hours,
                "target_id": lookup_id,
            },
        )
        return lookup_id, "updated"

    res = connection.execute(
        text(
            f"""
            INSERT INTO {qualified_table_name} (
                title,
                slug,
                description,
                location,
                employment_type,
                workplace_type,
                department,
                experience_level,
                status,
                visibility,
                apply_url,
                company_id,
                created_by,
                published_at,
                created_at,
                updated_at,
                vacancy_id,
                work_city,
                intro_information,
                company_information,
                vacancy_information,
                requirements,
                offer_information,
                additional_information,
                hours_per_week
            )
            VALUES (
                :title,
                :slug,
                :description,
                :location,
                :employment_type::employment_type,
                :workplace_type::workplace_type,
                :department,
                :experience_level::experience_level,
                'PUBLISHED'::job_status,
                'PUBLIC',
                :apply_url,
                1,
                1,
                :published_at,
                :created_at,
                :updated_at,
                :vacancy_id,
                :location,
                :intro_information,
                :company_information,
                :vacancy_information,
                :requirements,
                :offer_information,
                :additional_information,
                :hours_per_week
            )
            RETURNING id
            """
        ),
        {
            "title": title,
            "slug": slug,
            "description": intro_info or title,
            "location": location,
            "employment_type": emp_type,
            "workplace_type": work_type,
            "department": department,
            "experience_level": exp_level,
            "apply_url": apply_url,
            "published_at": now,
            "created_at": now,
            "updated_at": now,
            "vacancy_id": str(vacancy.id),
            "intro_information": intro_info or None,
            "company_information": company_info or None,
            "vacancy_information": vacancy_info or None,
            "requirements": requirements_text or None,
            "offer_information": offer_info or None,
            "additional_information": add_info or None,
            "hours_per_week": hours,
        },
    )
    row = res.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Insert failed in Dinel (Staff Outsourcing) database.",
        )
    return int(row[0]), "created"


def _delete_job_by_id(connection, schema_name: str, table_name: str, job_info_id: int) -> None:
    columns = _load_table_columns(connection, schema_name, table_name)
    if not columns:
        return
    job_info_id_column = _resolve_job_info_id_column(columns)
    qualified_table_name = _qualify_table_name(schema_name, table_name)

    connection.execute(
        text(
            f"DELETE FROM {qualified_table_name} "
            f"WHERE {_quote_identifier(job_info_id_column)} = :jid"
        ),
        {"jid": job_info_id},
    )


def _upsert_publication_mapping(
    *,
    session: Session,
    vacancy_id: int,
    job_info_id: int,
    itww_job_info_id: int | None,
    ish_job_info_id: int | None,
    dinel_job_info_id: int | None = None,
    target_portal: str,
) -> None:
    mapping = session.exec(
        select(WebsitePublication).where(WebsitePublication.vacancy_id == vacancy_id)
    ).first()

    if mapping is None:
        mapping = WebsitePublication(
            vacancy_id=vacancy_id,
            job_info_id=job_info_id,
            itww_job_info_id=itww_job_info_id,
            ish_job_info_id=ish_job_info_id,
            dinel_job_info_id=dinel_job_info_id,
            target_portal=target_portal,
        )
    else:
        mapping.job_info_id = job_info_id
        mapping.itww_job_info_id = itww_job_info_id
        mapping.ish_job_info_id = ish_job_info_id
        mapping.dinel_job_info_id = dinel_job_info_id
        mapping.target_portal = target_portal
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

