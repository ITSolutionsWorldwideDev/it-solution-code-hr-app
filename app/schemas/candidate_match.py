from datetime import datetime

from pydantic import Field

from app.schemas.common import BaseSchema


class CandidateMatchRead(BaseSchema):
    id: int
    candidate_id: int
    candidate_name: str | None = Field(default=None, description="Candidate name for display in vacancy rankings.")
    vacancy_id: int
    match_score: float = Field(description="Vacancy-specific match score.")
    ai_summary: str | None = Field(default=None, description="Vacancy-specific AI summary.")
    fit_explanation: str | None = Field(default=None, description="AI explanation of the candidate fit.")
    matched_skills: list[str] = Field(default_factory=list, description="Skills that matched the vacancy requirements.")
    created_at: datetime
