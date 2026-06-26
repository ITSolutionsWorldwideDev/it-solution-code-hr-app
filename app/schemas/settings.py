from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.enums import UserRole


SettingsCategory = Literal[
    "general",
    "recruitment",
    "website_pdf",
    "ai",
    "integrations_metadata",
    "access",
    "support",
]


class GeneralSettingsData(BaseModel):
    company_name: str
    company_legal_name: str
    default_country: str
    default_language: str
    default_timezone: str
    public_website_base_url: str
    public_careers_base_url: str
    public_apply_base_url: str
    public_schedule_base_url: str
    default_office_location_label: str
    default_employment_type_options: list[str] = Field(default_factory=list)
    default_weekly_hours_label: str
    default_work_authorization_text: str
    default_company_intro_text: str
    default_about_us_text: str
    default_recruiter_support_email: str
    default_support_contact_name: str


class RecruitmentSettingsData(BaseModel):
    default_vacancy_status: str
    default_shortlist_bucket_behavior: str
    default_candidate_stage_after_parsing: str
    default_department_for_new_requests: str
    default_perks_block: str
    default_requirements_intro: str
    default_responsibilities_intro: str
    default_what_we_offer_intro: str
    default_interview_duration_minutes: int
    default_scheduling_lead_time_hours: int
    default_days_ahead_for_scheduling: int
    default_business_start_hour: int
    default_business_end_hour: int
    default_rejection_reason_templates: list[str] = Field(default_factory=list)
    default_interview_invite_templates: list[str] = Field(default_factory=list)
    default_offer_template_text: str
    auto_create_vacancy_after_hiring_request_approval: bool
    auto_publish_vacancy_after_approval: bool
    auto_generate_website_pdf_after_publish: bool


class WebsitePdfSettingsData(BaseModel):
    active_website_publish_table_name: str
    website_publisher_user_id: int | None = None
    active_pdf_template_name: str
    active_pdf_brand_mode: Literal["full_background_template", "header_footer_extraction_fallback"]
    pdf_top_margin_mm: int
    pdf_side_margin_mm: int
    pdf_body_font_family: str
    pdf_heading_font_family: str
    pdf_base_font_size: float
    pdf_heading_scale: float
    default_careers_intro_text: str
    default_apply_cta_text: str
    default_publish_title_suffix_rules: str
    default_website_content_sanitization_mode: str
    include_company_logo_in_pdf: bool
    include_footer_branding: bool
    reuse_cached_template_images: bool


class AiSettingsData(BaseModel):
    ai_provider_mode: Literal["gemini_api", "vertex_ai", "auto"]
    primary_jd_generation_model: str
    backup_jd_generation_models: list[str] = Field(default_factory=list)
    candidate_parsing_model: str
    candidate_matching_model: str
    talent_discovery_model: str
    embedding_model: str
    vector_model_name: str
    temperature_for_jd_generation: float
    temperature_for_candidate_summaries: float
    max_retries_for_ai_requests: int
    enable_candidate_matching: bool
    enable_hidden_talent_discovery: bool
    enable_automatic_role_suggestions: bool
    enable_ai_summary_generation_for_candidates: bool
    enable_automatic_jd_enrichment: bool
    prompt_tone_preset: Literal["corporate", "concise", "warm_professional"]
    prompt_language_preset: str
    default_jd_style_preset: str
    default_vacancy_seniority_inference: bool
    matching_score_threshold: float
    talent_discovery_minimum_score_threshold: float
    candidate_role_suggestion_minimum_confidence_threshold: float
    gemini_api_key_configured: bool = False
    vertex_project_configured: bool = False


