import { useState } from "react";
import { API_BASE, getOverview } from "../lib/api";

const ACTIONS = [
  {
    label: "Run Detect",
    endpoint: "/tools/detect",
    body: {},
  },
  {
    label: "Run Match",
    endpoint: "/tools/match",
    body: {},
  },
  {
    label: "Planner: Detect + Match",
    endpoint: "/planner/run",
    body: { goal: "detect anomalies and match tickets", context: {} },
  },
  {
    label: "Audit",
    endpoint: "/tools/audit",
    body: {},
  },
  {
    label: "Trigger Demo Anomaly",
    endpoint: "/demo/anomaly",
    body: { cauldron_id: "cauldron_001" },
  },
] as const;

export default function ActionsPanel({ onRefresh }: { onRefresh: () => void }) {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (action: (typeof ACTIONS)[number]) => {
    try {
      setLoading(action.label);
      const res = await fetch(`${API_BASE}${action.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body),
      });
      const text = await res.text();
      setLog((prev) => [`${action.label}: ${res.status} ${res.statusText}`, text, ...prev].slice(0, 6));
      onRefresh();
    } catch (error: any) {
      setLog((prev) => [`${action.label}: ${error?.message ?? "failed"}`, ...prev].slice(0, 6));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gold">Agent Actions</h3>
        <button className="badge badge-verify" onClick={onRefresh}>
          Refresh data
        </button>
      </div>
      <div className="space-y-3">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            className="btn w-full"
            onClick={() => run(action)}
            disabled={loading === action.label}
          >
            {loading === action.label ? "Running..." : action.label}
          </button>
        ))}
      </div>
      <div className="mt-4 bg-black/20 rounded-xl px-4 py-3 max-h-48 overflow-auto text-xs text-white/80 space-y-2">
        {log.length === 0 && <div>No actions yet. Use the buttons above to test integrations.</div>}
        {log.map((entry, idx) => (
          <div key={idx} className="border-b border-white/5 pb-1">
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}
