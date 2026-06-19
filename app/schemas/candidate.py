from typing import Optional
from typing import Literal

from pydantic import Field

from app.schemas.candidate_match import CandidateMatchRead
from app.schemas.candidate_role_suggestion import CandidateRoleSuggestionRead
from app.schemas.common import BaseSchema
from app.schemas.vacancy import VacancyRead


class AppliedVacancyMatchRead(BaseSchema):
    vacancy_id: str
    role_name: str
    score: float
    analysis: str


class PotentialVacancyMatchRead(BaseSchema):
    vacancy_id: str
    role_name: str
    score: float
    discovery_reason: str


class TalentInsightsRead(BaseSchema):
    overall_score: float
    top_skills_identified: list[str] = Field(default_factory=list)
    seniority_level: str


class CandidateMatchingInsightsRead(BaseSchema):
    applied_match: AppliedVacancyMatchRead | None = None
    potential_match: PotentialVacancyMatchRead | None = None
    talent_insights: TalentInsightsRead


class CandidateBase(BaseSchema):
    name: str = Field(description="Candidate full name.", examples=["Jane Doe"])
    email: str = Field(description="Candidate email address.", examples=["jane.doe@example.com"])
    phone: Optional[str] = Field(default=None, description="Candidate phone number.", examples=["+31 6 12345678"])
    skills: list[str] = Field(default_factory=list, description="List of identified or manually added skills.", examples=[["Python", "FastAPI", "PostgreSQL"]])
    experience: Optional[str] = Field(default=None, description="Candidate experience summary.", examples=["5 years of backend development experience"])
    education: Optional[str] = Field(default=None, description="Candidate education summary.", examples=["Bachelor of Computer Science"])
    ai_summary: Optional[str] = Field(default=None, description="AI-generated candidate summary.", examples=["Jane Doe is a backend-focused candidate with strong Python and FastAPI experience."])
    match_score: Optional[float] = Field(default=None, description="Prototype match score against a vacancy.", examples=[82.5])
    parsed_data: dict = Field(default_factory=dict, description="Raw structured parser output and CV metadata.")


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseSchema):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[list[str]] = None
    experience: Optional[str] = None
    education: Optional[str] = None
    ai_summary: Optional[str] = None
    match_score: Optional[float] = None
    parsed_data: Optional[dict] = None


class CandidateRead(CandidateBase):
    id: int


class CandidateDatabaseVacancyOptionRead(BaseSchema):
    id: int
    title: str
    status: str


class CandidateDatabaseRecordRead(BaseSchema):
    id: int
    initials: str
    name: str
    email: str
    phone: str | None = None
    raw_added_at: str | None = None
    added_at: str
    vacancy_ids: list[int] = Field(default_factory=list)
    role_title: str
    vacancy_title: str
    vacancy_label: str
    potential_role: str | None = None
    experience_years: int | None = None
    applied_match_score: float | None = None
    overall_talent_score: float | None = None
    stage: str
    parse_status: str | None = None
    search_blob: str
    ai_summary: str
    skills: list[str] = Field(default_factory=list)
    experience: str
    education: str
    parsed_data: dict = Field(default_factory=dict)
    readiness_status: Literal["strong_match", "potential_fit", "needs_review", "low_fit"]


class CandidateDatabaseResponseRead(BaseSchema):
    records: list[CandidateDatabaseRecordRead] = Field(default_factory=list)
    vacancy_options: list[CandidateDatabaseVacancyOptionRead] = Field(default_factory=list)
    open_vacancy_count: int
    total_candidate_count: int


class CandidateUploadUrlRequest(BaseSchema):
    url: str = Field(description="Public direct URL to a candidate PDF CV.")
    candidate_id: Optional[int] = Field(
        default=None,
        description="Optional existing candidate id to update instead of creating a new candidate.",
    )


class ParsedCandidateData(BaseSchema):
    name: Optional[str] = Field(default=None, description="Parsed candidate name.")
    email: Optional[str] = Field(default=None, description="Parsed candidate email address.")
    phone: Optional[str] = Field(default=None, description="Parsed candidate phone number.")
    skills: list[str] = Field(default_factory=list, description="Parsed skill keywords identified in the CV.")
    experience: Optional[str] = Field(default=None, description="Parsed experience text or English placeholder text.")
    education: Optional[str] = Field(default=None, description="Parsed education text or English placeholder text.")
    ai_summary: Optional[str] = Field(default=None, description="AI-style English summary generated from parsed data.")
    match_score: Optional[float] = Field(default=None, description="Prototype vacancy match score.")
    parsed_data: dict = Field(default_factory=dict, description="Raw parser output stored on the candidate record.")


