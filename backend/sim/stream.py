"""Quick mock data generator for local testing."""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from backend.core.db import init_db, session_scope
from backend.core.models import Cauldron, CauldronLevel, Ticket


def seed_mock_data(num_cauldrons: int = 3) -> None:
    init_db()
    with session_scope() as session:
        for idx in range(1, num_cauldrons + 1):
            cid = f"SIM-{idx}"
            cauldron = session.get(Cauldron, cid)
            if not cauldron:
                cauldron = Cauldron(
                    id=cid,
                    name=f"Sim Cauldron #{idx}",
                    location="Demo Yard",
                    max_volume=1000 + idx * 250,
                    fill_rate=25 + idx * 5,
                    extra={"simulated": True},
                )
                session.add(cauldron)

            base = random.uniform(40, 80)
            for sample_idx in range(6):
                percent = max(0.0, min(100.0, base + random.uniform(-5, 5)))
                level = CauldronLevel(
                    cauldron_id=cid,
                    observed_at=datetime.utcnow() - timedelta(hours=sample_idx),
                    fill_percent=percent,
                    volume=percent * (cauldron.max_volume or 1000) / 100,
                    raw_payload={"simulated": True},
                )
                session.add(level)

            ticket = Ticket(
                ticket_code=f"SIM-TKT-{idx}",
                cauldron_id=cid,
                volume=150 + idx * 20,
                status="scheduled",
                extra={"simulated": True},
            )
            session.add(ticket)


if __name__ == "__main__":
    seed_mock_data()
