from pydantic import Field

from app.schemas.common import BaseSchema


class TalentSuggestionRead(BaseSchema):
    candidate_id: str
    name: str
    match_score: int = Field(description="Vacancy-specific refined match score from 0-100.")
    is_discovery: bool = Field(description="True when the candidate has not yet applied to this vacancy.")
    discovery_reason: str = Field(description="One-sentence explanation of why this candidate is a hidden gem.")
    original_applied_role: str = Field(description="Most recent role the candidate applied for, or a fallback label.")