class CandidateCVParseResponse(BaseSchema):
    candidate: CandidateRead = Field(description="Candidate record after the parsed data has been saved.")
    vacancy: Optional[VacancyRead] = Field(default=None, description="Vacancy used for prototype matching, if provided.")
    match: Optional[CandidateMatchRead] = Field(default=None, description="Created or updated vacancy match row, if a vacancy was provided.")
    matching: CandidateMatchingInsightsRead | None = Field(
        default=None,
        description="Applied match, hidden-potential match, and overall talent insights across vacancies.",
    )
    role_suggestions: list[CandidateRoleSuggestionRead] = Field(default_factory=list, description="Persisted role suggestions derived from the uploaded CV.")
    extracted_text_preview: str = Field(description="Short preview of the extracted PDF text.")
    parsed_candidate: ParsedCandidateData = Field(description="Structured parsed result returned by the PDF parser service.")


class CandidateCVBatchParseFailure(BaseSchema):
    filename: str = Field(description="Original filename that failed to parse.")
    error: str = Field(description="Reason the file failed.")


class CandidateCVBatchParseResponse(BaseSchema):
    total_files: int = Field(description="Number of uploaded files received.")
    success_count: int = Field(description="Number of files parsed and stored successfully.")
    failure_count: int = Field(description="Number of files that failed during parsing.")
    results: list[CandidateCVParseResponse] = Field(
        default_factory=list,
        description="Successful parsed candidate results.",
    )
    failures: list[CandidateCVBatchParseFailure] = Field(
        default_factory=list,
        description="Failed uploads and their errors.",
    )


class CandidateCVQueueJobRead(BaseSchema):
    parse_job_id: int = Field(description="Created parse job id.")
    vacancy_id: int = Field(description="Vacancy linked to the uploaded CV.")
    file_name: str = Field(description="Stored filename for the uploaded PDF.")
    original_file_name: Optional[str] = Field(default=None, description="Original uploaded filename for the PDF.")
    file_path: str = Field(description="Stored path for the uploaded PDF.")
    status: str = Field(description="Current parse job status.")
    candidate_id: Optional[int] = Field(default=None, description="Created candidate id once parsing succeeds.")
    application_id: Optional[int] = Field(default=None, description="Created application id once workflow linking succeeds.")
    error_message: Optional[str] = Field(default=None, description="Error message if parsing failed.")
    created_at: Optional[str] = Field(default=None, description="When the parse job was created.")
    updated_at: Optional[str] = Field(default=None, description="When the parse job was last updated.")
    parsed_at: Optional[str] = Field(default=None, description="When the parse job finished parsing.")


class CandidateCVQueueBatchResponse(BaseSchema):
    total_files: int = Field(description="Number of uploaded files received.")
    queued_count: int = Field(description="Number of files queued for parsing.")
    jobs: list[CandidateCVQueueJobRead] = Field(
        default_factory=list,
        description="Queued parse jobs.",
    )


class CandidateManualImportItem(BaseSchema):
    filename: str = Field(description="Original uploaded file name.")
    parse_status: str = Field(description="Final parse status for this file.")
    match_status: str = Field(description="Final match status for this file.")
    candidate_id: int | None = Field(default=None, description="Created or updated candidate id.")
    candidate_name: str | None = Field(default=None, description="Candidate name for immediate UI rendering.")
    candidate_email: str | None = Field(default=None, description="Candidate email for immediate UI rendering.")
    ai_summary: str | None = Field(default=None, description="Parsed AI summary for immediate UI rendering.")
    skills: list[str] = Field(default_factory=list, description="Parsed skills for immediate UI rendering.")
    experience: str | None = Field(default=None, description="Parsed experience for immediate UI rendering.")
    education: str | None = Field(default=None, description="Parsed education for immediate UI rendering.")
    parsed_data: dict = Field(default_factory=dict, description="Stored parsed data for immediate UI rendering.")
    matched_job_id: int | None = Field(default=None, description="Matched vacancy id when applicable.")
    score: float | None = Field(default=None, description="Stored score when a clear vacancy match exists.")
    error_message: str | None = Field(default=None, description="Failure or review message for this file.")


class CandidateManualImportResponse(BaseSchema):
    total_files: int = Field(description="Number of uploaded files received.")
    results: list[CandidateManualImportItem] = Field(
        default_factory=list,
        description="Per-file import results.",
    )
