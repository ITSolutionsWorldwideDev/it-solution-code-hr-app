from datetime import datetime

from app.models.enums import ApplicationStage, EmailStatus, EmailType
from app.schemas.common import BaseSchema


class HRInviteN8NCallbackRequest(BaseSchema):
    application_id: int
    email_type: EmailType = EmailType.HR_INVITE
    status: EmailStatus
    provider_message_id: str | None = None
    error_message: str | None = None
    secret: str


class HRInviteN8NCallbackResponse(BaseSchema):
    application_id: int
    email_type: EmailType
    status: EmailStatus
    stage: ApplicationStage
    invite_sent_at: datetime | None = None
    message: str
