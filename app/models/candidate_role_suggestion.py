from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CandidateRoleSuggestion(Base):
    __tablename__ = "candidate_role_suggestion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence_score: Mapped[float] = mapped_column(nullable=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate.id"), nullable=False)

    candidate: Mapped["Candidate"] = relationship(back_populates="role_suggestions")
