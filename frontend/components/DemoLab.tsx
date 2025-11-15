type Props = {
  onAddDrain: () => void;
  onAddAlert: () => void;
  onAddForecast: () => void;
  onClear: () => void;
  stats: {
    drains: number;
    alerts: number;
    forecastActive: boolean;
  };
};

export default function DemoLab({ onAddDrain, onAddAlert, onAddForecast, onClear, stats }: Props) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
        <h3 className="h-subtitle">Scenario Lab</h3>
          <p className="text-xs text-white/60">Inject sample drains, tickets, forecasts, and alerts.</p>
        </div>
        <span className="badge badge-verify">scenario</span>
      </div>

      <div className="grid gap-3">
        <button
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-white/20 transition"
          onClick={onAddDrain}
        >
          <p className="text-sm font-semibold text-white">Add drain + ticket log</p>
          <p className="text-xs text-white/60">Creates a drain event with a paired ticket match.</p>
        </button>

        <button
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-white/20 transition"
          onClick={onAddAlert}
        >
          <p className="text-sm font-semibold text-white">Raise discrepancy alert</p>
          <p className="text-xs text-white/60">Adds an over/under report to the Alerts panel.</p>
        </button>

        <button
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-white/20 transition"
          onClick={onAddForecast}
        >
          <p className="text-sm font-semibold text-white">Inject forecast curve</p>
          <p className="text-xs text-white/60">Plots a synthetic capacity forecast & overflow ETA.</p>
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-white/60">
        <span>
          Sample drains: <strong className="text-white/90">{stats.drains}</strong> · Alerts:{" "}
          <strong className="text-white/90">{stats.alerts}</strong>
        </span>
        <span className={`badge ${stats.forecastActive ? "badge-verify" : ""}`}>
          {stats.forecastActive ? "forecast active" : "forecast idle"}
        </span>
      </div>

      <button
        className="w-full rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm text-white/80 hover:border-white/30 transition"
        onClick={onClear}
      >
        Clear sample data
      </button>
    </div>
  );
}
