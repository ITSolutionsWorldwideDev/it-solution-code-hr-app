from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class WebsiteJobRead(BaseModel):
    vacancy_id: int
    job_info_id: int
    title: str
    description: str
    required_skills: list[str]
    experience_level: str | None = None
    department_id: int
    hiring_request_id: int | None = None
    ai_summary: str | None = None
    match_score: float | None = None
    parsed_data: dict
    created_at: datetime
    published_at: datetime
    location: str | None = None
    employment_type: str | None = None
    pdf_url: str | None = None
