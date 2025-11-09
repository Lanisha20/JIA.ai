"""Business logic routines that power /tools endpoints."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence

from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.models import CauldronLevel, Cauldron, MatchRecord, NetworkRoute, Ticket


def detect_ticket_anomalies(
    session: Session,
    *,
    cauldron_ids: Optional[Sequence[str]] = None,
    threshold: float = 10.0,
) -> List[Dict[str, object]]:
    """Inspect level deltas vs ticket expectations and flag gaps."""

    latest = queries.latest_levels(session)
    selected = [state for state in latest if (not cauldron_ids or state["cauldron_id"] in cauldron_ids)]
    anomalies: List[Dict[str, object]] = []

    for state in selected:
        cid = state["cauldron_id"]
        history = (
            session.query(CauldronLevel)
            .filter(CauldronLevel.cauldron_id == cid)
            .order_by(desc(CauldronLevel.observed_at))
            .limit(5)
            .all()
        )
        if len(history) < 2:
            continue
        newest, oldest = history[0], history[-1]
        latest_pct = newest.fill_percent
        oldest_pct = oldest.fill_percent
        if latest_pct is None or oldest_pct is None:
            continue
        delta = latest_pct - oldest_pct
        if abs(delta) < threshold:
            continue

        open_tickets = (
            session.query(Ticket)
            .filter(Ticket.cauldron_id == cid, Ticket.status.in_(["scheduled", "in_transit"]))
            .all()
        )

        anomalies.append(
            {
                "cauldron_id": cid,
                "issue": "rapid_change" if delta < 0 else "unexpected_fill",
                "fill_percent": latest_pct,
                "delta": delta,
                "observations": [level.observed_at.isoformat() for level in history],
                "tickets": [ticket.ticket_code for ticket in open_tickets],
                "detail": f"Fill shifted {delta:.2f}% over {len(history)} samples",
            }
        )
    return anomalies


def match_tickets(
    session: Session,
    *,
    cauldron_ids: Optional[Sequence[str]] = None,
    auto_persist: bool = True,
) -> List[Dict[str, object]]:
    """Correlate tickets to recent level deltas to surface discrepancies."""

    latest = {state["cauldron_id"]: state for state in queries.latest_levels(session)}
    tickets = (
        session.query(Ticket)
        .filter(Ticket.status.in_(["scheduled", "in_transit"]))
        .order_by(Ticket.scheduled_for.asc().nullslast())
        .all()
    )

    matches: List[Dict[str, object]] = []
    for ticket in tickets:
        if cauldron_ids and ticket.cauldron_id not in cauldron_ids:
            continue
        state = latest.get(ticket.cauldron_id or "")

        discrepancy = None
        confidence = 0.25
        if state and state.get("fill_percent") is not None:
            cauldron = session.get(Cauldron, ticket.cauldron_id) if ticket.cauldron_id else None
            expected_pct = None
            if cauldron and cauldron.max_volume and ticket.volume:
                expected_pct = (ticket.volume / cauldron.max_volume) * 100
            recent_levels = (
                session.query(CauldronLevel)
                .filter(CauldronLevel.cauldron_id == ticket.cauldron_id)
                .order_by(desc(CauldronLevel.observed_at))
                .limit(2)
                .all()
            )
            if len(recent_levels) == 2:
                discrepancy = (recent_levels[0].fill_percent or 0) - (recent_levels[1].fill_percent or 0)
            if expected_pct is not None and discrepancy is not None:
                discrepancy = expected_pct - abs(discrepancy)
                confidence = 0.75

        record = {
            "ticket_code": ticket.ticket_code,
            "cauldron_id": ticket.cauldron_id,
            "discrepancy": discrepancy,
            "confidence": confidence,
            "status": "matched" if discrepancy is not None else "needs_review",
        }

        if auto_persist and ticket.cauldron_id:
            match = queries.create_match(
                session,
                cauldron_id=ticket.cauldron_id,
                ticket_id=ticket.id,
                level_id=None,
                status=record["status"],
                discrepancy=discrepancy,
                confidence=confidence,
                metadata={"ticket": ticket.extra},
            )
            session.flush()
            record["match_id"] = match.id

        matches.append(record)
    return matches


def audit_cauldron(session: Session, *, cauldron_id: str) -> Dict[str, object]:
    cauldron = session.get(Cauldron, cauldron_id)
    if not cauldron:
        raise ValueError(f"Unknown cauldron {cauldron_id}")

    recent_levels = (
        session.query(CauldronLevel)
        .filter(CauldronLevel.cauldron_id == cauldron_id)
        .order_by(desc(CauldronLevel.observed_at))
        .limit(25)
        .all()
    )
    open_tickets = (
        session.query(Ticket)
        .filter(Ticket.cauldron_id == cauldron_id, Ticket.status != "closed")
        .order_by(Ticket.scheduled_for.asc().nullslast())
        .all()
    )
    matches = (
        session.query(MatchRecord)
        .filter(MatchRecord.cauldron_id == cauldron_id)
        .order_by(desc(MatchRecord.created_at))
        .limit(10)
        .all()
    )

    trend = None
    if len(recent_levels) >= 2:
        trend = (recent_levels[0].fill_percent or 0) - (recent_levels[-1].fill_percent or 0)

    return {
        "cauldron": {
            "id": cauldron.id,
            "name": cauldron.name,
            "location": cauldron.location,
            "max_volume": cauldron.max_volume,
        },
        "trend_percent": trend,
        "levels": [
            {
                "observed_at": level.observed_at.isoformat() if level.observed_at else None,
                "fill_percent": level.fill_percent,
            }
            for level in recent_levels
        ],
        "tickets": [
            {
                "ticket_code": ticket.ticket_code,
                "status": ticket.status,
                "volume": ticket.volume,
                "scheduled_for": ticket.scheduled_for.isoformat() if ticket.scheduled_for else None,
            }
            for ticket in open_tickets
        ],
        "matches": [
            {
                "match_id": match.id,
                "status": match.status,
                "discrepancy": match.discrepancy,
                "confidence": match.confidence,
                "created_at": match.created_at.isoformat(),
            }
            for match in matches
        ],
    }


def forecast_fill(
    session: Session,
    *,
    cauldron_ids: Optional[Sequence[str]] = None,
    horizon_hours: int = 6,
) -> List[Dict[str, object]]:
    horizons = range(1, horizon_hours + 1)
    cauldron_query = session.query(Cauldron)
    if cauldron_ids:
        cauldron_query = cauldron_query.filter(Cauldron.id.in_(cauldron_ids))
    cauldrons = cauldron_query.all()

    forecasts: List[Dict[str, object]] = []
    for cauldron in cauldrons:
        history = (
            session.query(CauldronLevel)
            .filter(CauldronLevel.cauldron_id == cauldron.id)
            .order_by(desc(CauldronLevel.observed_at))
            .limit(6)
            .all()
        )
        if not history:
            continue
        fill_values = [level.fill_percent for level in history if level.fill_percent is not None]
        if not fill_values:
            continue
        slope = 0.0
        if len(fill_values) >= 2:
            slope = (fill_values[0] - fill_values[-1]) / max(len(fill_values) - 1, 1)
        projections = []
        baseline = fill_values[0]
        for hour in horizons:
            projected = baseline + slope * hour
            projected = max(0.0, min(100.0, projected))
            projections.append({"hour": hour, "fill_percent": projected})

        forecasts.append(
            {
                "cauldron_id": cauldron.id,
                "name": cauldron.name,
                "forecast": projections,
            }
        )
    return forecasts


def shortest_route(
    session: Session,
    *,
    origin: str,
    destination: str,
) -> Dict[str, object]:
    edges = session.query(NetworkRoute).all()
    graph: Dict[str, List[NetworkRoute]] = defaultdict(list)
    for edge in edges:
        if not edge.origin or not edge.destination:
            continue
        graph[edge.origin].append(edge)

    visited = set()
    queue: List[tuple[str, List[NetworkRoute]]] = [(origin, [])]
    best_path: Optional[List[NetworkRoute]] = None

    while queue:
        node, path = queue.pop(0)
        if node in visited:
            continue
        visited.add(node)
        if node == destination:
            best_path = path
            break
        for edge in graph.get(node, []):
            queue.append((edge.destination, path + [edge]))

    if not best_path:
        return {"origin": origin, "destination": destination, "distance_km": None, "path": []}

    distance = sum(edge.distance_km or 0 for edge in best_path)
    return {
        "origin": origin,
        "destination": destination,
        "distance_km": distance,
        "path": [
            {
                "edge_id": edge.edge_id,
                "origin": edge.origin,
                "destination": edge.destination,
                "distance_km": edge.distance_km,
            }
            for edge in best_path
        ],
    }
