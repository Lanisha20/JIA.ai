"""Demo-only routes to quickly exercise the system."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.core.models import DrainEvent


class DemoAnomalyRequest(BaseModel):
    cauldron_id: str
    loss_percent: float = Field(default=5.0, description="Percent loss to record")
    reason: Optional[str] = Field(default="Underreported ticket")


class DemoAnomalyResponse(BaseModel):
    created_at: datetime
    event_id: int


router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/anomaly", response_model=DemoAnomalyResponse)
def trigger_anomaly(
    payload: DemoAnomalyRequest, session: Session = Depends(get_session)
) -> DemoAnomalyResponse:
    cauldron = queries.latest_levels(session)
    if not any(state["cauldron_id"] == payload.cauldron_id for state in cauldron):
        raise HTTPException(status_code=404, detail="Unknown cauldron")

    event = DrainEvent(
        cauldron_id=payload.cauldron_id,
        detected_at=datetime.utcnow(),
        estimated_loss=payload.loss_percent,
        reason=payload.reason,
        confidence=0.9,
        extra={"demo": True},
    )
    session.add(event)
    session.flush()

    queries.log_agent_trace(
        session,
        agent="demo",
        action="demo_anomaly",
        input_payload=payload.model_dump(),
        output_payload={"event_id": event.id},
        tags=["demo", "anomaly"],
    )

    return DemoAnomalyResponse(created_at=event.detected_at, event_id=event.id)
