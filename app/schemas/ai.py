from pydantic import Field

from app.schemas.common import BaseSchema


class JobDescriptionGenerateRequest(BaseSchema):
    job_title: str | None = None
    department: str | None = None
    budget: str | None = None
    is_internship: bool = False
    hiring_scope: str | None = None
    requirements: str | None = None
    start_date: str | None = None
    employment_type: str | None = None
    work_hours: str | None = None
    work_model: str | None = None
    city: str | None = None
    country: str | None = None
    years_experience: str | None = None
    perks: str | None = None
    tone: str | None = None
    seniority: str | None = None


class JobDescriptionGenerateResponse(BaseSchema):
    generated_job_description: str = Field(description="AI-generated editable vacancy description draft.")
    generated_required_skills: list[str] = Field(default_factory=list, description="Skills extracted by AI from the request.")
    summary: str | None = Field(default=None, description="Short AI-generated summary of the vacancy.")
    suggested_max_budget: str | None = Field(
        default=None,
        description="AI-suggested max budget based on role, location, and seniority context.",
    )
