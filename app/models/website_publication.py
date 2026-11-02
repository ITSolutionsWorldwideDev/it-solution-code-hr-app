from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WebsitePublication(Base):
    __tablename__ = "website_publication"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancy.id"), unique=True, nullable=False)
    job_info_id: Mapped[int] = mapped_column(Integer, nullable=False)
    itww_job_info_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ish_job_info_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dinel_job_info_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_portal: Mapped[str] = mapped_column(String(50), default="all", nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
