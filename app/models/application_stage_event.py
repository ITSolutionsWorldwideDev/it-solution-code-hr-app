from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ApplicationStage, UserRole


class ApplicationStageEvent(Base):
    __tablename__ = "application_stage_event"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("application.id"), nullable=False, index=True)
    from_stage: Mapped[ApplicationStage | None] = mapped_column(SqlEnum(ApplicationStage), nullable=True)
    to_stage: Mapped[ApplicationStage] = mapped_column(SqlEnum(ApplicationStage), nullable=False)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    changed_by_role: Mapped[UserRole | None] = mapped_column(SqlEnum(UserRole), nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    application: Mapped["Application"] = relationship(back_populates="stage_events")
    changed_by: Mapped["User | None"] = relationship()
