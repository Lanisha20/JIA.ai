import { useState } from "react";
import { API_BASE } from "../lib/api";

type ActionConfig = {
  label: string;
  description: string;
  endpoint: string;
  body: Record<string, unknown>;
  accent: "aqua" | "amber" | "lavender" | "rose" | "mint";
};

const ACTIONS: ActionConfig[] = [
  {
    label: "Detect Drain Events",
    description: "Runs the Nemotron detector over the latest telemetry to log new drain events.",
    endpoint: "/tools/detect",
    body: {},
    accent: "aqua",
  },
  {
    label: "Match Tickets",
    description: "Greedy matcher pairs ticket volumes with recent drain events.",
    endpoint: "/tools/match",
    body: {},
    accent: "lavender",
  },
  {
    label: "Planner (Detect + Match)",
    description: "Nemotron planner decides the best next steps and calls tools in order.",
    endpoint: "/planner/run",
    body: { goal: "detect anomalies and match tickets", context: {} },
    accent: "amber",
  },
  {
    label: "Audit Discrepancies",
    description: "Auditor flags under / over reports plus unmatched tickets or drains.",
    endpoint: "/tools/audit",
    body: {},
    accent: "rose",
  },
  {
    label: "Demo Anomaly",
    description: "Inject a synthetic drain event for cauldron_001 to test end‑to‑end flows.",
    endpoint: "/demo/anomaly",
    body: { cauldron_id: "cauldron_001" },
    accent: "mint",
  },
];

function ActionCard({ config, loading, onRun }: { config: ActionConfig; loading: string | null; onRun: () => void }) {
  const colors: Record<ActionConfig["accent"], string> = {
    aqua: "from-[#2EE4FF33]",
    amber: "from-[#F4C47133]",
    lavender: "from-[#A58CFF33]",
    rose: "from-[#FF7B7B33]",
    mint: "from-[#7BF5D233]",
  };
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${colors[config.accent]} to-transparent p-4 transition-transform ${loading === config.label ? "scale-[1.02] border-white/40" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="text-sm font-semibold text-white">{config.label}</h4>
        <button className={`badge ${loading === config.label ? "badge-verify" : ""}`} onClick={onRun} disabled={loading === config.label}>
          {loading === config.label ? "Running..." : "Run"}
        </button>
      </div>
      <p className="text-xs text-white/70 leading-relaxed">{config.description}</p>
    </div>
  );
}

export default function ActionsPanel({ onRefresh }: { onRefresh: () => void }) {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (action: ActionConfig) => {
    try {
      setLoading(action.label);
      const res = await fetch(`${API_BASE}${action.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body),
      });
      const payload = await res.text();
      setLog((prev) => [`${action.label}: ${res.status} ${res.statusText}`, payload, ...prev].slice(0, 8));
      onRefresh();
    } catch (error: any) {
      setLog((prev) => [`${action.label}: ${error?.message ?? "request failed"}`, ...prev].slice(0, 8));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gold">Agent Actions</h3>
          <p className="text-xs text-white/70">Run tools or a full Nemotron plan directly from the dashboard.</p>
        </div>
        <button className="badge badge-verify" onClick={onRefresh}>
          Refresh data
        </button>
      </div>

      <div className="space-y-3">
        {ACTIONS.map((action) => (
          <ActionCard key={action.label} config={action} loading={loading} onRun={() => run(action)} />
        ))}
      </div>

      <div className="mt-2 bg-black/20 rounded-2xl px-4 py-3 max-h-48 overflow-auto text-xs text-white/80 space-y-2">
        {log.length === 0 && <div>No actions yet. Use the cards above to exercise integrations.</div>}
        {log.map((entry, idx) => (
          <div key={idx} className="border-b border-white/5 pb-1 whitespace-pre-wrap break-words">
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}
