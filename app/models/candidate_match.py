from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CandidateMatch(Base):
    __tablename__ = "candidate_match"
    __table_args__ = (UniqueConstraint("candidate_id", "vacancy_id", name="uq_candidate_match_candidate_vacancy"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    match_score: Mapped[float] = mapped_column(nullable=False)
    ai_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    fit_explanation: Mapped[str | None] = mapped_column(String, nullable=True)
    matched_skills: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate.id"), nullable=False)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancy.id"), nullable=False)

    candidate: Mapped["Candidate"] = relationship(back_populates="matches")
    vacancy: Mapped["Vacancy"] = relationship(back_populates="candidate_matches")

    @property
    def candidate_name(self) -> str | None:
        return self.candidate.name if self.candidate else None
