# backend/logic/demo.py
# works directly:  python backend/logic/demo.py

import os, sys, json
from typing import Optional, Dict, Any, List

# ensure imports work when called by uvicorn
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from logic.detect import run as detect_run
from logic.match import run as match_run
from logic.audit import run as audit_run
from logic.forecast import run as forecast_run

# ===== Demo data =====
RAW_CAULDRONS = [
    {"id": "C1", "name": "Glint",   "maxVolume": 500.0, "fillRate": 0.6},
    {"id": "C3", "name": "Flicker", "maxVolume": 600.0, "fillRate": 0.9},
]
RAW_LEVELS = [
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:00:00Z", "volume": 480.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:01:00Z", "volume": 479.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:02:00Z", "volume": 475.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:03:00Z", "volume": 468.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:04:00Z", "volume": 465.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:05:00Z", "volume": 462.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:06:00Z", "volume": 460.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:07:00Z", "volume": 459.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:08:00Z", "volume": 459.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:09:00Z", "volume": 460.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:10:00Z", "volume": 461.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:11:00Z", "volume": 462.0},
    {"cauldronId": "C3", "timestamp": "2025-11-07T10:12:00Z", "volume": 463.0},
]
RAW_TICKETS = [
   {"id": "T95", "date": "2025-11-07", "volume": 10.0, "cauldronId": None}
]
DATE = "2025-11-07"

