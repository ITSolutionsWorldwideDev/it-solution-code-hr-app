from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import VacancyStatus


class Vacancy(Base):
    __tablename__ = "vacancy"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    experience_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[VacancyStatus] = mapped_column(
        SqlEnum(VacancyStatus),
        default=VacancyStatus.OPEN,
        nullable=False,
    )
    ai_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    match_score: Mapped[float | None] = mapped_column(nullable=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    department_id: Mapped[int] = mapped_column(ForeignKey("department.id"), nullable=False)
    hiring_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("hiringrequest.id"),
        unique=True,
        nullable=True,
    )

    department: Mapped["Department"] = relationship(back_populates="vacancies")
    hiring_request: Mapped[Optional["HiringRequest"]] = relationship(back_populates="vacancy")
    applications: Mapped[list["Application"]] = relationship(back_populates="vacancy")
    candidate_matches: Mapped[list["CandidateMatch"]] = relationship(back_populates="vacancy")
    potential_matches: Mapped[list["PotentialMatch"]] = relationship(back_populates="vacancy")
