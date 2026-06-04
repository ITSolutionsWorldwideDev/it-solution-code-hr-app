from typing import Any

from app.schemas.common import BaseSchema


class WebsitePublishRequest(BaseSchema):
    vacancy_id: int


class WebsitePublishRead(BaseSchema):
    success: bool
    dry_run: bool
    message: str
    published: bool
    action: str
    job_info_id: int | None = None
    mapped_fields: dict[str, Any]
