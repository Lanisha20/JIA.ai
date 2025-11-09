import { Finding } from "../types";

export default function AlertsPanel({ findings }: { findings: Finding[] }) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-gold mb-3">Discrepancy Alerts</h3>
      <div className="space-y-3">
        {findings.length === 0 && <div className="text-sm text-white/70">No discrepancies detected.</div>}
        {findings.map((f, i) => (
          <div key={i} className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
            <div>
              <div className="font-medium capitalize">{f.type.replaceAll("_", " ")}</div>
              {f.reason && <div className="text-xs text-white/60 mt-1">{f.reason}</div>}
            </div>
            <span className={`badge ${/over|under|unlogged/i.test(f.type) ? "badge-warn" : "badge-verify"}`}>
              {/over|under|unlogged/i.test(f.type) ? "suspicious" : "verified"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
