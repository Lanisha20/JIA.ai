"""Forecast endpoint."""

from __future__ import annotations

from datetime import datetime, timedelta
import random
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.core.models import Cauldron, CauldronLevel
from backend.logic import forecast as forecast_logic

router = APIRouter()


class ForecastRequest(BaseModel):
    cauldron_id: str
    horizon_minutes: int = Field(240, ge=30, le=1440)


class ForecastPoint(BaseModel):
    ts: str
    volume: float


class ForecastResponse(BaseModel):
    cauldron_id: str
    overflow_eta: Optional[str]
    series: List[ForecastPoint]


def _fallback_forecast(cauldron_id: str) -> ForecastResponse:
    now = datetime.utcnow()
    start = now - timedelta(minutes=30)
    volume = 400 + random.randint(-30, 30)
    series = []
    for idx in range(8):
        ts = start + timedelta(minutes=idx * 10)
        volume = max(0, volume + random.randint(-8, 8))
        series.append(ForecastPoint(ts=ts.isoformat().replace("+00:00", "Z"), volume=volume))
    return ForecastResponse(
        cauldron_id=cauldron_id,
        overflow_eta=None,
        series=series,
    )


@router.post("/forecast", response_model=ForecastResponse)
def run_forecast(payload: ForecastRequest, session: Session = Depends(get_session)) -> ForecastResponse:
    cauldron = session.get(Cauldron, payload.cauldron_id)
    if not cauldron:
        fallback = _fallback_forecast(payload.cauldron_id)
        queries.log_agent_trace(
            session,
            agent="nemotron",
            action="forecast",
            input_payload=payload.model_dump(),
            output_payload=fallback.model_dump(),
            tags=["forecast", "fallback"],
        )
        return fallback

    level = (
        session.query(CauldronLevel)
        .filter(CauldronLevel.cauldron_id == cauldron.id)
        .order_by(CauldronLevel.observed_at.desc())
        .first()
    )
    if not level or not level.observed_at:
        fallback = _fallback_forecast(payload.cauldron_id)
        queries.log_agent_trace(
            session,
            agent="nemotron",
            action="forecast",
            input_payload=payload.model_dump(),
            output_payload=fallback.model_dump(),
            tags=["forecast", "fallback"],
        )
        return fallback

    history_rows = (
        session.query(CauldronLevel)
        .filter(CauldronLevel.cauldron_id == cauldron.id)
        .order_by(CauldronLevel.observed_at.desc())
        .limit(360)
        .all()
    )
    history = [
        (
            row.observed_at.isoformat().replace("+00:00", "Z"),
            float(row.volume or 0.0),
        )
        for row in reversed(history_rows)
        if row.observed_at
    ]

    logic_payload = {
        "cauldron_id": cauldron.id,
        "horizon_min": payload.horizon_minutes,
        "current": {
            "ts": level.observed_at.isoformat().replace("+00:00", "Z"),
            "volume": level.volume or 0.0,
            "vmax": (cauldron.max_volume or 0.0),
            "r_fill": cauldron.fill_rate or 0.0,
        },
        "scheduled_drains": [],
        "history": history,
    }
    result = forecast_logic.run(logic_payload)
    response = ForecastResponse(
        cauldron_id=cauldron.id,
        overflow_eta=result.get("overflow_eta"),
        series=[ForecastPoint(ts=ts, volume=vol) for ts, vol in result.get("series", [])],
    )
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="forecast",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["forecast"],
    )
    return response
