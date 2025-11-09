"""High level query helpers."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .models import (
    AgentTrace,
    Cauldron,
    CauldronLevel,
    DrainEvent,
    MatchRecord,
    Ticket,
)


def upsert_cauldron(session: Session, payload: Dict[str, Any]) -> Cauldron:
    cauldron_id = str(payload.get("id") or payload.get("cauldron_id"))
    if not cauldron_id:
        raise ValueError("cauldron payload missing id")

    cauldron = session.get(Cauldron, cauldron_id)
    if not cauldron:
        cauldron = Cauldron(id=cauldron_id, name=payload.get("name") or cauldron_id)
        session.add(cauldron)

    cauldron.name = payload.get("name") or cauldron.name
    cauldron.location = payload.get("location")
    cauldron.max_volume = _safe_float(payload.get("maxVolume") or payload.get("max_volume"))
    cauldron.fill_rate = _safe_float(payload.get("fillRate") or payload.get("fill_rate"))
    cauldron.extra = payload
    return cauldron


def record_levels(session: Session, cauldron_id: str, rows: Iterable[Dict[str, Any]]) -> int:
    count = 0
    for row in rows:
        observed_at = _safe_datetime(row.get("timestamp") or row.get("observed_at"))
        if not observed_at:
            continue
        level = CauldronLevel(
            cauldron_id=cauldron_id,
            observed_at=observed_at,
            volume=_safe_float(row.get("volume")),
            fill_percent=_safe_float(row.get("fill_percent")),
            payload=row,
        )
        session.add(level)
        count += 1
    return count


def upsert_ticket(session: Session, payload: Dict[str, Any]) -> Ticket:
    code = str(payload.get("ticketId") or payload.get("ticket_code") or payload.get("id"))
    ticket = session.execute(select(Ticket).where(Ticket.ticket_code == code)).scalar_one_or_none()
    if not ticket:
        ticket = Ticket(ticket_code=code)
        session.add(ticket)

    ticket.cauldron_id = payload.get("cauldronId") or payload.get("cauldron_id")
    ticket.volume = _safe_float(payload.get("amount_collected") or payload.get("volume"))
    ticket.route_id = payload.get("courier_id") or payload.get("route_id")
    ticket.status = payload.get("status") or "scheduled"
    ticket.scheduled_for = _safe_datetime(payload.get("date") or payload.get("scheduled_for"))
    ticket.extra = payload
    return ticket


def latest_levels(session: Session) -> List[Dict[str, Any]]:
    subq = (
        select(
            CauldronLevel.cauldron_id.label("cid"),
            func.max(CauldronLevel.observed_at).label("observed_at"),
        )
        .group_by(CauldronLevel.cauldron_id)
        .subquery()
    )

    rows = (
        session.query(Cauldron, CauldronLevel)
        .join(subq, Cauldron.id == subq.c.cid)
        .join(
            CauldronLevel,
            (CauldronLevel.cauldron_id == subq.c.cid)
            & (CauldronLevel.observed_at == subq.c.observed_at),
        )
        .order_by(Cauldron.id)
        .all()
    )

    result: List[Dict[str, Any]] = []
    for cauldron, level in rows:
        result.append(
            {
                "cauldron_id": cauldron.id,
                "name": cauldron.name,
                "fill_percent": level.fill_percent,
                "volume": level.volume,
                "observed_at": level.observed_at.isoformat() if level.observed_at else None,
                "max_volume": cauldron.max_volume,
                "fill_rate": cauldron.fill_rate,
                "metadata": cauldron.extra,
            }
        )
    return result


def recent_tickets(session: Session, limit: int = 50) -> List[Dict[str, Any]]:
    rows = (
        session.query(Ticket)
        .order_by(Ticket.scheduled_for.is_(None), desc(Ticket.scheduled_for), desc(Ticket.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "ticket_code": row.ticket_code,
            "cauldron_id": row.cauldron_id,
            "scheduled_for": row.scheduled_for.isoformat() if row.scheduled_for else None,
            "volume": row.volume,
            "status": row.status,
        }
        for row in rows
    ]


def recent_matches(session: Session, limit: int = 25) -> List[Dict[str, Any]]:
    rows = (
        session.query(MatchRecord, Cauldron, Ticket)
        .join(Cauldron, MatchRecord.cauldron_id == Cauldron.id)
        .outerjoin(Ticket, MatchRecord.ticket_id == Ticket.id)
        .order_by(desc(MatchRecord.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "match_id": match.id,
            "cauldron": cauldron.name,
            "cauldron_id": cauldron.id,
            "ticket": ticket.ticket_code if ticket else None,
            "status": match.status,
            "drain_event_id": match.drain_event_id,
            "discrepancy": match.discrepancy,
            "confidence": match.confidence,
            "created_at": match.created_at.isoformat(),
        }
        for match, cauldron, ticket in rows
    ]


def recent_drain_events(session: Session, limit: int = 25) -> List[Dict[str, Any]]:
    rows = (
        session.query(DrainEvent, Cauldron)
        .join(Cauldron, DrainEvent.cauldron_id == Cauldron.id)
        .order_by(desc(DrainEvent.detected_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "event_id": event.id,
            "cauldron": cauldron.name,
            "cauldron_id": cauldron.id,
            "detected_at": event.detected_at.isoformat(),
            "estimated_loss": event.estimated_loss,
            "reason": event.reason,
        }
        for event, cauldron in rows
    ]


def agent_trace(session: Session, limit: int = 50) -> List[Dict[str, Any]]:
    rows = session.query(AgentTrace).order_by(desc(AgentTrace.created_at)).limit(limit).all()
    return [
        {
            "agent": row.agent,
            "action": row.action,
            "tags": row.tags,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


def log_agent_trace(
    session: Session,
    *,
    agent: str,
    action: str,
    input_payload: Dict[str, Any],
    output_payload: Dict[str, Any],
    tags: Optional[List[str]] = None,
) -> None:
    trace = AgentTrace(
        agent=agent,
        action=action,
        input_payload=input_payload,
        output_payload=output_payload,
        tags=tags or [],
    )
    session.add(trace)


def create_match(
    session: Session,
    *,
    cauldron_id: str,
    ticket_id: Optional[int],
    drain_event_id: Optional[int],
    status: str,
    discrepancy: Optional[float] = None,
    confidence: Optional[float] = None,
    notes: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> MatchRecord:
    record = MatchRecord(
        cauldron_id=cauldron_id,
        ticket_id=ticket_id,
        drain_event_id=drain_event_id,
        status=status,
        discrepancy=discrepancy,
        confidence=confidence,
        notes=notes,
        extra=extra or {},
    )
    session.add(record)
    return record


def build_state_overview(session: Session) -> Dict[str, Any]:
    cauldron_states = latest_levels(session)
    tickets = recent_tickets(session)
    matches = recent_matches(session)
    drains = recent_drain_events(session)
    trace = agent_trace(session)

    avg_fill = None
    fills = [item["fill_percent"] for item in cauldron_states if item["fill_percent"] is not None]
    if fills:
        avg_fill = sum(fills) / len(fills)

    return {
        "cauldrons": cauldron_states,
        "tickets": tickets,
        "matches": matches,
        "drain_events": drains,
        "agent_trace": trace,
        "summary": {
            "active_cauldrons": len(cauldron_states),
            "open_tickets": len([t for t in tickets if t["status"] not in {"closed", "delivered"}]),
            "avg_fill_percent": avg_fill,
            "recent_anomalies": len(drains),
        },
    }


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None
