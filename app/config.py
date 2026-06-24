import os
from pathlib import Path

from pydantic import BaseModel
from dotenv import load_dotenv


load_dotenv(override=True)


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_FRONTEND_ORIGINS = (
    "http://localhost:3000,"
    "http://127.0.0.1:3000,"
    "http://localhost:3001,"
    "http://127.0.0.1:3001,"
    "https://frontend-hr-app-six.vercel.app,"
    "https://frontend-hr-app-git-main-manish-079s-projects.vercel.app,"
    "https://it-solution-code-hr-app.vercel.app"
)


def resolve_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return BASE_DIR / path


def normalize_database_url(value: str) -> str:
    cleaned = value.strip()
    if cleaned.startswith("postgresql+psycopg://"):
        return cleaned
    if cleaned.startswith("postgresql://"):
        return "postgresql+psycopg://" + cleaned[len("postgresql://") :]
    if cleaned.startswith("postgres://"):
        return "postgresql+psycopg://" + cleaned[len("postgres://") :]
    return cleaned


def build_website_pdf_output_dir() -> Path:
    configured = os.getenv("WEBSITE_PDF_OUTPUT_DIR")
    if configured:
        return resolve_path(configured)

    # Vercel serverless functions can only write to /tmp at runtime.
    if os.getenv("VERCEL") == "1":
        return Path("/tmp/job-pdfs")

    return resolve_path("storage/website-job-pdfs")


def build_resume_upload_dir() -> Path:
    configured = os.getenv("RESUME_UPLOAD_DIR")
    if configured:
        return resolve_path(configured)

    # Vercel serverless functions can only write to /tmp at runtime.
    if os.getenv("VERCEL") == "1":
        return Path("/tmp/resumes")

    return resolve_path("storage/resumes")


def build_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return normalize_database_url(database_url)

    db_host = os.getenv("DB_HOST", "localhost")
    db_name = os.getenv("DB_NAME", "ai_recruitment")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    return f"postgresql+psycopg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def build_vertex_model_candidates() -> list[str]:
    primary = os.getenv("VERTEX_GENERATIVE_MODEL", "gemini-3.1-flash-lite")
    defaults = [
        primary,
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
    ]

    configured = os.getenv("VERTEX_GENERATIVE_MODELS")
    if configured:
        candidates = [item.strip() for item in configured.split(",") if item.strip()]
    else:
        candidates = []

    deduped: list[str] = []
    seen: set[str] = set()
    for item in [*candidates, *defaults]:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


class Settings(BaseModel):
    app_name: str = "AI Recruitment Backend"
    database_url: str = build_database_url()
    website_database_url: str | None = (
        normalize_database_url(os.getenv("WEBSITE_DATABASE_URL"))
        if os.getenv("WEBSITE_DATABASE_URL")
        else None
    )
    website_jobs_table: str = os.getenv("WEBSITE_JOBS_TABLE", "jobs_infos")
    website_publisher_user_id: int | None = (
        int(os.getenv("WEBSITE_PUBLISHER_USER_ID"))
        if os.getenv("WEBSITE_PUBLISHER_USER_ID")
        else None
    )
    uploadthing_app_id: str | None = os.getenv("UPLOADTHING_APP_ID")
    uploadthing_secret: str | None = os.getenv("UPLOADTHING_SECRET")
    uploadthing_token: str | None = os.getenv("UPLOADTHING_TOKEN")
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
    vertex_project_id: str | None = os.getenv("VERTEX_PROJECT_ID")
    vertex_location: str = os.getenv("VERTEX_LOCATION", "europe-west1")
    vertex_generative_model: str = os.getenv("VERTEX_GENERATIVE_MODEL", "gemini-3.1-flash-lite")
    vertex_generative_models: list[str] = build_vertex_model_candidates()
    vertex_embedding_model: str = os.getenv("VERTEX_EMBEDDING_MODEL", "gemini-embedding-001")
    talent_vector_model: str = os.getenv("TALENT_VECTOR_MODEL", "all-MiniLM-L6-v2")
    n8n_hr_invite_webhook_url: str = os.getenv(
        "N8N_HR_INVITE_WEBHOOK_URL",
        "http://localhost:5678/webhook/hr-invite-email",
    )
    n8n_hr_approval_webhook_url: str | None = os.getenv("N8N_HR_APPROVAL_WEBHOOK_URL")
    n8n_hr_rejection_webhook_url: str | None = os.getenv("N8N_HR_REJECTION_WEBHOOK_URL")
    n8n_technical_invite_webhook_url: str | None = os.getenv("N8N_TECHNICAL_INVITE_WEBHOOK_URL")
    n8n_technical_rejection_webhook_url: str | None = os.getenv("N8N_TECHNICAL_REJECTION_WEBHOOK_URL")
    n8n_management_invite_webhook_url: str | None = os.getenv("N8N_MANAGEMENT_INVITE_WEBHOOK_URL")
    n8n_management_rejection_webhook_url: str | None = os.getenv("N8N_MANAGEMENT_REJECTION_WEBHOOK_URL")
    n8n_onboarding_approval_webhook_url: str | None = os.getenv("N8N_ONBOARDING_APPROVAL_WEBHOOK_URL")
    n8n_webhook_secret: str = os.getenv("N8N_WEBHOOK_SECRET", "development-n8n-secret")
    n8n_linkedin_preview_webhook_url: str = os.getenv(
        "N8N_LINKEDIN_PREVIEW_WEBHOOK_URL",
        "http://localhost:5678/webhook/linkedin-preview-v2",
    )
    n8n_calendar_availability_webhook_url: str | None = os.getenv("N8N_CALENDAR_AVAILABILITY_WEBHOOK_URL")
    n8n_calendar_booking_webhook_url: str | None = os.getenv("N8N_CALENDAR_BOOKING_WEBHOOK_URL")
    cal_com_booking_base_url: str = os.getenv("CAL_COM_BOOKING_BASE_URL", "http://localhost:3000/candidate/schedule")
    cal_com_webhook_secret: str | None = os.getenv("CAL_COM_WEBHOOK_SECRET")
    public_apply_base_url: str = os.getenv("PUBLIC_APPLY_BASE_URL", "http://localhost:3000/careers")
    public_schedule_base_url: str = os.getenv(
        "PUBLIC_SCHEDULE_BASE_URL",
        "http://localhost:3000/candidate/schedule",
    )
    public_schedule_timezone: str = os.getenv("PUBLIC_SCHEDULE_TIMEZONE", "Europe/Amsterdam")
    public_schedule_days_ahead: int = int(os.getenv("PUBLIC_SCHEDULE_DAYS_AHEAD", "14"))
    public_schedule_slot_minutes: int = int(os.getenv("PUBLIC_SCHEDULE_SLOT_MINUTES", "30"))
    public_schedule_business_start_hour: int = int(os.getenv("PUBLIC_SCHEDULE_BUSINESS_START_HOUR", "9"))
    public_schedule_business_end_hour: int = int(os.getenv("PUBLIC_SCHEDULE_BUSINESS_END_HOUR", "17"))
    resume_upload_dir: Path = build_resume_upload_dir()
    website_pdf_output_dir: Path = build_website_pdf_output_dir()
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            DEFAULT_FRONTEND_ORIGINS,
        ).split(",")
        if origin.strip()
    ]
    cors_origin_regex: str | None = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https?://((localhost|127\.0\.0\.1)(:\d+)?|(frontend-hr-app.*|it-solution-code-hr-app.*)\.vercel\.app)$",
    )


settings = Settings()
