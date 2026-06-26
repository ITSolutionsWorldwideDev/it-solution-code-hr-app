from __future__ import annotations

from pydantic import BaseModel, field_validator
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models.enums import UserRole
from app.models.user import User
from app.services.auth_service import (
    AUTH_COOKIE_NAME,
    build_auth_token,
    clear_auth_cookie,
    derive_full_name,
    read_auth_session,
    set_auth_cookie,
)
from app.services.settings_service import (
    get_access_settings_runtime,
    get_support_settings_runtime,
    mark_user_login,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Enter a valid email address.")

        local_part, domain = normalized.split("@", 1)
        if not local_part or not domain:
            raise ValueError("Enter a valid email address.")

        if any(part.strip() == "" for part in domain.split(".")):
            raise ValueError("Enter a valid email address.")

        if " " in normalized:
            raise ValueError("Enter a valid email address.")

        return normalized


class SessionRead(BaseModel):
    user_id: int
    email: str
    role: str
    name: str


def _resolve_user_for_login(*, session: Session, email: str, access_settings) -> User:
    existing_user = session.exec(select(User).where(User.email == email)).first()
    if existing_user is not None:
        return existing_user

    if not access_settings.auto_create_user_records_on_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not allowed to access the workspace.",
        )

    user = User(
        email=email,
        full_name=derive_full_name(email),
        role=access_settings.default_role_for_auto_created_users or UserRole.HR,
        department_id=None,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _validate_login_rules(*, email: str, password: str, access_settings) -> None:
    if not access_settings.shared_internal_login_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal login is currently disabled.",
        )

    if password != settings.internal_login_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    domain = email.split("@", 1)[1].strip().lower()
    if domain.endswith(".local") and not access_settings.allow_local_addresses:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Local email addresses are not allowed for login.",
        )

    if access_settings.restrict_login_to_allowed_email_domains:
        allowed_domains = {item.strip().lower() for item in access_settings.allowed_email_domains if item.strip()}
        if domain not in allowed_domains:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This email domain is not allowed for login.",
            )


def _build_session_read(user: User) -> SessionRead:
    return SessionRead(
        user_id=user.id,
        email=user.email,
        role=user.role.value,
        name=user.full_name,
    )


@router.post(
    "/login",
    response_model=SessionRead,
    summary="Log in",
    description="Validate an internal email/password pair and issue a session cookie.",
)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_session)) -> SessionRead:
    access_settings = get_access_settings_runtime(session=db)
    _validate_login_rules(email=payload.email, password=payload.password, access_settings=access_settings)

    user = _resolve_user_for_login(session=db, email=payload.email, access_settings=access_settings)
    if access_settings.last_login_tracking_enabled:
        mark_user_login(session=db, user=user)

    token = build_auth_token(user=user, session_duration_days=access_settings.session_duration_days)
    set_auth_cookie(
        response=response,
        token=token,
        secure=access_settings.cookie_secure_mode,
        same_site=access_settings.cookie_same_site_mode,
        max_age_seconds=access_settings.session_duration_days * 24 * 60 * 60,
    )
    return _build_session_read(user)


@router.get(
    "/me",
    response_model=SessionRead,
    summary="Current session",
    description="Return the authenticated internal session from the JWT cookie.",
)
def me(
    session_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
    db: Session = Depends(get_session),
) -> SessionRead:
    auth_session = read_auth_session(session_token, db)
    if auth_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    return SessionRead(
        user_id=auth_session.user_id or 0,
        email=auth_session.email,
        role=auth_session.role,
        name=auth_session.name,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out",
    description="Clear the authenticated internal session cookie.",
)
def logout(response: Response, db: Session = Depends(get_session)) -> Response:
    access_settings = get_access_settings_runtime(session=db)
    clear_auth_cookie(
        response=response,
        secure=access_settings.cookie_secure_mode,
        same_site=access_settings.cookie_same_site_mode,
    )
    return response


@router.get(
    "/public-settings",
    summary="Public auth settings",
    description="Return public login-page messaging without requiring authentication.",
)
def public_auth_settings(db: Session = Depends(get_session)) -> dict[str, object]:
    access_settings = get_access_settings_runtime(session=db)
    support_settings = get_support_settings_runtime(session=db)
    return {
        "login_support_message": access_settings.login_support_message,
        "maintenance_banner_message": support_settings.maintenance_banner_message,
        "maintenance_mode_notice_enabled": support_settings.maintenance_mode_notice_enabled,
    }
