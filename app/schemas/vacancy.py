from datetime import datetime
from typing import Optional

from pydantic import Field

from app.models.enums import VacancyStatus
from app.schemas.common import BaseSchema


class VacancyBase(BaseSchema):
    title: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    experience_level: Optional[str] = None
    status: VacancyStatus = VacancyStatus.OPEN
    department_id: int
    hiring_request_id: Optional[int] = None
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: dict = Field(default_factory=dict)


class VacancyCreate(VacancyBase):
    pass


class VacancyUpdate(BaseSchema):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[list[str]] = None
    experience_level: Optional[str] = None
    status: Optional[VacancyStatus] = None
    department_id: Optional[int] = None
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: Optional[dict] = None


class VacancyRead(VacancyBase):
    id: int
    created_at: datetime
