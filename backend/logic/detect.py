from typing import Dict, List
from datetime import datetime

# Tunables (adjust after you see real cadence)
ROLL_W = 3
SLOPE_NEG = -2.0     # L/min start
HYSTERESIS = -0.3    # end
MIN_EVENT_MIN = 5

def _parse(points):
    ts = [datetime.fromisoformat(p[0].replace("Z","+00:00")) for p in points]
    vs = [float(p[1]) for p in points]
    return ts, vs

def _roll_med(vs, w):
    if w <= 1 or len(vs) < 2: return vs[:]
    out=[]; k=w//2
    for i in range(len(vs)):
        lo=max(0,i-k); hi=min(len(vs),i+k+1); seg=vs[lo:hi]
        out.append(sorted(seg)[len(seg)//2])
    return out

def _slope(vs):  # Δ per minute (assumes ~1-min spacing)
    if len(vs)<=1: return [0.0]*len(vs)
    return [0.0] + [vs[i]-vs[i-1] for i in range(1,len(vs))]

def run(input_json: Dict) -> Dict:
    """
    input: { "date": "YYYY-MM-DD",
             "series":[{"cauldron_id":"C3","r_fill":0.9,"points":[["...Z",480.0], ...]}, ...] }
    """
    events: List[Dict] = []
    for item in input_json.get("series", []):
        cid=item["cauldron_id"]; r_fill=float(item.get("r_fill",0.0))
        pts=item.get("points",[])
        if len(pts)<3: continue

        ts,vs=_parse(pts)
        vm=_roll_med(vs,ROLL_W)
        sl=_slope(vm)

        in_evt=False; s=None; i=0
        while i<len(sl):
            if not in_evt and sl[i]<=SLOPE_NEG:
                in_evt=True; s=i
            elif in_evt and sl[i]>=HYSTERESIS:
                dur=i-s
                if dur>=MIN_EVENT_MIN:
                    t_s=ts[s]; t_e=ts[i]
                    drop=max(0.0, vm[s]-vm[i])
                    true=drop + r_fill*dur
                    events.append({
                        "id": f"{cid}-{t_s.isoformat()}-{t_e.isoformat()}",
                        "cauldron_id": cid,
                        "t_start": t_s.isoformat().replace("+00:00","Z"),
                        "t_end":   t_e.isoformat().replace("+00:00","Z"),
                        "level_drop": round(drop,2),
                        "true_volume": round(true,2),
                        "flags":"ok"
                    })
                in_evt=False; s=None
            i+=1
    return {"drain_events": events}
