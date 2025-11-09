# backend/logic/demo.py
# works directly:  python demo.py

import os, sys, json
# add the parent of "logic" (the "backend" folder) to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from logic.detect import run as detect_run
from logic.match import run as match_run
from logic.audit import run as audit_run
from logic.forecast import run as forecast_run

def maybe_load_fixture():
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            raw = json.load(f)
        return raw["cauldrons"], raw["levels"], raw["tickets"]
    return None

def main():
    loaded = maybe_load_fixture()
    if loaded:
        global RAW_CAULDRONS, RAW_LEVELS, RAW_TICKETS
        RAW_CAULDRONS, RAW_LEVELS, RAW_TICKETS = loaded


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


def main():
    meta = {c["id"]: c for c in RAW_CAULDRONS}
    c3_fill = float(meta["C3"]["fillRate"])

    series_payload = {
        "date": DATE,
        "series": [
            {
                "cauldron_id": "C3",
                "r_fill": c3_fill,
                "points": [[row["timestamp"], row["volume"]] for row in RAW_LEVELS],
            }
        ],
    }

    # 1) detect
    det = detect_run(series_payload)

    # 2) match
    tickets_payload = [
        {"id": t["id"], "volume": float(t["volume"]), "cauldron_id": t.get("cauldronId")}
        for t in RAW_TICKETS
        if t["date"] == DATE
    ]
    mat = match_run({
        "date": DATE,
        "tickets": tickets_payload,
        "drain_events": det["drain_events"],
    })

    # 3) audit
    aud = audit_run({
        "date": DATE,
        **mat,
        "drain_events": det["drain_events"],
    })

    # 4) forecast
    fc = forecast_run({
        "cauldron_id": "C3",
        "horizon_min": 240,
        "current": {
            "ts": "2025-11-07T11:00:00Z",
            "volume": RAW_LEVELS[-1]["volume"],
            "vmax": float(meta["C3"]["maxVolume"]),
            "r_fill": c3_fill,
        },
        "scheduled_drains": [],
    })

    print("\n=== DETECT ===");  print(det)
    print("\n=== MATCH ===");   print(mat)
    print("\n=== AUDIT ===");   print(aud)
    print("\n=== FORECAST ===");print({"overflow_eta": fc["overflow_eta"], "last_point": fc["series"][-1]})


if __name__ == "__main__":
    main()
#testing 
