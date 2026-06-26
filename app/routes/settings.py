from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.models.user import User
from app.schemas.settings import (
    PublicAuthSettingsRead,
    SettingsCategoryEnvelope,
    SettingsReadResponse,
    SystemSummaryRead,
    UserPreferencesUpdateRequest,
    UserProfileUpdateRequest,
    UserSettingsReadResponse,
)
from app.services.auth_service import get_authenticated_user, require_admin_user
from app.services.settings_service import (
    build_user_settings_payload,
    force_logout_all_sessions,
    get_access_settings_runtime,
    get_settings_for_role,
    get_support_settings_runtime,
    get_system_summary,
    update_settings_category,
    update_user_preferences,
    update_user_profile,
)


router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsReadResponse, summary="Get settings categories")
def get_settings(
    user: User = Depends(get_authenticated_user),
    session: Session = Depends(get_session),
):
    return get_settings_for_role(session=session, role=user.role.value)


@router.put("/{category}", response_model=SettingsCategoryEnvelope, summary="Update one settings category")
def put_settings_category(
    category: str,
    payload: dict[str, Any],
    user: User = Depends(require_admin_user),
    session: Session = Depends(get_session),
):
    return update_settings_category(
        session=session,
        category=category,
        payload=payload,
        updated_by_user_id=user.id,
    )


@router.get("/me", response_model=UserSettingsReadResponse, summary="Get personal settings")
def get_my_settings(
    user: User = Depends(get_authenticated_user),
    session: Session = Depends(get_session),
):
    return build_user_settings_payload(session=session, user=user)


@router.put("/me/profile", response_model=UserSettingsReadResponse, summary="Update personal profile settings")
def put_my_profile(
    payload: UserProfileUpdateRequest,
    user: User = Depends(get_authenticated_user),
    session: Session = Depends(get_session),
):
    return update_user_profile(session=session, user=user, payload=payload)


@router.put("/me/preferences", response_model=UserSettingsReadResponse, summary="Update personal preferences")
def put_my_preferences(
    payload: UserPreferencesUpdateRequest,
    user: User = Depends(get_authenticated_user),
    session: Session = Depends(get_session),
):
    return update_user_preferences(session=session, user=user, payload=payload)


@router.get("/system", response_model=SystemSummaryRead, summary="Get system diagnostics")
def get_settings_system(
    _user: User = Depends(require_admin_user),
    session: Session = Depends(get_session),
):
    return get_system_summary(session=session)


@router.post("/access/force-logout", response_model=SettingsCategoryEnvelope, summary="Force logout all active sessions")
def post_force_logout(
    user: User = Depends(require_admin_user),
    session: Session = Depends(get_session),
):
    return force_logout_all_sessions(session=session, updated_by_user_id=user.id)


@router.get("/public-auth", response_model=PublicAuthSettingsRead, summary="Get public auth messaging")
def get_public_auth_settings(session: Session = Depends(get_session)):
    access = get_access_settings_runtime(session=session)
    support = get_support_settings_runtime(session=session)
    return PublicAuthSettingsRead(
        login_support_message=access.login_support_message,
        maintenance_banner_message=support.maintenance_banner_message,
        maintenance_mode_notice_enabled=support.maintenance_mode_notice_enabled,
    )
