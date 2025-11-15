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
      key: "planner",
      title: "Planner",
      desc: "",
      onRun: onRunPlanner,
      accent: "primary",
    },
    {
      key: "match",
      title: "Match Tickets",
      desc: "Stitch planner insights with ticket volumes to refresh the logs.",
      onRun: onRunMatch,
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
  action: { key: string; title: string; desc: string; onRun: () => void; accent?: "primary" };
  state: ActionState;
}) {
  const isPrimary = action.accent === "primary";
  const cardClass = isPrimary
    ? "w-[230px] bg-gradient-to-b from-fuchsia-600/20 via-purple-600/10 to-indigo-700/20 border border-fuchsia-400/40 shadow-lg shadow-fuchsia-500/30 flex flex-col items-center text-center justify-center gap-3"
    : "w-[200px] bg-black/20 border border-white/10";
  const buttonLabel = state === "running" ? "Running…" : statusLabel[state] ?? "Run";
  return (
    <div
      className={`flex flex-col items-start p-3 rounded-xl text-left hover:border-white/50 transition ${cardClass} ${
        state === "running" ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      <span
        className={`font-semibold text-white leading-tight ${
          isPrimary ? "h-title text-white text-3xl md:text-4xl text-center mt-4" : "text-sm text-white"
        }`}
      >
        {action.title}
      </span>
      {action.desc && <span className="text-xs text-white/60 mt-1">{action.desc}</span>}
      <button
        onClick={action.onRun}
        disabled={state === "running"}
        className={`mt-3 btn px-3 py-1 text-xs ${isPrimary ? "btn-verify text-white" : ""} ${
          state === "running" ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
