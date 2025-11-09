# backend/logic/forecast.py
from __future__ import annotations
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta, timezone
import math
import random

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(tzinfo=timezone.utc).isoformat().replace("+00:00","Z")

def _learn_slope(history: List[Tuple[str, float]], fallback_per_min: float) -> float:
    """
    Simple linear regression slope (units of volume per minute).
    If not enough history, fall back to r_fill.
    """
    if not history or len(history) < 3:
        return fallback_per_min
    # normalize x to minutes from start to reduce floating error
    t0 = datetime.fromisoformat(history[0][0].replace("Z","+00:00"))
    xs, ys = [], []
    for ts, v in history:
        t = datetime.fromisoformat(ts.replace("Z","+00:00"))
        xs.append((t - t0).total_seconds() / 60.0)
        ys.append(float(v))
    n = float(len(xs))
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs) or 1.0
    slope = num / den  # volume per minute
    # clamp to something sane so noise can't explode
    return max(-8.0, min(8.0, slope)) if math.isfinite(slope) else fallback_per_min

def run(input_json: Dict) -> Dict:
    """
    Input:
      {
        "cauldron_id": "C3",
        "horizon_min": 240,
        "current": { "ts":"...Z", "volume": 480.0, "vmax": 600.0, "r_fill": 0.9 },
        "scheduled_drains": [ { "ts":"...Z", "minutes": 20, "rate": -3.0 } ],
        "history": [ ["...Z", 470.0], ... ],     # optional, improves accuracy
        "noise_sigma": 0.25                       # optional, default ~0.25
      }
    Returns:
      {
        "now_ts": "...Z",
        "overflow_eta": "...Z" | null,
        "series": [ ["...Z", 463.0], ... ]        # minute resolution, includes history+future
      }
    """
    H = int(input_json.get("horizon_min", 240))
    cur = input_json["current"]
    vmax = float(cur["vmax"])
    v0   = float(cur["volume"])
    r    = float(cur.get("r_fill", 0.0))  # baseline per-minute change
    now  = datetime.fromisoformat(cur["ts"].replace("Z","+00:00")).astimezone(timezone.utc)
    drains = input_json.get("scheduled_drains", [])
    history = input_json.get("history", [])
    sigma = float(input_json.get("noise_sigma", 0.25))

    # If history exists, learn a better slope; blend with r for stability.
    learned = _learn_slope(history, r)
    slope_per_min = 0.6 * learned + 0.4 * r

    series: List[Tuple[str, float]] = []

    # Stitch: include recent history (as-is), then simulate from "now" forward.
    if history:
        # Ensure history is ordered and trimmed to last 180 min to keep payload small.
        hist_sorted = sorted(history, key=lambda p: p[0])[-180:]
        series.extend((ts, float(v)) for ts, v in hist_sorted)

    # Ensure the last value equals current (align UI & server)
    last_val = v0
    series.append((_iso(now), round(last_val, 2)))

    overflow: Optional[str] = None

    for m in range(1, H + 1):
        t = now + timedelta(minutes=m)
        net = slope_per_min

        # Apply any scheduled drains (negative rate during window)
        for d in drains:
            dt = datetime.fromisoformat(d["ts"].replace("Z","+00:00")).astimezone(timezone.utc)
            dur = int(d.get("minutes", 0))
            if 0 <= (t - dt).total_seconds() / 60.0 < dur:
                net += float(d.get("rate", 0.0))

        # add small random noise to feel organic
        last_val = last_val + net + random.gauss(0.0, sigma)
        last_val = max(0.0, min(vmax, last_val))

        ts = _iso(t)
        series.append((ts, round(last_val, 2)))

        if overflow is None and abs(last_val - vmax) < 1e-6:
            overflow = ts

    return {
        "now_ts": _iso(now),
        "overflow_eta": overflow,
        "series": series
    }
