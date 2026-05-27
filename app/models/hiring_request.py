from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import HiringRequestStatus


class HiringRequest(Base):
    __tablename__ = "hiringrequest"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    experience_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    headcount: Mapped[int] = mapped_column(default=1, nullable=False)
    status: Mapped[HiringRequestStatus] = mapped_column(
        SqlEnum(HiringRequestStatus),
        default=HiringRequestStatus.PENDING,
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    match_score: Mapped[float | None] = mapped_column(nullable=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    department_id: Mapped[int] = mapped_column(ForeignKey("department.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    department: Mapped["Department"] = relationship(back_populates="hiring_requests")
    created_by: Mapped["User"] = relationship(
        back_populates="created_hiring_requests",
        foreign_keys=[created_by_id],
    )
    reviewed_by: Mapped[Optional["User"]] = relationship(
        back_populates="reviewed_hiring_requests",
        foreign_keys=[reviewed_by_id],
    )
    vacancy: Mapped[Optional["Vacancy"]] = relationship(back_populates="hiring_request")
