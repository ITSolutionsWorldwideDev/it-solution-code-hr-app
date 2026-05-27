from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum as SqlEnum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import InterviewDecision, InterviewStageType, InterviewStatus


class ApplicationInterview(Base):
    __tablename__ = "application_interview"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("application.id"), nullable=False, index=True)
    stage_type: Mapped[InterviewStageType] = mapped_column(SqlEnum(InterviewStageType), nullable=False, index=True)
    status: Mapped[InterviewStatus] = mapped_column(SqlEnum(InterviewStatus), default=InterviewStatus.SCHEDULED, nullable=False)
    decision: Mapped[InterviewDecision] = mapped_column(SqlEnum(InterviewDecision), default=InterviewDecision.PENDING, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    interviewer_user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    application: Mapped["Application"] = relationship(back_populates="interviews")
    interviewer: Mapped["User | None"] = relationship()
