from datetime import datetime
from typing import Optional

from pydantic import Field

from app.models.enums import HiringRequestStatus
from app.schemas.common import BaseSchema


class HiringRequestBase(BaseSchema):
    title: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    experience_level: Optional[str] = None
    headcount: int = 1
    department_id: int
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: dict = Field(default_factory=dict)


class HiringRequestCreate(HiringRequestBase):
    created_by_id: Optional[int] = None


class HiringRequestUpdate(BaseSchema):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[list[str]] = None
    experience_level: Optional[str] = None
    headcount: Optional[int] = None
    department_id: Optional[int] = None
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: Optional[dict] = None


class HiringRequestDecision(BaseSchema):
    reviewed_by_id: int
    rejection_reason: Optional[str] = None


class HiringRequestRead(HiringRequestBase):
    id: int
    status: HiringRequestStatus
    rejection_reason: Optional[str] = None
    created_by_id: int
    reviewed_by_id: Optional[int] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
