# backend/logic/demo.py
from __future__ import annotations
import random, math
from typing import Dict, List, Tuple
from datetime import datetime, timedelta, timezone

from .detect import run as detect_run
from .match import run   as match_run
from .audit import run   as audit_run
from .forecast import run as forecast_run

def _seed_for_bucket(bucket_seconds: int = 10) -> int:
    # Change “randomness” every N seconds so refreshes feel alive but not jumpy
    now = datetime.now(tz=timezone.utc)
    return int(now.timestamp()) // bucket_seconds

def _make_recent_series(v0: float, slope: float, minutes: int, vmax: float) -> List[Tuple[str, float]]:
    """
    Build last `minutes` of 1-min samples ending at 'now' with small noise.
    """
    now = datetime.now(tz=timezone.utc)
    start = now - timedelta(minutes=minutes - 1)
    v = v0 - slope * (minutes - 1)  # rewind to start
    out: List[Tuple[str, float]] = []
    for m in range(minutes):
        t = start + timedelta(minutes=m)
        # deterministic small wobble
        wob = (math.sin((m / 7.0)) + math.cos((m / 11.0))) * 0.15
        v = max(0.0, min(vmax, v + slope + wob))
        out.append((t.isoformat().replace("+00:00", "Z"), round(v, 2)))
    return out

def run_demo(mode: str = "live", date: str | None = None) -> Dict:
    """
    Returns the full Overview payload with randomized-but-consistent numbers.
    """
    rng = random.Random(_seed_for_bucket(8))  # change every ~8s

    # --- Cauldrons ---
    cauldrons = [
        {"id": "C1", "name": "Crystal",  "vmax": 500.0},
        {"id": "C2", "name": "Moonlight","vmax": 600.0},
        {"id": "C3", "name": "Starfire", "vmax": 600.0},
    ]

    # layout hint (so your map has positions)
    layout = {
        "C1": (22, 68),
        "C2": (50, 58),
        "C3": (62, 42),
        "MKT": (50, 82),
    }

    # assign last volumes with small random drift
    for c in cauldrons:
        vmax = c["vmax"]
        base_pct = {"C1": 0.53, "C2": 0.55, "C3": 0.77}[c["id"]]
        jitter = rng.uniform(-0.02, 0.02)
        vol = max(0.0, min(vmax, vmax * (base_pct + jitter)))
        c.update({
            "last_volume": round(vol, 1),
            "x": layout[c["id"]][0],
            "y": layout[c["id"]][1]
        })

    # --- Drains (random short event on C3 about once every few refreshes) ---
    now = datetime.now(tz=timezone.utc)
    drain_events = []
    if rng.random() < 0.45:
        start = (now - timedelta(minutes=rng.randint(5, 20))).isoformat().replace("+00:00", "Z")
        drain_events.append({
            "id": f"C3-{int(now.timestamp())}",
            "cauldron_id": "C3",
            "t_start": start,
            "t_end":   (now + timedelta(minutes=rng.randint(5, 15))).isoformat().replace("+00:00", "Z"),
            "level": "over_report",
            "flags": ["ok"]
        })

    # --- Tickets (one synthetic ticket) ---
    tickets = [{"id": "T-" + str(int(now.timestamp()) % 1000), "date": now.date().isoformat(), "volume": rng.randint(5, 40)}]

    # --- Recent series for C3 (used to learn slope) ---
    c3 = next(c for c in cauldrons if c["id"] == "C3")
    vmax = float(c3["vmax"])
    v0   = float(c3["last_volume"])
    # Estimate natural slope around 0.5–1.2 L/min upward, small jitter
    slope = rng.uniform(0.4, 1.2)
    # If there’s a drain in-progress, bias slope down a bit
    if drain_events:
        slope -= rng.uniform(0.2, 0.6)

    recent = _make_recent_series(v0=v0, slope=slope, minutes=90, vmax=vmax)

    # --- Detect / Match / Audit pipeline using your existing logic ---
    series_payload = {
        "date": now.date().isoformat(),
        "series": [{"cauldron_id": "C3", "points": recent, "r_fill": slope}],
    }
    det = detect_run(series_payload)

    mat = match_run({
        "date": now.date().isoformat(),
        "tickets": [{"id": t["id"], "volume": float(t["volume"]), "cauldron_id": None} for t in tickets],
        "drain_events": det["drain_events"],
    })

    aud = audit_run({
        "date": now.date().isoformat(),
        **mat,
        "drain_events": det["drain_events"],
    })

    # --- Forecast (more accurate; learns slope from `recent`) ---
    fc = forecast_run({
        "cauldron_id": "C3",
        "horizon_min": 300,
        "current": {
            "ts": now.isoformat().replace("+00:00", "Z"),
            "volume": v0,
            "vmax": vmax
        },
        "recent": recent,
        "scheduled_drains": [
            # Convert your detected drain into a scheduled negative rate if active soon
            # Here we just project a small drain in ~30–60 minutes occasionally
            *([{
                "ts": (now + timedelta(minutes=rng.randint(30, 60))).isoformat().replace("+00:00", "Z"),
                "minutes": rng.randint(8, 15),
                "rate": -1.8
            }] if rng.random() < 0.35 else [])
        ],
    })

    # --- Findings (simple single alert based on audit) ---
    findings = []
    if aud.get("findings"):
        findings.append({
            "type": "over_report",
            "reason": "|Δ| > tol",
            "status": "suspicious",
            "cauldron": "C3"
        })

    # --- Trace (toy plan steps for the right rail) ---
    trace = [
        {"name": "detect_drains",     "summary": "1 event on C3"},
        {"name": "match_tickets",     "summary": "1 match, Δ≈97"},
        {"name": "audit_discrepancies","summary": "over_report flagged"},
        {"name": "forecast_levels",   "summary": "C3 overflow " + (fc["overflow_eta"].split("T")[1][:5] if fc.get("overflow_eta") else "—")},
    ]

    # --- Format overview ---
    overview = {
        "date": "live",
        "cauldrons": [
            {**c} for c in cauldrons
        ] + [{"id": "MKT", "name": "Market", "x": layout["MKT"][0], "y": layout["MKT"][1]}],
        "network": {
            "links": [
                {"source": "C1", "target": "MKT"},
                {"source": "C2", "target": "MKT"},
                {"source": "C3", "target": "MKT"},
            ]
        },
        "drain_events": det.get("drain_events", []),
        "matches": mat.get("matches", []),
        "findings": findings,
        "trace": trace,
        # return a mapping so UI can pick C3 or others if you add later
        "forecast": {"C3": fc}
    }
    return overview
