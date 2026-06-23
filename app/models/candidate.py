from __future__ import annotations

from typing import Optional

from sqlalchemy import LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Candidate(Base):
    __tablename__ = "candidate"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    experience: Mapped[str | None] = mapped_column(String, nullable=True)
    education: Mapped[str | None] = mapped_column(String, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    match_score: Mapped[float | None] = mapped_column(nullable=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    resume_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resume_file_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    resume_file_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    applications: Mapped[list["Application"]] = relationship(back_populates="candidate")
    employee: Mapped[Optional["Employee"]] = relationship(back_populates="candidate")
    matches: Mapped[list["CandidateMatch"]] = relationship(back_populates="candidate")
    potential_matches: Mapped[list["PotentialMatch"]] = relationship(back_populates="candidate")
    role_suggestions: Mapped[list["CandidateRoleSuggestion"]] = relationship(back_populates="candidate")
