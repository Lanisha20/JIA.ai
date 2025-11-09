from typing import Dict, List, Tuple, Optional

def _closest(target: float, candidates: Dict[str,float]) -> Optional[Tuple[str,float]]:
    best=None; best_c=1e18
    for k,v in candidates.items():
        c=abs(target-v)
        if c<best_c: best=(k,v); best_c=c
    return best

def run(input_json: Dict) -> Dict:
    """
    input: { "date":"YYYY-MM-DD",
             "tickets":[{"id":"T95","volume":95.0,"cauldron_id":null},...],
             "drain_events":[{"id":"d1","cauldron_id":"C3","true_volume":120.1},...] }
    """
    tickets=input_json.get("tickets",[])
    drains=input_json.get("drain_events",[])
    by_c={}; global_map={}
    for d in drains:
        by_c.setdefault(d["cauldron_id"],{})[d["id"]]=float(d["true_volume"])
        global_map[d["id"]]=float(d["true_volume"])

    matches=[]; used=set()
    for t in tickets:
        tid=t["id"]; vol=float(t["volume"]); cid=t.get("cauldron_id")
        pool = by_c.get(cid) if cid else None
        choice=None
        if pool:
            choice=_closest(vol, {k:v for k,v in pool.items() if k not in used})
        if choice is None:
            choice=_closest(vol, {k:v for k,v in global_map.items() if k not in used})
        if choice is None: continue
        did,dvol=choice; used.add(did)
        matches.append({
            "id": f"m-{tid}-{did}",
            "ticket_id": tid,
            "drain_event_id": did,
            "status":"matched",
            "diff_volume": round(vol-dvol,2)
        })

    unmatched_t=[t["id"] for t in tickets if all(not m["id"].startswith(f"m-{t['id']}-") for m in matches)]
    unmatched_d=[d["id"] for d in drains if d["id"] not in used]
    return {"matches":matches,"unmatched_tickets":unmatched_t,"unmatched_drains":unmatched_d}