# --- helpers (optional fixture loader for playback) ---
FIX_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
def load_fixture_for_date(date_str: Optional[str]) -> Optional[Dict[str, Any]]:
    if not date_str:
        return None
    # map any requested date to one of your JSON fixtures if you want
    path = os.path.join(FIX_DIR, "day_over_report.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None

def _series_payload(level_rows: List[Dict[str, Any]], r_fill: float) -> Dict[str, Any]:
    return {
        "date": DATE,
        "series": [{
            "cauldron_id": "C3",
            "r_fill": r_fill,
            "points": [[row["timestamp"], row["volume"]] for row in level_rows],
        }],
    }

def run_demo(mode: str = "live", date: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns a JSON-able dict used by the frontend:
      { cauldrons, network, drain_events, matches, findings, forecast, trace, date }
    """
    # Use your demo arrays by default; allow swapping via a fixture when playback is requested
    meta = {c["id"]: c for c in RAW_CAULDRONS}
    levels = RAW_LEVELS
    tickets = RAW_TICKETS
    if mode == "playback":
        fx = load_fixture_for_date(date)
        if fx:
            # expect fixture to contain "cauldrons","levels","tickets"
            meta = {c["id"]: c for c in fx.get("cauldrons", RAW_CAULDRONS)}
            levels = fx.get("levels", RAW_LEVELS)
            tickets = fx.get("tickets", RAW_TICKETS)

    c3_fill = float(meta["C3"]["fillRate"])
    det = detect_run(_series_payload(levels, c3_fill))

    tickets_payload = [
        {"id": t["id"], "volume": float(t["volume"]), "cauldron_id": t.get("cauldronId")}
        for t in tickets if t["date"] == DATE
    ]
    mat = match_run({
        "date": DATE,
        "tickets": tickets_payload,
        "drain_events": det["drain_events"],
    })

    aud = audit_run({
        "date": DATE,
        **mat,
        "drain_events": det["drain_events"],
    })

    fc = forecast_run({
        "cauldron_id": "C3",
        "horizon_min": 240,
        "current": {
            "ts": "2025-11-07T11:00:00Z",
            "volume": levels[-1]["volume"],
            "vmax": float(meta["C3"]["maxVolume"]),
            "r_fill": c3_fill,
        },
        "scheduled_drains": [],
    })

    # minimal nodes/links so the map has something to draw
    cauldrons = [
        {"id":"C1","vmax": meta["C1"]["maxVolume"], "last_volume": 320, "x": 22, "y": 68},
        {"id":"C2","vmax": 600, "last_volume": 325, "x": 38, "y": 45},  # optional
        {"id":"C3","vmax": meta["C3"]["maxVolume"], "last_volume": levels[-1]["volume"], "x": 62, "y": 24},
        {"id":"MKT","name":"Enchanted Market","x": 50, "y": 58},
    ]
    network = {"links":[
        {"source":"C1","target":"MKT"},
        {"source":"C2","target":"MKT"},
        {"source":"C3","target":"MKT"},
    ]}

    return {
        "date": date or "live",
        "cauldrons": cauldrons,
        "network": network,
        "drain_events": det["drain_events"],
        "matches": mat["matches"],
        "findings": aud["findings"],
        "forecast": fc,
        "trace": [
            {"step":1,"tool":"detect_drains","summary":f"{len(det['drain_events'])} event(s)"},
            {"step":2,"tool":"match_tickets","summary":f"{len(mat['matches'])} match(es)"},
            {"step":3,"tool":"audit_discrepancies","summary":f"{len(aud['findings'])} alert(s)"},
            {"step":4,"tool":"forecast_levels","summary":"forecast computed"},
        ],
    }

# CLI path stays for quick terminal testing
if __name__ == "__main__":
    out = run_demo("live")
    print("\n=== DETECT ===");  print({"drain_events": out["drain_events"]})
    print("\n=== MATCH ===");   print({"matches": out["matches"]})
    print("\n=== AUDIT ===");   print({"findings": out["findings"]})
    print("\n=== FORECAST ===");print(out["forecast"])

# backend/logic/demo.py
import time
# from .detect import run as detect_run
# from .match import run as match_run
# from .audit import run as audit_run
# from .forecast import run as forecast_run

from datetime import datetime

DATE = "2025-11-07"  # original demo day

def _shift_date_iso(ts: str, target_date: str) -> str:
    # ts like '2025-11-07T10:02:00Z' -> 'YYYY-MM-DDT10:02:00Z' for target_date
    return f"{target_date}{ts[10:]}" if len(ts) >= 11 else ts

def run_demo(mode: str = "live", date: str | None = None):
    target = date or DATE

    # ---- 1) build a level series for either LIVE or any PLAYBACK date ----
    if mode == "playback" and target != DATE:
        shifted_levels = [
            {**row, "timestamp": _shift_date_iso(row["timestamp"], target)}
            for row in RAW_LEVELS
        ]
    else:
        shifted_levels = RAW_LEVELS

    meta = {c["id"]: c for c in RAW_CAULDRONS}
    c3_fill = float(meta["C3"]["fillRate"])

    series_payload = {
        "date": target if mode == "playback" else DATE,
        "series": [
            {
                "cauldron_id": "C3",
                "r_fill": c3_fill,
                "points": [[row["timestamp"], row["volume"]] for row in shifted_levels],
            }
        ],
    }

    det = detect_run(series_payload)

    # ---- 2) tickets: shift the ticket date so matching still works on any day ----
    shifted_tickets = [
        {**t, "date": target}  # same ticket id/volume, different date so it matches today's drains
        for t in RAW_TICKETS
    ]
    tickets_payload = [
        {"id": t["id"], "volume": float(t["volume"]), "cauldron_id": t.get("cauldronId")}
        for t in shifted_tickets
        if t["date"] == target
    ]

    mat = match_run({
        "date": target,
        "tickets": tickets_payload,
        "drain_events": det["drain_events"],
    })

    aud = audit_run({
        "date": target,
        **mat,
        "drain_events": det["drain_events"],
    })

    fc = forecast_run({
        "cauldron_id": "C3",
        "horizon_min": 240,
        "current": {
            "ts": shifted_levels[-1]["timestamp"],
            "volume": shifted_levels[-1]["volume"],
            "vmax": float(meta["C3"]["maxVolume"]),
            "r_fill": c3_fill,
        },
        "scheduled_drains": [],
    })

    return {
        "date": "live" if mode == "live" else target,
        "stamp": datetime.utcnow().strftime("%H:%M:%S"),
        "cauldrons": [
            {"id": c["id"], "vmax": c["maxVolume"],
             "last_volume": (shifted_levels[-1]["volume"] if c["id"] == "C3" else 235.0)}
            for c in RAW_CAULDRONS
        ],
        "network": {
            "nodes": [{"id": "C1"}, {"id": "C2"}, {"id": "C3"}, {"id": "MKT", "name": "Enchanted Market"}],
            "links": [{"source":"C1","target":"MKT"},{"source":"C2","target":"MKT"},{"source":"C3","target":"MKT"}],
        },
        "drain_events": det["drain_events"],
        "matches": mat["matches"],
        "findings": aud["findings"],
        "forecast": { "C3": {"overflow_eta": fc.get("overflow_eta"), "series": fc.get("series", [])} },
        "trace": [
            {"step":"detect_drains","summary":f"{len(det['drain_events'])} event on C3"},
            {"step":"match_tickets","summary":f"{len(mat['matches'])} match, Δ={abs(mat['matches'][0]['diff_volume']) if mat['matches'] else 0}"},
        ],
    }

# keep this so `python backend/logic/demo.py` still prints the sections
if __name__ == "__main__":
    from pprint import pprint
    out = run_demo()
    pprint(out)
