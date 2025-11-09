"""Detect anomalies in cauldron telemetry."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.logic.services import detect_ticket_anomalies


class DetectRequest(BaseModel):
    cauldron_ids: Optional[List[str]] = Field(
        default=None, description="Limit evaluation to a subset of cauldrons"
    )
    threshold: float = Field(
        default=10.0,
        description="Minimum percentage swing in fill level to flag an anomaly",
    )


class DetectionResult(BaseModel):
    cauldron_id: str
    issue: str
    fill_percent: Optional[float]
    delta: Optional[float]
    observations: List[str]
    tickets: List[str]
    detail: str


class DetectResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    anomalies: List[DetectionResult]


router = APIRouter()


@router.post("/detect", response_model=DetectResponse)
def run_detect(payload: DetectRequest, session: Session = Depends(get_session)) -> DetectResponse:
    anomalies = detect_ticket_anomalies(
        session,
        cauldron_ids=payload.cauldron_ids,
        threshold=payload.threshold,
    )
    response = DetectResponse(anomalies=[DetectionResult(**item) for item in anomalies])
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="detect",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["detect", "anomaly"],
    )
    return response
