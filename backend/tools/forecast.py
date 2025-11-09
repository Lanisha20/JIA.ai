"""Simple fill-level forecaster tool."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.logic.services import forecast_fill


class ForecastRequest(BaseModel):
    cauldron_ids: Optional[List[str]] = None
    horizon_hours: int = Field(default=6, ge=1, le=48)


class ForecastResult(BaseModel):
    cauldron_id: str
    name: str
    forecast: List[dict]


class ForecastResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    results: List[ForecastResult]


router = APIRouter()


@router.post("/forecast", response_model=ForecastResponse)
def run_forecast(
    payload: ForecastRequest, session: Session = Depends(get_session)
) -> ForecastResponse:
    forecasts = forecast_fill(
        session,
        cauldron_ids=payload.cauldron_ids,
        horizon_hours=payload.horizon_hours,
    )
    response = ForecastResponse(results=[ForecastResult(**item) for item in forecasts])
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="forecast",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["forecast"],
    )
    return response
