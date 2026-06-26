from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models.enums import UserRole
from app.models.user import User


router = APIRouter(prefix="/auth", tags=["Auth"])

AUTH_COOKIE_NAME = "tg_internal_session"
AUTH_ROLE = "internal"


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
    email: str
    role: str


def _derive_full_name(email: str) -> str:
    local_part = email.split("@", 1)[0].strip()
    pieces = [piece for piece in local_part.replace("-", " ").replace("_", " ").replace("+", " ").replace(".", " ").split() if piece]
    if not pieces:
        return "Internal User"
    return " ".join(piece[:1].upper() + piece[1:] for piece in pieces)


def _build_auth_token(*, email: str) -> str:
    issued_at = datetime.now(timezone.utc)
    payload = {
        "email": email,
        "role": AUTH_ROLE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(days=7)).timestamp()),
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def _read_auth_session(token: str | None) -> SessionRead | None:
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.auth_jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None

    email = str(payload.get("email") or "").strip()
    role = str(payload.get("role") or "").strip()
    if not email or role != AUTH_ROLE:
        return None

    try:
        return SessionRead(email=email, role=role)
    except Exception:
        return None


def _set_auth_cookie(response: Response, *, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
        max_age=7 * 24 * 60 * 60,
        expires=7 * 24 * 60 * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
        path="/",
    )


def _ensure_internal_user(session: Session, *, email: str) -> None:
    existing_user = session.exec(select(User).where(User.email == email)).first()
    if existing_user is not None:
        return

    session.add(
        User(
            email=email,
            full_name=_derive_full_name(email),
            role=UserRole.HR,
            department_id=None,
        )
    )
    session.commit()


@router.post(
    "/login",
    response_model=SessionRead,
    summary="Log in",
    description="Validate an internal email/password pair and issue a session cookie.",
)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_session)) -> SessionRead:
    if payload.password != settings.internal_login_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    normalized_email = str(payload.email).strip().lower()
    _ensure_internal_user(db, email=normalized_email)

    session = SessionRead(email=normalized_email, role=AUTH_ROLE)
    token = _build_auth_token(email=session.email)
    _set_auth_cookie(response, token=token)
    return session


@router.get(
    "/me",
    response_model=SessionRead,
    summary="Current session",
    description="Return the authenticated internal session from the JWT cookie.",
)
def me(
    session_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> SessionRead:
    session = _read_auth_session(session_token)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    return session


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out",
    description="Clear the authenticated internal session cookie.",
)
def logout(response: Response) -> Response:
    _clear_auth_cookie(response)
    return response
