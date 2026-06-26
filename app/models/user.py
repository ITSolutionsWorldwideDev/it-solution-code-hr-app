from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("department.id"), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    department: Mapped[Optional["Department"]] = relationship(back_populates="users")
    created_hiring_requests: Mapped[list["HiringRequest"]] = relationship(
        back_populates="created_by",
        foreign_keys="HiringRequest.created_by_id",
    )
    reviewed_hiring_requests: Mapped[list["HiringRequest"]] = relationship(
        back_populates="reviewed_by",
        foreign_keys="HiringRequest.reviewed_by_id",
    )
