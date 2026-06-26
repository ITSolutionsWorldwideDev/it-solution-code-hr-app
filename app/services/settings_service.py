from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import SQLModel, Session, select

from app.config import settings
from app.db import engine, ensure_user_auth_columns
from app.models.app_setting import AppSetting
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.department import Department
from app.models.enums import UserRole
from app.models.parse_job import ParseJob
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.vacancy import Vacancy
from app.models.website_publication import WebsitePublication
from app.schemas.settings import (
    AccessSettingsData,
    AiSettingsData,
    GeneralSettingsData,
    IntegrationsSettingsData,
    RecruitmentSettingsData,
    SettingsCategoryEnvelope,
    SettingsReadResponse,
    SupportSettingsData,
    SystemSummaryRead,
    UserPreferencesUpdateRequest,
    UserProfileUpdateRequest,
    UserSettingsPreferencesRead,
    UserSettingsProfileRead,
    UserSettingsReadResponse,
    WebsitePdfSettingsData,
)


_CATEGORY_ORDER = [
    "general",
    "recruitment",
    "website_pdf",
    "ai",
    "integrations_metadata",
    "access",
    "support",
]
_ADMIN_CATEGORIES = set(_CATEGORY_ORDER)
_USER_ALLOWED_CATEGORIES = {"support"}
T = TypeVar("T")
_settings_schema_ready = False


def _ensure_settings_schema() -> None:
    global _settings_schema_ready
    if _settings_schema_ready:
        return

    SQLModel.metadata.create_all(engine)
    ensure_user_auth_columns()
    _settings_schema_ready = True


def _with_session(session: Session | None, callback):
    _ensure_settings_schema()
    if session is not None:
        return callback(session)
    with Session(engine) as managed_session:
        return callback(managed_session)


