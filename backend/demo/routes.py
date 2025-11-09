"""Demo routes for quickly inserting anomalies."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.core.models import Cauldron, DrainEvent

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoAnomalyRequest(BaseModel):
    cauldron_id: str = Field(..., description="Cauldron to flag")
    loss_percent: float = Field(5.0, description="Fill percentage drop to log")
    reason: str = Field("demo_underreported", description="Reason note")


class DemoAnomalyResponse(BaseModel):
    event_id: int
    created_at: datetime


@router.post("/anomaly", response_model=DemoAnomalyResponse)
def trigger_anomaly(payload: DemoAnomalyRequest, session: Session = Depends(get_session)) -> DemoAnomalyResponse:
    cauldron = session.get(Cauldron, payload.cauldron_id)
    if not cauldron:
        raise HTTPException(status_code=404, detail="Unknown cauldron")

    event = DrainEvent(
        cauldron_id=cauldron.id,
        detected_at=datetime.utcnow(),
        estimated_loss=payload.loss_percent,
        reason=payload.reason,
        confidence=0.5,
        extra={"demo": True},
    )
    session.add(event)
    session.flush()
    return DemoAnomalyResponse(event_id=event.id, created_at=event.detected_at)
