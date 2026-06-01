from pydantic import Field

from app.schemas.common import BaseSchema


class HiddenPotentialDiscoveryRead(BaseSchema):
    candidate_id: int
    candidate_name: str
    original_role: str = Field(description="Most recent role the candidate applied for before discovery.")
    potential_score: int = Field(description="Vacancy-specific hidden-potential match score from 0-100.")
    reason: str = Field(description="One-sentence justification for why this person is a hidden potential.")


class VacancyDiscoverySummaryRead(BaseSchema):
    vacancy_id: int
    new_discoveries: list[HiddenPotentialDiscoveryRead] = Field(default_factory=list)
    top_candidates: list[HiddenPotentialDiscoveryRead] = Field(default_factory=list)
