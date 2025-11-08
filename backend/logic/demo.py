# Run this from the repo root or from backend/logic with:
#   python backend/logic/demo.py
#
# It exercises Person B's logic end-to-end using inline sample data.
# Swap RAW_* with real API samples later (Person A can pipe those in).

from adapters import adapt_levels_for_date, adapt_tickets_for_date
from detect import run as detect_run
from match import run as match_run
from audit import run as audit_run
from forecast import run as forecast_run


# ---- Inline sample data (replace with real /api responses when you have them) ----
RAW_CAULDRONS = [
  {"id":"C1","name":"Glint","maxVolume":500.0,"fillRate":0.6},
  {"id":"C3","name":"Flicker","maxVolume":600.0,"fillRate":0.9}
]
RAW_LEVELS = [
  {"cauldronId":"C3","timestamp":"2025-11-07T10:00:00Z","volume":480.0},
  {"cauldronId":"C3","timestamp":"2025-11-07T10:01:00Z","volume":479.0},
  {"cauldronId":"C3","timestamp":"2025-11-07T10:02:00Z","volume":475.0},
  {"cauldronId":"C3","timestamp":"2025-11-07T10:03:00Z","volume":468.0},
  {"cauldronId":"C3","timestamp":"2025-11-07T10:10:00Z","volume":460.0},
  {"cauldronId":"C3","timestamp":"2025-11-07T10:11:00Z","volume":461.0},
  {"cauldronId":"C3","timestamp":"2025-11-07T10:12:00Z","volume":462.0}
]
RAW_TICKETS = [
  {"id":"T95","date":"2025-11-07","volume":95.0,"cauldronId":None}
]
DATE = "2025-11-07"
# ---------------------------------------------------------------------------------

def main():
    # Build detection payload from RAW_LEVELS + cauldron metadata
    series_by_cid = adapt_levels_for_date(RAW_LEVELS, DATE)
    meta = {c["id"]: c for c in RAW_CAULDRONS}
    series_payload = {
        "date": DATE,
        "series": [
            {
                "cauldron_id": cid,
                "r_fill": float(meta.get(cid, {}).get("fillRate", meta.get(cid, {}).get("r_fill", 0.0))),
                "points": pts
            }
            for cid, pts in series_by_cid.items()
        ]
    }

    # 1) Detect drain events
    det = detect_run(series_payload)

    # 2) Match tickets to drains
    mat = match_run({
        "date": DATE,
        "tickets": adapt_tickets_for_date(RAW_TICKETS, DATE),
        "drain_events": det["drain_events"]
    })

    # 3) Audit discrepancies
    aud = audit_run({
        "date": DATE,
        **mat,
        "drain_events": det["drain_events"]
    })

    # 4) Forecast overflow for one cauldron (C3)
    fc = forecast_run({
        "cauldron_id": "C3",
        "horizon_min": 240,
        "current": {
            "ts":"2025-11-07T11:00:00Z",
            "volume": 480.0,
            "vmax": float(meta["C3"]["maxVolume"]),
            "r_fill": float(meta["C3"]["fillRate"])
        },
        "scheduled_drains":[]
    })

    # Pretty print results
    print("\n=== DETECT ===")
    print(det)
    print("\n=== MATCH ===")
    print(mat)
    print("\n=== AUDIT ===")
    print(aud)
    print("\n=== FORECAST ===")
    print({"overflow_eta": fc["overflow_eta"], "last_point": fc["series"][-1]})

if __name__ == "__main__":
    main()
