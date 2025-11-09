# backend/core/seed.py

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Iterable, List, Optional

import requests

from .db import init_db, session_scope
from .models import NetworkRoute
from .queries import (
    build_state_overview,
    record_levels,
    upsert_cauldron,
    upsert_ticket,
)

logger = logging.getLogger(__name__)


class EOGSeeder:
    """
    Importer that pulls data from the EOG hack API and seeds the local DB.

    Endpoints handled (shape-flexible):
      - /Information/cauldrons -> list[cauldron]
      - /Data                  -> {items:[{cauldronId, levels[]}, ...]} | list[...]
      - /Tickets               -> list[ticket] | {transport_tickets:[...]} | {data:{transport_tickets:[...]}} | etc.
      - /Information/network   -> list[edge] | {edges:[...]}
    """

    def __init__(self, *, api_base: Optional[str] = None, api_key: Optional[str] = None) -> None:
        self.api_base = (api_base or os.getenv("EOG_API_BASE") or "https://hackutd2025.eog.systems/api").rstrip("/")
        self.api_key = api_key or os.getenv("EOG_API_KEY")

        self.http = requests.Session()
        if self.api_key:
            self.http.headers.update({"Authorization": f"Bearer {self.api_key}"})

    # ----------------------------
    # Public
    # ----------------------------
    def seed(self, *, include_network: bool = True) -> Dict[str, Any]:
        counts = {"cauldrons": 0, "levels": 0, "tickets": 0, "network": 0}

        with session_scope() as session:
            # --- Cauldrons ---
            cauldron_payload = self._fetch_json("/Information/cauldrons") or []
            if isinstance(cauldron_payload, list):
                for payload in cauldron_payload:
                    upsert_cauldron(session, payload)
                counts["cauldrons"] = len(cauldron_payload)
            else:
                logger.warning("Unexpected cauldron payload (%s)", type(cauldron_payload).__name__)

            # --- Levels / history ---
            level_payload = self._fetch_json("/Data")
            items: Iterable[Dict[str, Any]]
            if isinstance(level_payload, dict) and "items" in level_payload:
                items = level_payload["items"]
            elif isinstance(level_payload, list):
                items = level_payload
            else:
                items = []

            for item in items:
                cid = str(item.get("cauldronId") or item.get("cauldron_id") or item.get("id"))
                # accept a few common field aliases
                rows = (
                    item.get("levels")
                    or item.get("history")
                    or item.get("measurements")
                    or [item]
                )
                counts["levels"] += record_levels(session, cid, rows)

            # --- Tickets (handle wrapped shapes + normalize for unique ticket_code) ---
            raw_tickets = self._tickets_as_list(self._fetch_json("/Tickets") or {})
            norm_tickets: List[Dict[str, Any]] = []
            for t in raw_tickets:
                nt = self._normalize_ticket(t)
                if nt is not None:
                    norm_tickets.append(nt)

            for payload in norm_tickets:
                upsert_ticket(session, payload)
            counts["tickets"] = len(norm_tickets)

            # --- Network (edges) ---
            if include_network:
                network_payload = self._fetch_json("/Information/network")
                routes_list: List[Dict[str, Any]]
                if isinstance(network_payload, dict) and "edges" in network_payload:
                    routes_list = list(network_payload["edges"])
                elif isinstance(network_payload, list):
                    routes_list = list(network_payload)
                else:
                    routes_list = []

                for idx, edge in enumerate(routes_list, start=1):
                    session.add(
                        NetworkRoute(
                            edge_id=str(edge.get("id") or idx),
                            origin=edge.get("source") or edge.get("origin"),
                            destination=edge.get("target") or edge.get("destination"),
                            distance_km=_safe_float(edge.get("distance") or edge.get("distanceKm")),
                            extra=edge,
                        )
                    )
                counts["network"] = len(routes_list)

            # --- Aggregated overview for the dashboard ---
            counts["overview"] = build_state_overview(session)

            return counts

    # ----------------------------
    # Helpers
    # ----------------------------
    def _fetch_json(self, path: str) -> Any:
        url = f"{self.api_base}{path}"
        try:
            resp = self.http.get(url, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch %s: %s", url, exc)
            return None
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON from %s: %s", url, exc)
            return None

    def _tickets_as_list(self, payload: Any) -> List[Dict[str, Any]]:
        """
        Accepts multiple shapes for /Tickets, returning a plain list of ticket dicts.
        Known shapes seen in the wild:
          - list[ {...} ]
          - { "transport_tickets": [ {...} ] }
          - { "tickets": [ {...} ] }
          - { "items": [ {...} ] }
          - { "data": { "transport_tickets": [ {...} ] } }
          - { "metadata": {...}, "transport_tickets": [ {...} ] }
        """
        if isinstance(payload, list):
            return payload

        if isinstance(payload, dict):
            # direct keys
            for k in ("transport_tickets", "tickets", "items", "rows", "data"):
                if k in payload:
                    if isinstance(payload[k], list):
                        return payload[k]
                    if isinstance(payload[k], dict):
                        # nested under data: {...}
                        for kk in ("transport_tickets", "tickets", "items", "rows"):
                            v = payload[k].get(kk)
                            if isinstance(v, list):
                                return v
                        # if it's some other dict shape, keep scanning below
                        # and ultimately fall through to empty list
            # nothing matched
            return []

        # unrecognized type
        return []

    def _normalize_ticket(self, t: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Ensure there's a unique 'ticket_code' before upserting to avoid
        UNIQUE(ticket_code) collisions when upstream omits it.
        We preserve the original payload, just making sure one of these
        keys exists (in priority order): ticket_code, ticket_id, id.
        """
        if not isinstance(t, dict):
            return None

        # Already provided?
        code = t.get("ticket_code")
        if not code:
            # Try common alternatives
            code = t.get("ticket_id") or t.get("id")

        # If still missing, synthesize something stable from obvious fields
        if not code:
            date_part = str(t.get("date") or t.get("scheduled_for") or "")
            cauldron_part = str(t.get("cauldrocann_id") or t.get("cauldronId") or "")
            # Final fallback (still deterministic-ish per object identity)
            code = f"GEN_{cauldron_part}_{date_part}_{abs(hash(json.dumps(t, sort_keys=True)))%1_000_000}"

        # Write it back so upsert_ticket() can see it
        t["ticket_code"] = str(code)

        # Normalize a few other common aliases so the upsert can map cleanly.
        # (If upsert_ticket already handles these, this is harmless.)
        if "cauldron_id" not in t and "cauldronId" in t:
            t["cauldron_id"] = t["cauldronId"]
        if "volume" not in t and "amount_collected" in t:
            t["volume"] = t["amount_collected"]
        if "route_id" not in t and "courier_id" in t:
            t["route_id"] = t["courier_id"]
        if "scheduled_for" not in t and "date" in t:
            t["scheduled_for"] = t["date"]

        return t


def run_seed(include_network: bool = True) -> Dict[str, Any]:
    """
    Entry point used by `python -m backend.core.seed`.
    Creates tables (SQLite by default) and then seeds from the EOG API.
    """
    init_db()
    seeder = EOGSeeder()
    return seeder.seed(include_network=include_network)


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    stats = run_seed(include_network=True)
    print(json.dumps(stats, indent=2, default=str))