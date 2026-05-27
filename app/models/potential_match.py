from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PotentialMatch(Base):
    __tablename__ = "potential_matches"
    __table_args__ = (UniqueConstraint("candidate_id", "vacancy_id", name="uq_potential_match_candidate_vacancy"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    potential_score: Mapped[float] = mapped_column(nullable=False)
    justification: Mapped[str] = mapped_column(String, nullable=False)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate.id"), nullable=False, index=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancy.id"), nullable=False, index=True)

    candidate: Mapped["Candidate"] = relationship(back_populates="potential_matches")
    vacancy: Mapped["Vacancy"] = relationship(back_populates="potential_matches")