def _infer_frontend_app_url() -> str:
    return (
        os.getenv("FRONTEND_APP_URL")
        or os.getenv("NEXT_PUBLIC_SITE_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "http://localhost:3000"
    )


def _infer_backend_api_base_url() -> str:
    return os.getenv("BACKEND_API_BASE_URL") or "http://localhost:8000/api"


def _infer_public_site_base() -> str:
    public_apply = settings.public_apply_base_url.rstrip("/")
    if public_apply.endswith("/careers"):
        return public_apply[: -len("/careers")]
    return _infer_frontend_app_url().rstrip("/")


def _default_general_settings() -> GeneralSettingsData:
    return GeneralSettingsData(
        company_name="IT Solutions Worldwide",
        company_legal_name="IT Solutions Worldwide BV",
        default_country="Netherlands",
        default_language="English",
        default_timezone=settings.public_schedule_timezone,
        public_website_base_url=_infer_public_site_base(),
        public_careers_base_url=settings.public_apply_base_url,
        public_apply_base_url=settings.public_apply_base_url,
        public_schedule_base_url=settings.public_schedule_base_url,
        default_office_location_label="Netherlands",
        default_employment_type_options=["Full-time", "Part-time", "Contract", "Freelance"],
        default_weekly_hours_label="40 hours",
        default_work_authorization_text="Must be authorized to work in the relevant location",
        default_company_intro_text=(
            "IT Solutions Worldwide delivers specialized recruitment and technical staffing "
            "for international business and IT environments."
        ),
        default_about_us_text=(
            "At IT Solutions Worldwide BV, we provide specialized recruitment and technical staffing "
            "solutions for international business and IT projects."
        ),
        default_recruiter_support_email="support@itsolutionsworldwide.com",
        default_support_contact_name="Talent Genie Support",
    )


def _default_recruitment_settings() -> RecruitmentSettingsData:
    return RecruitmentSettingsData(
        default_vacancy_status="open",
        default_shortlist_bucket_behavior="primary_first",
        default_candidate_stage_after_parsing="parsed",
        default_department_for_new_requests="Human Resources (HR)",
        default_perks_block=(
            "Holiday allowance, pension plan, paid time off, learning budget, home office support, "
            "and performance bonus where relevant."
        ),
        default_requirements_intro="We are looking for candidates who can combine execution, ownership, and role-specific expertise.",
        default_responsibilities_intro="The role focuses on structured delivery, stakeholder alignment, and measurable business impact.",
        default_what_we_offer_intro="We offer a collaborative environment with practical benefits and room to grow.",
        default_interview_duration_minutes=settings.public_schedule_slot_minutes,
        default_scheduling_lead_time_hours=24,
        default_days_ahead_for_scheduling=settings.public_schedule_days_ahead,
        default_business_start_hour=settings.public_schedule_business_start_hour,
        default_business_end_hour=settings.public_schedule_business_end_hour,
        default_rejection_reason_templates=[
            "The candidate did not align closely enough with the current vacancy requirements.",
            "We selected candidates with a stronger direct fit for the stage.",
        ],
        default_interview_invite_templates=[
            "We would like to invite you to the next step in our recruitment process.",
            "Thank you for your interest. We would like to schedule an interview with our team.",
        ],
        default_offer_template_text="We are pleased to move forward with an offer subject to the agreed details.",
        auto_create_vacancy_after_hiring_request_approval=True,
        auto_publish_vacancy_after_approval=True,
        auto_generate_website_pdf_after_publish=True,
    )


def _default_website_pdf_settings() -> WebsitePdfSettingsData:
    return WebsitePdfSettingsData(
        active_website_publish_table_name=settings.website_jobs_table,
        website_publisher_user_id=settings.website_publisher_user_id,
        active_pdf_template_name="Letter Head ITWW HD.pdf",
        active_pdf_brand_mode="full_background_template",
        pdf_top_margin_mm=39,
        pdf_side_margin_mm=26,
        pdf_body_font_family="Times-Roman",
        pdf_heading_font_family="Times-Bold",
        pdf_base_font_size=11.5,
        pdf_heading_scale=1.48,
        default_careers_intro_text="Explore current vacancies from IT Solutions Worldwide.",
        default_apply_cta_text="Apply here",
        default_publish_title_suffix_rules="none",
        default_website_content_sanitization_mode="clean_markdown",
        include_company_logo_in_pdf=True,
        include_footer_branding=True,
        reuse_cached_template_images=True,
    )


def _default_ai_settings() -> AiSettingsData:
    return AiSettingsData(
        ai_provider_mode="auto",
        primary_jd_generation_model=settings.vertex_generative_model,
        backup_jd_generation_models=[
            item for item in settings.vertex_generative_models if item != settings.vertex_generative_model
        ],
        candidate_parsing_model=settings.vertex_generative_model,
        candidate_matching_model=settings.vertex_generative_model,
        talent_discovery_model=settings.vertex_generative_model,
        embedding_model=settings.vertex_embedding_model,
        vector_model_name=settings.talent_vector_model,
        temperature_for_jd_generation=0.4,
        temperature_for_candidate_summaries=0.2,
        max_retries_for_ai_requests=3,
        enable_candidate_matching=True,
        enable_hidden_talent_discovery=True,
        enable_automatic_role_suggestions=True,
        enable_ai_summary_generation_for_candidates=True,
        enable_automatic_jd_enrichment=True,
        prompt_tone_preset="corporate",
        prompt_language_preset="English",
        default_jd_style_preset="premium_markdown",
        default_vacancy_seniority_inference=True,
        matching_score_threshold=60,
        talent_discovery_minimum_score_threshold=55,
        candidate_role_suggestion_minimum_confidence_threshold=0.55,
        gemini_api_key_configured=bool(settings.gemini_api_key),
        vertex_project_configured=bool(settings.vertex_project_id),
    )


def _default_integrations_settings() -> IntegrationsSettingsData:
    return IntegrationsSettingsData(
        n8n_webhook_secret_status="configured" if settings.n8n_webhook_secret else "missing",
        n8n_hr_invite_webhook_url=settings.n8n_hr_invite_webhook_url,
        n8n_hr_approval_webhook_url=settings.n8n_hr_approval_webhook_url,
        n8n_hr_rejection_webhook_url=settings.n8n_hr_rejection_webhook_url,
        n8n_technical_invite_webhook_url=settings.n8n_technical_invite_webhook_url,
        n8n_technical_rejection_webhook_url=settings.n8n_technical_rejection_webhook_url,
        n8n_management_invite_webhook_url=settings.n8n_management_invite_webhook_url,
        n8n_management_rejection_webhook_url=settings.n8n_management_rejection_webhook_url,
        n8n_onboarding_approval_webhook_url=settings.n8n_onboarding_approval_webhook_url,
        n8n_linkedin_preview_webhook_url=settings.n8n_linkedin_preview_webhook_url,
        calendar_availability_webhook_url=settings.n8n_calendar_availability_webhook_url,
        calendar_booking_webhook_url=settings.n8n_calendar_booking_webhook_url,
        cal_com_webhook_secret_status="configured" if settings.cal_com_webhook_secret else "missing",
        cal_com_booking_base_url=settings.cal_com_booking_base_url,
        uploadthing_app_id=settings.uploadthing_app_id,
        uploadthing_token_status="configured" if settings.uploadthing_token else "missing",
        uploadthing_secret_status="configured" if settings.uploadthing_secret else "missing",
        website_database_connection_mode="external" if settings.website_database_url else "shared",
        website_database_configured=bool(settings.website_database_url or settings.database_url),
        resume_upload_storage_path=str(settings.resume_upload_dir),
        website_pdf_output_path=str(settings.website_pdf_output_dir),
    )


def _default_access_settings() -> AccessSettingsData:
    return AccessSettingsData(
        shared_internal_login_enabled=True,
        allowed_login_password_source_status="Configured in environment",
        session_duration_days=7,
        cookie_secure_mode=settings.auth_cookie_secure,
        cookie_same_site_mode="lax",
        auto_create_user_records_on_login=True,
        default_role_for_auto_created_users=UserRole.HR,
        restrict_login_to_allowed_email_domains=False,
        allowed_email_domains=["itsolutionsworldwide.local"],
        allow_local_addresses=True,
        last_login_tracking_enabled=True,
        login_support_message="Use your company email address and the shared internal password.",
        session_invalidation_epoch=0,
    )


def _default_support_settings() -> SupportSettingsData:
    general = _default_general_settings()
    return SupportSettingsData(
        support_email=general.default_recruiter_support_email,
        support_contact_name=general.default_support_contact_name,
        support_phone_or_teams_handle="Teams: Talent Genie Support",
        internal_documentation_url="https://example.com/internal-docs",
        faq_text=(
            "For vacancy publishing, candidate parsing, and pipeline questions, contact the internal support owner first."
        ),
        how_to_use_this_system_text=(
            "Use Hiring Requests to draft roles, Vacancies to manage open jobs, Candidates to review parsed resumes, "
            "and Pipeline to move candidates through interviews."
        ),
        escalation_guidance_text="Escalate blocking publishing, login, or parsing issues to the platform admin.",
        office_hours_response_expectation="Responses are typically handled during business hours in Europe/Amsterdam.",
        release_notes_text="Initial internal settings module rollout.",
        maintenance_banner_message="Scheduled maintenance may temporarily affect publishing and parsing flows.",
        maintenance_mode_notice_enabled=False,
    )


def _get_default_model(category: str):
    return {
        "general": GeneralSettingsData,
        "recruitment": RecruitmentSettingsData,
        "website_pdf": WebsitePdfSettingsData,
        "ai": AiSettingsData,
        "integrations_metadata": IntegrationsSettingsData,
        "access": AccessSettingsData,
        "support": SupportSettingsData,
    }[category]


def _build_default_data(category: str):
    return {
        "general": _default_general_settings,
        "recruitment": _default_recruitment_settings,
        "website_pdf": _default_website_pdf_settings,
        "ai": _default_ai_settings,
        "integrations_metadata": _default_integrations_settings,
        "access": _default_access_settings,
        "support": _default_support_settings,
    }[category]()


def _serialize_settings_category(session: Session, category: str) -> SettingsCategoryEnvelope:
    _ensure_settings_schema()
    default_model = _get_default_model(category)
    default_data = _build_default_data(category)
    record = session.exec(select(AppSetting).where(AppSetting.category == category)).first()
    if record is None:
        return SettingsCategoryEnvelope(
            category=category, data=default_data.model_dump(), source="default"
        )

    merged = {**default_data.model_dump(), **(record.data or {})}
    validated = default_model.model_validate(merged)
    return SettingsCategoryEnvelope(
        category=category,
        data=validated.model_dump(),
        updated_at=record.updated_at,
        updated_by_user_id=record.updated_by_user_id,
        source="merged",
    )


def _upsert_category(session: Session, category: str, payload: dict[str, Any], updated_by_user_id: int | None) -> SettingsCategoryEnvelope:
    _ensure_settings_schema()
    default_model = _get_default_model(category)
    default_data = _build_default_data(category).model_dump()
    current = session.exec(select(AppSetting).where(AppSetting.category == category)).first()

    read_only_keys = {
        "integrations_metadata": {
            "n8n_webhook_secret_status",
            "cal_com_webhook_secret_status",
            "uploadthing_token_status",
            "uploadthing_secret_status",
            "website_database_connection_mode",
            "website_database_configured",
            "resume_upload_storage_path",
            "website_pdf_output_path",
        },
        "ai": {"gemini_api_key_configured", "vertex_project_configured"},
        "access": {"allowed_login_password_source_status"},
    }.get(category, set())

    cleaned_payload = {key: value for key, value in payload.items() if key not in read_only_keys}
    validated = default_model.model_validate({**default_data, **cleaned_payload})

    if current is None:
        current = AppSetting(
            category=category,
            data=validated.model_dump(),
            updated_by_user_id=updated_by_user_id,
        )
    else:
        current.data = validated.model_dump()
        current.updated_by_user_id = updated_by_user_id

    session.add(current)
    session.commit()
    session.refresh(current)
    return _serialize_settings_category(session, category)


def get_settings_for_role(*, session: Session, role: str) -> SettingsReadResponse:
    allowed_categories = _ADMIN_CATEGORIES if role == UserRole.ADMIN.value else _USER_ALLOWED_CATEGORIES
    categories = {
        category: _serialize_settings_category(session, category)
        for category in _CATEGORY_ORDER
        if category in allowed_categories
    }
    return SettingsReadResponse(role=role, categories=categories)


def update_settings_category(*, session: Session, category: str, payload: dict[str, Any], updated_by_user_id: int | None) -> SettingsCategoryEnvelope:
    if category not in _ADMIN_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown settings category.")
    return _upsert_category(session, category, payload, updated_by_user_id)


def get_support_settings_runtime(*, session: Session | None = None) -> SupportSettingsData:
    return _with_session(session, lambda active_session: SupportSettingsData.model_validate(_serialize_settings_category(active_session, "support").data))


def get_access_settings_runtime(*, session: Session | None = None) -> AccessSettingsData:
    return _with_session(session, lambda active_session: AccessSettingsData.model_validate(_serialize_settings_category(active_session, "access").data))


def get_website_pdf_settings_runtime(*, session: Session | None = None) -> WebsitePdfSettingsData:
    return _with_session(session, lambda active_session: WebsitePdfSettingsData.model_validate(_serialize_settings_category(active_session, "website_pdf").data))


def get_general_settings_runtime(*, session: Session | None = None) -> GeneralSettingsData:
    return _with_session(session, lambda active_session: GeneralSettingsData.model_validate(_serialize_settings_category(active_session, "general").data))


def get_recruitment_settings_runtime(*, session: Session | None = None) -> RecruitmentSettingsData:
    return _with_session(session, lambda active_session: RecruitmentSettingsData.model_validate(_serialize_settings_category(active_session, "recruitment").data))


def get_ai_settings_runtime(*, session: Session | None = None) -> AiSettingsData:
    return _with_session(session, lambda active_session: AiSettingsData.model_validate(_serialize_settings_category(active_session, "ai").data))


def get_integrations_settings_runtime(*, session: Session | None = None) -> IntegrationsSettingsData:
    return _with_session(session, lambda active_session: IntegrationsSettingsData.model_validate(_serialize_settings_category(active_session, "integrations_metadata").data))


def get_or_create_user_preferences(*, session: Session, user_id: int) -> UserPreference:
    _ensure_settings_schema()
    preferences = session.exec(select(UserPreference).where(UserPreference.user_id == user_id)).first()
    if preferences is not None:
        return preferences

    preferences = UserPreference(
        user_id=user_id,
        preferred_display_name=None,
        timezone=settings.public_schedule_timezone,
        default_landing_page="/dashboard",
        default_dashboard="/dashboard",
        default_vacancy_list_view="table",
        default_candidate_list_view="table",
        default_pdf_open_behavior="new_tab",
        email_notifications=True,
        interview_reminders=True,
        publish_reminders=True,
        theme_mode="system",
        reduced_motion=False,
        table_density="comfortable",
        items_per_page=25,
    )
    session.add(preferences)
    session.commit()
    session.refresh(preferences)
    return preferences


def build_user_settings_payload(*, session: Session, user: User) -> UserSettingsReadResponse:
    _ensure_settings_schema()
    preferences = get_or_create_user_preferences(session=session, user_id=user.id)
    support = get_support_settings_runtime(session=session)
    return UserSettingsReadResponse(
        profile=UserSettingsProfileRead(
            full_name=user.full_name,
            email=user.email,
            preferred_display_name=preferences.preferred_display_name or user.full_name,
            timezone=preferences.timezone or settings.public_schedule_timezone,
            default_landing_page=preferences.default_landing_page or "/dashboard",
            role=user.role.value,
            department_name=user.department.name if user.department else None,
            account_created_at=user.created_at,
        ),
        preferences=UserSettingsPreferencesRead(
            default_dashboard=preferences.default_dashboard or "/dashboard",
            default_vacancy_list_view=preferences.default_vacancy_list_view or "table",
            default_candidate_list_view=preferences.default_candidate_list_view or "table",
            default_pdf_open_behavior=preferences.default_pdf_open_behavior or "new_tab",
            email_notifications=preferences.email_notifications,
            interview_reminders=preferences.interview_reminders,
            publish_reminders=preferences.publish_reminders,
            theme_mode=preferences.theme_mode or "system",
            reduced_motion=preferences.reduced_motion,
            table_density=preferences.table_density,
            items_per_page=preferences.items_per_page,
        ),
        support=support,
    )


def update_user_profile(*, session: Session, user: User, payload: UserProfileUpdateRequest) -> UserSettingsReadResponse:
    _ensure_settings_schema()
    preferences = get_or_create_user_preferences(session=session, user_id=user.id)
    user.full_name = payload.full_name.strip() or user.full_name
    preferences.preferred_display_name = payload.preferred_display_name.strip() or user.full_name
    preferences.timezone = payload.timezone.strip() or settings.public_schedule_timezone
    preferences.default_landing_page = payload.default_landing_page.strip() or "/dashboard"
    session.add(user)
    session.add(preferences)
    session.commit()
    session.refresh(user)
    session.refresh(preferences)
    return build_user_settings_payload(session=session, user=user)


def update_user_preferences(*, session: Session, user: User, payload: UserPreferencesUpdateRequest) -> UserSettingsReadResponse:
    _ensure_settings_schema()
    preferences = get_or_create_user_preferences(session=session, user_id=user.id)
    preferences.default_dashboard = payload.default_dashboard
    preferences.default_vacancy_list_view = payload.default_vacancy_list_view
    preferences.default_candidate_list_view = payload.default_candidate_list_view
    preferences.default_pdf_open_behavior = payload.default_pdf_open_behavior
    preferences.email_notifications = payload.email_notifications
    preferences.interview_reminders = payload.interview_reminders
    preferences.publish_reminders = payload.publish_reminders
    preferences.theme_mode = payload.theme_mode
    preferences.reduced_motion = payload.reduced_motion
    preferences.table_density = payload.table_density
    preferences.items_per_page = payload.items_per_page
    session.add(preferences)
    session.commit()
    session.refresh(preferences)
    return build_user_settings_payload(session=session, user=user)


def force_logout_all_sessions(*, session: Session, updated_by_user_id: int | None) -> SettingsCategoryEnvelope:
    _ensure_settings_schema()
    current = _serialize_settings_category(session, "access")
    payload = dict(current.data)
    payload["session_invalidation_epoch"] = int(datetime.now(timezone.utc).timestamp())
    return _upsert_category(session, "access", payload, updated_by_user_id)


def mark_user_login(*, session: Session, user: User) -> None:
    _ensure_settings_schema()
    user.last_login_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)


