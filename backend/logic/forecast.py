from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta

def run(input_json: Dict) -> Dict:
    """
    input: { "cauldron_id":"C3", "horizon_min":240,
             "current":{"ts":"...Z","volume":480.0,"vmax":600.0,"r_fill":0.9},
             "scheduled_drains":[] }
    """
    H=int(input_json.get("horizon_min",240))
    cur=input_json["current"]
    vmax=float(cur["vmax"]); v=float(cur["volume"]); r=float(cur["r_fill"])
    t0=datetime.fromisoformat(cur["ts"].replace("Z","+00:00"))
    drains=input_json.get("scheduled_drains",[])

    series: List[Tuple[str,float]]=[]
    overflow: Optional[str]=None
    for m in range(H+1):
        t=t0+timedelta(minutes=m)
        net=r
        for d in drains:
            dt=datetime.fromisoformat(d["ts"].replace("Z","+00:00"))
            dur=int(d.get("minutes",0))
            if 0 <= (t-dt).total_seconds()/60 < dur:
                net += float(d.get("rate",0.0))  # negative during drain
        v=max(0.0, min(vmax, v+net))
        iso=t.isoformat().replace("+00:00","Z")
        series.append([iso, round(v,2)])
        if overflow is None and abs(v - vmax) < 1e-6:
            overflow=iso
    return {"overflow_eta":overflow,"series":series}
