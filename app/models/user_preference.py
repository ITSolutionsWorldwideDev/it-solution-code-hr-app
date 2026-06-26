from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), unique=True, nullable=False, index=True)
    preferred_display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_landing_page: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_dashboard: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_vacancy_list_view: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_candidate_list_view: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_pdf_open_behavior: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    interview_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    publish_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    theme_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reduced_motion: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    table_density: Mapped[str] = mapped_column(String(50), default="comfortable", nullable=False)
    items_per_page: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
