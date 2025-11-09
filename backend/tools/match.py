"""Match tickets to drain events."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.core.models import DrainEvent, MatchRecord, Ticket
from backend.logic import match as match_logic

router = APIRouter()


class MatchRequest(BaseModel):
    days: int = Field(3, ge=1, le=14)
    persist: bool = True


class MatchResponse(BaseModel):
    matches: List[dict]
    unmatched_tickets: List[str]
    unmatched_drains: List[str]


@router.post("/match", response_model=MatchResponse)
def run_match(payload: MatchRequest, session: Session = Depends(get_session)) -> MatchResponse:
    since = datetime.utcnow() - timedelta(days=payload.days)
    drains = (
        session.query(DrainEvent)
        .filter(DrainEvent.detected_at >= since)
        .order_by(DrainEvent.detected_at)
        .all()
    )
    tickets = (
        session.query(Ticket)
        .filter(Ticket.scheduled_for.is_(None) | (Ticket.scheduled_for >= since))
        .order_by(Ticket.scheduled_for)
        .all()
    )

    drain_payload = [
        {
            "id": str(drain.id),
            "cauldron_id": drain.cauldron_id,
            "true_volume": float(drain.estimated_loss or 0.0),
        }
        for drain in drains
    ]
    ticket_payload = [
        {
            "id": ticket.ticket_code,
            "volume": float(ticket.volume or 0.0),
            "cauldron_id": ticket.cauldron_id,
        }
        for ticket in tickets
    ]
    logic_input = {
        "date": datetime.utcnow().date().isoformat(),
        "tickets": ticket_payload,
        "drain_events": drain_payload,
    }
    result = match_logic.run(logic_input)

    if payload.persist:
        session.query(MatchRecord).delete(synchronize_session=False)
        session.flush()
        for record in result.get("matches", []):
            ticket = next((t for t in tickets if t.ticket_code == record["ticket_id"]), None)
            drain = next((d for d in drains if str(d.id) == record["drain_event_id"]), None)
            queries.create_match(
                session,
                cauldron_id=drain.cauldron_id if drain else (ticket.cauldron_id if ticket else "unknown"),
                ticket_id=ticket.id if ticket else None,
                drain_event_id=drain.id if drain else None,
                status=record.get("status", "matched"),
                discrepancy=record.get("diff_volume"),
                extra=record,
            )

    response = MatchResponse(
        matches=result.get("matches", []),
        unmatched_tickets=result.get("unmatched_tickets", []),
        unmatched_drains=result.get("unmatched_drains", []),
    )

    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="match",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["match"],
    )
    return response
