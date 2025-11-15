"""Detect drain events using the logic module."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.core.models import Cauldron, CauldronLevel, DrainEvent
from backend.logic import detect as detect_logic

router = APIRouter()


def _pick_target_cauldron(payload_ids: Optional[List[str]], cauldrons: List[Cauldron], session: Session) -> Optional[str]:
    if payload_ids:
        return payload_ids[0]
    if cauldrons:
        return cauldrons[0].id
    fallback = session.query(Cauldron.id).order_by(Cauldron.id).first()
    return fallback[0] if fallback else None


class DetectRequest(BaseModel):
    cauldron_ids: Optional[List[str]] = Field(default=None)
    minutes: int = Field(180, ge=30, le=1440)
    persist: bool = True


class DetectResponse(BaseModel):
    drain_events: List[dict]


@router.post("/detect", response_model=DetectResponse)
def run_detect(payload: DetectRequest, session: Session = Depends(get_session)) -> DetectResponse:
    cutoff = datetime.utcnow() - timedelta(minutes=payload.minutes)
    cauldron_query = session.query(Cauldron)
    if payload.cauldron_ids:
        cauldron_query = cauldron_query.filter(Cauldron.id.in_(payload.cauldron_ids))
    cauldrons = cauldron_query.order_by(Cauldron.id).all()

    series: List[dict] = []
    for cauldron in cauldrons:
        levels = (
            session.query(CauldronLevel)
            .filter(
                CauldronLevel.cauldron_id == cauldron.id,
                CauldronLevel.observed_at >= cutoff,
            )
            .order_by(CauldronLevel.observed_at)
            .all()
        )
        if not levels:
            continue
        points = [
            [lvl.observed_at.isoformat().replace("+00:00", "Z"), lvl.volume or 0.0]
            for lvl in levels
        ]
        series.append(
            {
                "cauldron_id": cauldron.id,
                "r_fill": cauldron.fill_rate or 0.0,
                "points": points,
            }
        )

    logic_payload = {"date": datetime.utcnow().date().isoformat(), "series": series}
    result = detect_logic.run(logic_payload)

    if payload.persist:
        for event in result.get("drain_events", []):
            detected_at = datetime.fromisoformat(event["t_end"].replace("Z", "+00:00"))
            drain = DrainEvent(
                cauldron_id=event["cauldron_id"],
                detected_at=detected_at,
                estimated_loss=event.get("true_volume"),
                reason="logic_detect",
                confidence=0.8,
                extra=event,
            )
            session.add(drain)

    target_id = _pick_target_cauldron(payload.cauldron_ids, cauldrons, session)
    input_payload = payload.model_dump()
    if target_id:
        context = input_payload.get("context", {})
        context["cauldron_id"] = target_id
        input_payload["context"] = context

    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="detect",
        input_payload=input_payload,
        output_payload=result,
        tags=["detect"],
    )
    return DetectResponse(drain_events=result.get("drain_events", []))
