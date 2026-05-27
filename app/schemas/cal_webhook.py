from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import BaseSchema


class CalWebhookAttendee(BaseSchema):
    email: str
    name: str | None = None


class CalWebhookPayload(BaseSchema):
    title: str | None = None
    startTime: datetime
    endTime: datetime | None = None
    uid: str | None = None
    bookingId: int | None = None
    bookerEmail: str | None = None
    attendees: list[CalWebhookAttendee] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    responses: dict[str, Any] = Field(default_factory=dict)
    customInputs: dict[str, Any] = Field(default_factory=dict)


class CalWebhookEnvelope(BaseSchema):
    triggerEvent: str
    createdAt: datetime | None = None
    payload: CalWebhookPayload


class CalWebhookResponse(BaseSchema):
    ok: bool
    message: str
    application_id: int | None = None
