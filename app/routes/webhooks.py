from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from app.db import get_session
from app.schemas.cal_webhook import CalWebhookEnvelope, CalWebhookResponse
from app.services.cal_webhook_service import (
    process_cal_booking_created,
    verify_cal_webhook_signature,
)


router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/cal",
    response_model=CalWebhookResponse,
    summary="Process Cal.com booking webhooks",
)
async def process_cal_webhook(
    request: Request,
    session: Session = Depends(get_session),
):
    raw_body = await request.body()
    verify_cal_webhook_signature(raw_body, request.headers.get("x-cal-signature-256"))
    payload = CalWebhookEnvelope.model_validate(json.loads(raw_body.decode("utf-8")))

    if payload.triggerEvent != "BOOKING_CREATED":
        return CalWebhookResponse(
            ok=True,
            message=f"Ignored unsupported Cal.com trigger '{payload.triggerEvent}'.",
            application_id=None,
        )

    application = process_cal_booking_created(session, payload)
    return CalWebhookResponse(
        ok=True,
        message="Cal.com booking was processed successfully.",
        application_id=application.id,
    )
