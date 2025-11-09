"""Scripts that pull upstream EOG data into the local database."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Iterable, List, Optional

import requests
from sqlalchemy.orm import Session

from .db import init_db, session_scope
from .models import NetworkRoute
from .queries import build_state_overview, record_levels, upsert_cauldron, upsert_ticket

logger = logging.getLogger(__name__)


class EOGSeeder:
    """Helper that mirrors the remote API into our SQLite store."""

    def __init__(
        self,
        session: Session,
        *,
        api_base: str | None = None,
        api_key: Optional[str] = None,
    ) -> None:
        self.session = session
        self.api_base = (api_base or os.getenv("EOG_API_BASE") or "https://hackutd2025.eog.systems/api").rstrip(
            "/"
        )
        self.api_key = api_key or os.getenv("EOG_API_KEY")
        self.http = requests.Session()
        if self.api_key:
            self.http.headers.update({"Authorization": f"Bearer {self.api_key}"})

    # ---------------------------- public API ----------------------------

    def seed_all(self, *, include_network: bool = True) -> Dict[str, Any]:
        logger.info("Fetching source data from %s", self.api_base)
        counts = {
            "cauldrons": self._seed_cauldrons(),
            "levels": self._seed_levels(),
            "tickets": self._seed_tickets(),
            "network": self._seed_network() if include_network else 0,
        }
        self.session.commit()
        counts["overview"] = build_state_overview(self.session)
        return counts

    # ----------------------------- seeders -----------------------------

    def _seed_cauldrons(self) -> int:
        data = self._fetch_json("/Information/cauldrons") or []
        if not isinstance(data, list):
            logger.warning("Unexpected cauldron payload: %s", data)
            return 0
        for payload in data:
            upsert_cauldron(self.session, payload)
        return len(data)

    def _seed_levels(self) -> int:
        data = self._fetch_json("/Data")
        if not data:
            return 0

        if isinstance(data, dict) and "items" in data:
            items = data["items"]
        else:
            items = data if isinstance(data, list) else []

        total = 0
        for item in items:
            cauldron_id = str(item.get("cauldronId") or item.get("cauldron_id") or item.get("id"))
            levels = (
                item.get("levels")
                or item.get("history")
                or item.get("measurements")
                or ([item] if "timestamp" in item else [])
            )
            total += record_levels(self.session, cauldron_id, levels)
        return total

    def _seed_tickets(self) -> int:
        data = self._fetch_json("/Tickets") or []
        if not isinstance(data, list):
            logger.warning("Unexpected ticket payload: %s", data)
            return 0
        for payload in data:
            upsert_ticket(self.session, payload)
        return len(data)

    def _seed_network(self) -> int:
        data = self._fetch_json("/Information/network")
        if not data:
            return 0
        routes: Iterable[Dict[str, Any]]
        if isinstance(data, dict) and "edges" in data:
            routes = data["edges"]
        elif isinstance(data, list):
            routes = data
        else:
            logger.warning("Unexpected network payload: %s", data)
            return 0

        count = 0
        for edge in routes:
            route = NetworkRoute(
                edge_id=str(edge.get("id") or edge.get("edgeId") or count + 1),
                origin=edge.get("source") or edge.get("origin"),
                destination=edge.get("target") or edge.get("destination"),
                distance_km=_safe_float(edge.get("distance") or edge.get("distanceKm")),
                extra=edge,
            )
            self.session.add(route)
            count += 1
        return count

    # ----------------------------- helpers -----------------------------

    def _fetch_json(self, path: str) -> Any:
        url = f"{self.api_base}{path}"
        try:
            response = self.http.get(url, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch %s: %s", url, exc)
            return None
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON from %s: %s", url, exc)
            return None


def run_seed(include_network: bool = True) -> Dict[str, Any]:
    init_db()
    with session_scope() as session:
        seeder = EOGSeeder(session)
        return seeder.seed_all(include_network=include_network)


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
