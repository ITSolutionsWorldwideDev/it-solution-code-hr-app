from datetime import datetime

from pydantic import Field

from app.schemas.common import BaseSchema


class CandidateRoleSuggestionRead(BaseSchema):
    id: int
    candidate_id: int
    role_title: str = Field(description="Suggested role title based on the uploaded resume.")
    department: str | None = Field(default=None, description="Suggested department for the role.")
    confidence_score: float = Field(description="AI confidence score for the suggested role.")
    reason: str | None = Field(default=None, description="Why the role was suggested.")
    created_at: datetime
