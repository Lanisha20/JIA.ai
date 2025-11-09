"""Audit findings endpoint."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.core.models import DrainEvent, MatchRecord
from backend.logic import audit as audit_logic

router = APIRouter()


class AuditResponse(BaseModel):
    findings: List[dict]


@router.post("/audit", response_model=AuditResponse)
def run_audit(session: Session = Depends(get_session)) -> AuditResponse:
    since = datetime.utcnow() - timedelta(days=7)
    drains = (
        session.query(DrainEvent)
        .filter(DrainEvent.detected_at >= since)
        .order_by(DrainEvent.detected_at)
        .all()
    )
    matches = session.query(MatchRecord).order_by(MatchRecord.created_at).all()

    payload = {
        "date": datetime.utcnow().date().isoformat(),
        "drain_events": [
            {
                "id": str(event.id),
                "cauldron_id": event.cauldron_id,
                "true_volume": float(event.estimated_loss or 0.0),
            }
            for event in drains
        ],
        "matches": [
            {
                "ticket_id": match.ticket.ticket_code if match.ticket else "unknown",
                "drain_event_id": str(match.drain_event_id) if match.drain_event_id else "unknown",
                "diff_volume": match.discrepancy or 0.0,
            }
            for match in matches
        ],
        "unmatched_tickets": [],
        "unmatched_drains": [],
    }
    result = audit_logic.run(payload)

    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="audit",
        input_payload={},
        output_payload=result,
        tags=["audit"],
    )
    return AuditResponse(findings=result.get("findings", []))
