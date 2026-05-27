from datetime import datetime
from typing import Optional

from app.models.enums import ApplicationStage, UserRole
from app.schemas.common import BaseSchema


class ApplicationStageEventRead(BaseSchema):
    id: int
    application_id: int
    from_stage: Optional[ApplicationStage] = None
    to_stage: ApplicationStage
    changed_by_id: Optional[int] = None
    changed_by_role: Optional[UserRole] = None
    notes: Optional[str] = None
    created_at: datetime
