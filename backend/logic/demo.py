# backend/logic/demo.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
import random

from .forecast import run as forecast_run

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(tzinfo=timezone.utc).isoformat().replace("+00:00","Z")

def _recent_history(now: datetime, v0: float, per_min: float, minutes: int, vmax: float) -> List[Tuple[str, float]]:
    """
    Synthesize ~minutes of noisy history that trends toward v0 using per_min slope.
    """
    start = now - timedelta(minutes=minutes)
    v = max(0.0, min(vmax, v0 - per_min * 2.0))  # start a bit lower so history approaches v0
    hist: List[Tuple[str, float]] = []
    for m in range(minutes + 1):
        t = start + timedelta(minutes=m)
        # small wander + trend
        v = v + per_min + random.gauss(0.0, 0.2)
        v = max(0.0, min(vmax, v))
        hist.append((_iso(t), round(v, 2)))
    # ensure last point equals v0 at "now" for a clean stitch
    hist[-1] = (_iso(now), round(v0, 2))
    return hist

def run_demo(mode: str = "live", date: str | None = None) -> Dict:
    """
    Generates a full overview payload with realistic, slightly randomized data.
    """
    rng = random.Random()
    rng.seed(int(datetime.now(timezone.utc).timestamp()) // 8)  # refreshes ~every 8s

    now = datetime.now(timezone.utc)
    date_str = "live" if mode == "live" else (date or now.date().isoformat())

    # --- Cauldrons + baseline params ---
    cauldrons_meta = [
        {"id": "C1", "name": "Crystal Cauldron", "vmax": 500.0, "r_fill": 0.45},
        {"id": "C2", "name": "Moonlight Vessel", "vmax": 550.0, "r_fill": 0.35},
        {"id": "C3", "name": "Starfire Basin",   "vmax": 600.0, "r_fill": 0.70},
    ]

    # Random-ish current volumes near the middle, but steady
    for m in cauldrons_meta:
        mid = m["vmax"] * rng.uniform(0.4, 0.8)
        m["last_volume"] = round(mid + rng.gauss(0, 4.0), 2)

    # Simple network around market node
    network = {
        "links": [
            {"source": "C1", "target": "MKT"},
            {"source": "C2", "target": "MKT"},
            {"source": "C3", "target": "MKT"},
        ]
    }

    # Optionally synthesize one drain on C3 sometimes
    drains = []
    if rng.random() < 0.4:
        drains.append({
            "cauldron_id": "C3",
            "ts": _iso(now + timedelta(minutes=30)),
            "minutes": 25,
            "rate": -4.0
        })

    # Build history + forecast per cauldron
    forecasts: Dict[str, Dict] = {}
    for m in cauldrons_meta:
        cid = m["id"]
        vmax = float(m["vmax"])
        v0   = float(m["last_volume"])
        r    = float(m["r_fill"])
        hist = _recent_history(now, v0, r, minutes=90, vmax=vmax)

        scheduled = [d for d in drains if d.get("cauldron_id") == cid]
        forecasts[cid] = forecast_run({
            "cauldron_id": cid,
            "horizon_min": 240,
            "current": {
                "ts": _iso(now),
                "volume": v0,
                "vmax": vmax,
                "r_fill": r
            },
            "scheduled_drains": scheduled,
            "history": hist[-90:],
            "noise_sigma": 0.25,
        })

    # Very lightweight “findings” demo
    findings = []
    if forecasts["C3"]["overflow_eta"]:
        findings.append({
            "type": "over_report",
            "reason": "|Δ| > tol",
            "status": "suspicious"
        })

    # Minimal drain/match/trace demo rows
    drain_events = []
    if drains:
        d = drains[0]
        drain_events.append({
            "id": f"{d['cauldron_id']}-{d['ts']}",
            "cauldron_id": d["cauldron_id"],
            "t_start": d["ts"],
            "t_end": _iso(datetime.fromisoformat(d["ts"].replace("Z","+00:00")) + timedelta(minutes=d["minutes"])),
            "level": 0,
        })

    matches = [{
        "id": "match_1",
        "ticket_id": "T150",
        "drain_event_id": drain_events[0]["id"] if drain_events else None,
        "diff_volume": rng.randint(5, 20)
    }]

    trace = [
        {"op": "detect_drains",       "summary": "1 event on C3"},
        {"op": "match_tickets",       "summary": "1 match, Δ≈97"},
        {"op": "audit_discrepancies", "summary": "over_report flagged"},
        {"op": "forecast_levels",     "summary": "C3 overflow predicted"},
    ]

    # Compose overview
    overview = {
        "date": date_str,
        "cauldrons": [
            {"id": m["id"], "vmax": m["vmax"], "last_volume": m["last_volume"],
             "x": 25 + i * 25, "y": 60}
            for i, m in enumerate(cauldrons_meta)
        ] + [{"id": "MKT", "name": "Market", "x": 50, "y": 85}],
        "network": network,
        "drain_events": drain_events,
        "matches": matches,
        "findings": findings,
        "trace": trace,
        "forecast": forecasts
    }
    return overview
