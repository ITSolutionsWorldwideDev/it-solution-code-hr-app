from app.schemas.common import BaseSchema


class LinkedInPreviewRequest(BaseSchema):
    vacancy_id: int
    dry_run: bool = True
    public_apply_base_url: str | None = None


class LinkedInPreviewRead(BaseSchema):
    success: bool
    dry_run: bool
    message: str
    post_text: str
    apply_url: str
