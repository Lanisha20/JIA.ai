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
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gold">Agent Actions</h3>
        <button onClick={onRefresh} className="badge badge-verify hover:bg-[rgba(244,196,113,0.25)] transition">
          Refresh data
        </button>
      </div>

      <p className="text-sm text-white/70 leading-snug">
        Kick off Nemotron tools directly from the UI to update logs, discrepancies, and forecasts.
      </p>

      <div className="grid gap-4">
        {actions.map((action) => (
          <ActionCard
            key={action.key}
            title={action.title}
            desc={action.desc}
            status={status[action.key] ?? "idle"}
            onRun={action.onRun}
          />
        ))}
      </div>
    </div>
  );
}

type ActionCardProps = {
  title: string;
  desc: string;
  status: ActionState;
  onRun: () => void;
};

function ActionCard({ title, desc, status, onRun }: ActionCardProps) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-[rgba(80,70,120,0.35)] to-[rgba(30,20,60,0.25)] border border-white/10 hover:border-white/20 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h4 className="text-white font-semibold text-sm mb-1 leading-tight">{title}</h4>
            <p className="text-xs text-white/60 leading-snug">{desc}</p>
          </div>
          <span className={`${statusBadge[status]} text-[10px] uppercase tracking-[0.3em]`}>
            {statusCopy[status]}
          </span>
        </div>
        <button
          className={`btn px-3 py-1 text-xs shrink-0 ${status === "running" ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={onRun}
          disabled={status === "running"}
        >
          {statusLabel[status]}
        </button>
      </div>
    </div>
  );
}
