type ActionState = "idle" | "running" | "success" | "error";

type Props = {
  onRefresh: () => void;
  onRunDetect: () => void;
  onRunMatch: () => void;
  onRunPlanner: () => void;
  onRunAudit: () => void;
  onRunForecast: () => void;
  status: Record<string, ActionState>;
};

const statusLabel: Record<ActionState, string> = {
  idle: "Run",
  running: "Running…",
  success: "Done",
  error: "Retry",
};

const statusBadge: Record<ActionState, string> = {
  idle: "badge",
  running: "badge badge-verify",
  success: "badge badge-verify",
  error: "badge badge-warn",
};

const statusCopy: Record<ActionState, string> = {
  idle: "Ready",
  running: "Executing",
  success: "Synced",
  error: "Check logs",
};

export default function ActionsPanel({
  onRefresh,
  onRunDetect,
  onRunMatch,
  onRunPlanner,
  onRunAudit,
  onRunForecast,
  status,
}: Props) {
  const actions = [
    {
      key: "detect",
      title: "Detect Drain Events",
      desc: "Run Nemotron detector over current telemetry; fills drain & log tables.",
      onRun: onRunDetect,
    },
    {
      key: "match",
      title: "Match Tickets",
      desc: "Reconcile volumes between tickets and drains to update the Logs table.",
      onRun: onRunMatch,
    },
    {
      key: "planner",
      title: "Planner (Detect + Match)",
      desc: "Let Nemotron decide ordering and call tools automatically.",
      onRun: onRunPlanner,
    },
    {
      key: "audit",
      title: "Audit Discrepancies",
      desc: "Run the auditor to refresh discrepancy alerts in the panel.",
      onRun: onRunAudit,
    },
    {
      key: "forecast",
      title: "Forecast Overflow",
      desc: "Generate a fresh capacity curve for the lead cauldron.",
      onRun: onRunForecast,
    },
  ];

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="h-subtitle">Agent Actions</h3>
        <button onClick={onRefresh} className="badge badge-verify hover:bg-[rgba(244,196,113,0.25)] transition">
          Refresh data
        </button>
      </div>
      <p className="text-sm text-white/70 leading-snug">
        Kick off Nemotron tools directly from the UI to update logs, discrepancies, and forecasts.
      </p>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 justify-center">
          {actions.slice(0, 3).map((action) => (
            <ActionButton key={action.key} action={action} state={status[action.key] ?? "idle"} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {actions.slice(3).map((action) => (
            <ActionButton key={action.key} action={action} state={status[action.key] ?? "idle"} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  action,
  state,
}: {
  action: { key: string; title: string; desc: string; onRun: () => void };
  state: ActionState;
}) {
  return (
    <div
      className={`flex flex-col items-start p-3 rounded-xl bg-black/20 border border-white/10 w-[200px] text-left hover:border-white/30 transition ${
        state === "running" ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      <span className="text-sm font-semibold text-white leading-tight">{action.title}</span>
      <span className="text-xs text-white/60 mt-1">{action.desc}</span>
      <button
        onClick={action.onRun}
        disabled={state === "running"}
        className={`mt-3 btn px-3 py-1 text-xs ${state === "running" ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {statusLabel[state] ?? "Run"}
      </button>
    </div>
  );
}
