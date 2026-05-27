from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ApplicationStage, ShortlistBucket, UserRole


class Application(Base):
    __tablename__ = "application"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    match_score: Mapped[float | None] = mapped_column(nullable=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    stage: Mapped[ApplicationStage] = mapped_column(
        SqlEnum(ApplicationStage),
        default=ApplicationStage.PARSED,
        nullable=False,
        index=True,
    )
    current_owner_role: Mapped[UserRole | None] = mapped_column(SqlEnum(UserRole), nullable=True, index=True)
    ranking_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ranking_position: Mapped[int | None] = mapped_column(nullable=True)
    shortlist_bucket: Mapped[ShortlistBucket] = mapped_column(
        SqlEnum(ShortlistBucket),
        default=ShortlistBucket.NONE,
        nullable=False,
        index=True,
    )
    invite_selected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invite_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invite_sent_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    hr_interview_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    technical_interview_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    management_interview_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    selected_for_offer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    offer_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    offer_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    offer_declined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate.id"), nullable=False, index=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancy.id"), nullable=False, index=True)

    candidate: Mapped["Candidate"] = relationship(back_populates="applications")
    vacancy: Mapped["Vacancy"] = relationship(back_populates="applications")
    invite_sent_by: Mapped["User | None"] = relationship(foreign_keys=[invite_sent_by_id])
    stage_events: Mapped[list["ApplicationStageEvent"]] = relationship(back_populates="application")
    email_events: Mapped[list["ApplicationEmailEvent"]] = relationship(back_populates="application")
    interviews: Mapped[list["ApplicationInterview"]] = relationship(back_populates="application")
