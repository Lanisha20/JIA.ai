from typing import Dict, List

ABS_TOL=5.0
REL_TOL=0.06

def run(input_json: Dict) -> Dict:
    """
    input: { "date":"YYYY-MM-DD",
             "matches":[...], "unmatched_tickets":[...], "unmatched_drains":[...],
             "drain_events":[{"id":"d1","cauldron_id":"C3","true_volume":120.1},...] }
    """
    drains={d["id"]:d for d in input_json.get("drain_events",[])}
    findings: List[Dict]=[]

    for m in input_json.get("matches",[]):
        did=m["drain_event_id"]; d=drains.get(did,{})
        v_true=float(d.get("true_volume",0.0))
        diff=float(m.get("diff_volume",0.0))
        thresh=ABS_TOL + REL_TOL*max(1.0,v_true)
        if abs(diff)>thresh:
            findings.append({
                "type":"under_report" if diff<0 else "over_report",
                "cauldron_id": d.get("cauldron_id","UNKNOWN"),
                "ticket_id": m.get("ticket_id"),
                "drain_event_id": did,
                "diff_volume": round(abs(diff),2),
                "reason": f"|Δ|={abs(diff):.1f} > {ABS_TOL}+{REL_TOL}·{v_true:.1f}"
            })

    for tid in input_json.get("unmatched_tickets",[]):
        findings.append({
            "type":"unmatched_ticket","cauldron_id":"UNKNOWN",
            "ticket_id":tid,"drain_event_id":None,"diff_volume":0.0,
            "reason":"No plausible drain event"
        })
    for did in input_json.get("unmatched_drains",[]):
        cid=drains.get(did,{}).get("cauldron_id","UNKNOWN")
        findings.append({
            "type":"unlogged_drain","cauldron_id":cid,
            "ticket_id":None,"drain_event_id":did,"diff_volume":0.0,
            "reason":"Drain event without ticket"
        })
    return {"findings":findings}
