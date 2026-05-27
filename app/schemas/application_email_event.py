from datetime import datetime
from typing import Optional

from app.models.enums import EmailStatus, EmailType
from app.schemas.common import BaseSchema


class ApplicationEmailEventRead(BaseSchema):
    id: int
    application_id: int
    email_type: EmailType
    recipient_email: str
    status: EmailStatus
    sent_by_id: Optional[int] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
