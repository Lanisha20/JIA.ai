"""Forecast endpoint."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

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


@router.post("/forecast", response_model=ForecastResponse)
def run_forecast(payload: ForecastRequest, session: Session = Depends(get_session)) -> ForecastResponse:
    cauldron = session.get(Cauldron, payload.cauldron_id)
    if not cauldron:
        raise HTTPException(status_code=404, detail="Unknown cauldron")

    level = (
        session.query(CauldronLevel)
        .filter(CauldronLevel.cauldron_id == cauldron.id)
        .order_by(CauldronLevel.observed_at.desc())
        .first()
    )
    if not level or not level.observed_at:
        raise HTTPException(status_code=400, detail="No telemetry available")

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
    return ForecastResponse(
        cauldron_id=cauldron.id,
        overflow_eta=result.get("overflow_eta"),
        series=[ForecastPoint(ts=ts, volume=vol) for ts, vol in result.get("series", [])],
    )
