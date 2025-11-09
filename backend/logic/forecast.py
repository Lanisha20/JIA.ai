# backend/logic/forecast.py
from __future__ import annotations
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta, timezone

def _ols_slope(points: List[Tuple[float, float]]) -> float:
    """
    Simple least-squares slope (L/min) from (minute_index, volume).
    """
    n = len(points)
    if n < 2:
        return 0.0
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sxx = sum(p[0] * p[0] for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    denom = n * sxx - sx * sx
    if abs(denom) < 1e-9:
        return 0.0
    return (n * sxy - sx * sy) / denom  # ΔV / minute

def run(input_json: Dict) -> Dict:
    """
    input: {
      "cauldron_id": "C3",
      "horizon_min": 240,
      "current": {"ts":"...Z","volume":480.0,"vmax":600.0},
      "recent":   [["...Z", 460.0], ... ]   # optional recent observed points
      "scheduled_drains": [ {"ts":"...Z","minutes":15,"rate":-2.0}, ... ]
    }
    """
    H = int(input_json.get("horizon_min", 240))
    cur = input_json["current"]
    vmax = float(cur["vmax"])
    v0   = float(cur["volume"])
    now  = datetime.fromisoformat(cur["ts"].replace("Z","+00:00"))

    # Estimate natural fill slope from recent history if available
    recent = input_json.get("recent") or []
    slope = 0.0  # L/min
    if len(recent) >= 4:
        # take the last ~30–60 mins if available
        last = recent[-60:] if len(recent) > 60 else recent
        # index points by minute offset
        t0 = datetime.fromisoformat(last[0][0].replace("Z","+00:00"))
        pts = []
        for ts, vol in last:
            dt = datetime.fromisoformat(ts.replace("Z","+00:00"))
            minutes = (dt - t0).total_seconds() / 60.0
            pts.append((minutes, float(vol)))
        slope = _ols_slope(pts)
        # clamp the slope to a sane range
        slope = max(-3.0, min(3.0, slope))

    drains = input_json.get("scheduled_drains", [])

    series: List[Tuple[str, float]] = []
    overflow: Optional[str] = None
    v = v0

    for m in range(H + 1):
        t = now + timedelta(minutes=m)

        # base drift from learned slope
        dv = slope

        # apply scheduled drains (negative rates) when active
        for d in drains:
            dt = datetime.fromisoformat(d["ts"].replace("Z","+00:00"))
            dur = int(d.get("minutes", 0))
            if 0 <= (t - dt).total_seconds() / 60.0 < dur:
                dv += float(d.get("rate", 0.0))

        # add tiny random process noise to feel organic but stable
        # (pseudo noise that’s deterministic per minute to avoid jumpiness)
        noise = (((hash((int(t.timestamp()) // 60, "fx")) % 100) - 50) / 50.0) * 0.05  # ~±0.05 L/min
        dv += noise

        v = max(0.0, min(vmax, v + dv))
        iso = t.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        series.append([iso, round(v, 2)])
        if overflow is None and abs(v - vmax) < 1e-6:
            overflow = iso

    return {
        "now_ts": now.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
        "overflow_eta": overflow,
        "series": series
    }
