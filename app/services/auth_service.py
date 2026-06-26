from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models.enums import UserRole
from app.models.user import User
from app.services.settings_service import get_access_settings_runtime


AUTH_COOKIE_NAME = "tg_internal_session"


@dataclass
class AuthSessionData:
    user_id: int | None
    email: str
    role: str
    name: str
    issued_at: int


def derive_full_name(email: str) -> str:
    local_part = email.split("@", 1)[0].strip()
    pieces = [piece for piece in local_part.replace("-", " ").replace("_", " ").replace("+", " ").replace(".", " ").split() if piece]
    if not pieces:
        return "Internal User"
    return " ".join(piece[:1].upper() + piece[1:] for piece in pieces)


def build_auth_token(*, user: User, session_duration_days: int) -> str:
    issued_at = datetime.now(timezone.utc)
    payload = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role.value,
        "name": user.full_name,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(days=session_duration_days)).timestamp()),
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def read_auth_session(token: str | None, session: Session) -> AuthSessionData | None:
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.auth_jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None

    email = str(payload.get("email") or "").strip().lower()
    role = str(payload.get("role") or "").strip()
    issued_at = int(payload.get("iat") or 0)
    if not email or not role:
        return None

    access_settings = get_access_settings_runtime(session=session)
    invalidation_epoch = int(access_settings.session_invalidation_epoch or 0)
    if invalidation_epoch and issued_at < invalidation_epoch:
        return None

    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        return None

    return AuthSessionData(
        user_id=user.id,
        email=user.email,
        role=user.role.value,
        name=user.full_name,
        issued_at=issued_at,
    )


def set_auth_cookie(*, response, token: str, secure: bool, same_site: str, max_age_seconds: int) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite=same_site,
        secure=secure,
        max_age=max_age_seconds,
        expires=max_age_seconds,
        path="/",
    )


def clear_auth_cookie(*, response, secure: bool, same_site: str) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        samesite=same_site,
        secure=secure,
        path="/",
    )


def get_authenticated_user(
    session_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
    session: Session = Depends(get_session),
) -> User:
    auth_session = read_auth_session(session_token, session)
    if auth_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    user = session.exec(select(User).where(User.email == auth_session.email)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    return user


def require_admin_user(user: User = Depends(get_authenticated_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )
    return user
