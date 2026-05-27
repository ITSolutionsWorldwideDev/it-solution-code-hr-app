from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import OnboardingStatus


class Employee(Base):
    __tablename__ = "employee"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    documents_status: Mapped[str] = mapped_column(String(100), default="pending", nullable=False)
    signed_offer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    onboarding_status: Mapped[OnboardingStatus] = mapped_column(
        SqlEnum(OnboardingStatus),
        default=OnboardingStatus.NOT_STARTED,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidate.id"),
        unique=True,
        nullable=True,
    )
    department_id: Mapped[int | None] = mapped_column(ForeignKey("department.id"), nullable=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("employee.id"), nullable=True)

    candidate: Mapped[Optional["Candidate"]] = relationship(back_populates="employee")
    department: Mapped[Optional["Department"]] = relationship(back_populates="employees")
    manager: Mapped[Optional["Employee"]] = relationship(
        back_populates="direct_reports",
        remote_side="Employee.id",
    )
    direct_reports: Mapped[list["Employee"]] = relationship(back_populates="manager")
