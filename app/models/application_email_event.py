from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EmailStatus, EmailType


class ApplicationEmailEvent(Base):
    __tablename__ = "application_email_event"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("application.id"), nullable=False, index=True)
    email_type: Mapped[EmailType] = mapped_column(SqlEnum(EmailType), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[EmailStatus] = mapped_column(SqlEnum(EmailStatus), default=EmailStatus.PENDING, nullable=False)
    sent_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    application: Mapped["Application"] = relationship(back_populates="email_events")
    sent_by: Mapped["User | None"] = relationship()