def get_system_summary(*, session: Session) -> SystemSummaryRead:
    _ensure_settings_schema()
    counts_summary = {
        "users": int(session.exec(select(func.count()).select_from(User)).one() or 0),
        "departments": int(session.exec(select(func.count()).select_from(Department)).one() or 0),
        "vacancies": int(session.exec(select(func.count()).select_from(Vacancy)).one() or 0),
        "candidates": int(session.exec(select(func.count()).select_from(Candidate)).one() or 0),
        "applications": int(session.exec(select(func.count()).select_from(Application)).one() or 0),
    }
    last_successful_publish_at = session.exec(select(func.max(WebsitePublication.updated_at))).one()
    last_successful_parse_job_at = session.exec(select(func.max(ParseJob.created_at))).one()
    last_successful_login_at = session.exec(select(func.max(User.last_login_at))).one()

    ai_settings = get_ai_settings_runtime(session=session)
    if ai_settings.ai_provider_mode == "gemini_api":
        provider_summary = "Gemini API configured" if settings.gemini_api_key else "Gemini API missing credentials"
    elif ai_settings.ai_provider_mode == "vertex_ai":
        provider_summary = "Vertex AI configured" if settings.vertex_project_id else "Vertex AI missing credentials"
    else:
        if settings.gemini_api_key:
            provider_summary = "Auto mode using Gemini API"
        elif settings.vertex_project_id:
            provider_summary = "Auto mode using Vertex AI"
        else:
            provider_summary = "No AI provider credentials configured"

    return SystemSummaryRead(
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        git_commit=os.getenv("VERCEL_GIT_COMMIT_SHA") or os.getenv("GIT_COMMIT_SHA") or "local",
        environment_name=os.getenv("VERCEL_ENV") or os.getenv("ENVIRONMENT") or "local",
        backend_api_base_url=_infer_backend_api_base_url(),
        frontend_app_url=_infer_frontend_app_url(),
        database_configured=bool(settings.database_url),
        website_database_configured=bool(settings.website_database_url or settings.database_url),
        ai_provider_availability_summary=provider_summary,
        upload_storage_path_status="available" if settings.resume_upload_dir.exists() else "not_created_yet",
        website_pdf_output_path_status="available" if settings.website_pdf_output_dir.exists() else "not_created_yet",
        counts_summary=counts_summary,
        last_successful_publish_at=last_successful_publish_at,
        last_successful_parse_job_at=last_successful_parse_job_at,
        last_successful_login_at=last_successful_login_at,
    )
