from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ParseJob(Base):
    __tablename__ = "parse_jobs"
    __table_args__ = (
        Index("idx_parse_jobs_status", "status"),
        Index("idx_parse_jobs_vacancy_id", "vacancy_id"),
        Index("idx_parse_jobs_created_at", "created_at"),
        Index("idx_parse_jobs_status_created_at", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancy.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="uploaded", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidate.id", ondelete="SET NULL"), nullable=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("application.id", ondelete="SET NULL"), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="manual_upload", nullable=False)
    uploaded_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    vacancy: Mapped["Vacancy"] = relationship()
    candidate: Mapped["Candidate | None"] = relationship()
    application: Mapped["Application | None"] = relationship()