class IntegrationsSettingsData(BaseModel):
    n8n_webhook_secret_status: str
    n8n_hr_invite_webhook_url: str
    n8n_hr_approval_webhook_url: str | None = None
    n8n_hr_rejection_webhook_url: str | None = None
    n8n_technical_invite_webhook_url: str | None = None
    n8n_technical_rejection_webhook_url: str | None = None
    n8n_management_invite_webhook_url: str | None = None
    n8n_management_rejection_webhook_url: str | None = None
    n8n_onboarding_approval_webhook_url: str | None = None
    n8n_linkedin_preview_webhook_url: str
    calendar_availability_webhook_url: str | None = None
    calendar_booking_webhook_url: str | None = None
    cal_com_webhook_secret_status: str
    cal_com_booking_base_url: str
    uploadthing_app_id: str | None = None
    uploadthing_token_status: str
    uploadthing_secret_status: str
    website_database_connection_mode: str
    website_database_configured: bool
    resume_upload_storage_path: str
    website_pdf_output_path: str


class AccessSettingsData(BaseModel):
    shared_internal_login_enabled: bool
    allowed_login_password_source_status: str
    session_duration_days: int
    cookie_secure_mode: bool
    cookie_same_site_mode: Literal["lax", "strict", "none"]
    auto_create_user_records_on_login: bool
    default_role_for_auto_created_users: UserRole
    restrict_login_to_allowed_email_domains: bool
    allowed_email_domains: list[str] = Field(default_factory=list)
    allow_local_addresses: bool
    last_login_tracking_enabled: bool
    login_support_message: str
    session_invalidation_epoch: int = 0


class SupportSettingsData(BaseModel):
    support_email: str
    support_contact_name: str
    support_phone_or_teams_handle: str
    internal_documentation_url: str
    faq_text: str
    how_to_use_this_system_text: str
    escalation_guidance_text: str
    office_hours_response_expectation: str
    release_notes_text: str
    maintenance_banner_message: str
    maintenance_mode_notice_enabled: bool


class SettingsCategoryEnvelope(BaseModel):
    category: SettingsCategory
    updated_at: datetime | None = None
    updated_by_user_id: int | None = None
    source: Literal["default", "database", "merged"] = "default"
    data: dict[str, Any]


class SettingsReadResponse(BaseModel):
    role: str
    categories: dict[str, SettingsCategoryEnvelope]


class UserSettingsProfileRead(BaseModel):
    full_name: str
    email: str
    preferred_display_name: str
    timezone: str
    default_landing_page: str
    role: str
    department_name: str | None = None
    account_created_at: datetime | None = None


class UserSettingsPreferencesRead(BaseModel):
    default_dashboard: str
    default_vacancy_list_view: str
    default_candidate_list_view: str
    default_pdf_open_behavior: str
    email_notifications: bool
    interview_reminders: bool
    publish_reminders: bool
    theme_mode: str
    reduced_motion: bool
    table_density: str
    items_per_page: int


class UserSettingsReadResponse(BaseModel):
    profile: UserSettingsProfileRead
    preferences: UserSettingsPreferencesRead
    support: SupportSettingsData


class UserProfileUpdateRequest(BaseModel):
    full_name: str
    preferred_display_name: str
    timezone: str
    default_landing_page: str


class UserPreferencesUpdateRequest(BaseModel):
    default_dashboard: str
    default_vacancy_list_view: str
    default_candidate_list_view: str
    default_pdf_open_behavior: str
    email_notifications: bool
    interview_reminders: bool
    publish_reminders: bool
    theme_mode: str
    reduced_motion: bool
    table_density: str
    items_per_page: int


class PublicAuthSettingsRead(BaseModel):
    login_support_message: str
    maintenance_banner_message: str
    maintenance_mode_notice_enabled: bool


class SystemSummaryRead(BaseModel):
    app_version: str
    git_commit: str
    environment_name: str
    backend_api_base_url: str
    frontend_app_url: str
    database_configured: bool
    website_database_configured: bool
    ai_provider_availability_summary: str
    upload_storage_path_status: str
    website_pdf_output_path_status: str
    counts_summary: dict[str, int]
    last_successful_publish_at: datetime | None = None
    last_successful_parse_job_at: datetime | None = None
    last_successful_login_at: datetime | None = None
