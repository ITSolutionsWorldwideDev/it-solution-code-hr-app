from typing import Any

from app.schemas.common import BaseSchema


class WebsitePublishRequest(BaseSchema):
    vacancy_id: int
    target_portal: str | None = "all"  # "all", "itww", "ish", "dinel", or comma-separated e.g. "itww,dinel"


class WebsitePublishRead(BaseSchema):
    success: bool
    dry_run: bool
    message: str
    published: bool
    action: str
    job_info_id: int | None = None
    itww_job_info_id: int | None = None
    ish_job_info_id: int | None = None
    dinel_job_info_id: int | None = None
    pdf_generated: bool = False
    pdf_filename: str | None = None
    pdf_url: str | None = None
    target_portal: str | None = "all"
    mapped_fields: dict[str, Any]

