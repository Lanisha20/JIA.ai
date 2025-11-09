import { useMemo, useState } from "react";
import { TraceStep } from "../types";

const PAGE_SIZE = 10;

export default function AgentTrace({ trace = [] as TraceStep[] }) {
  const [showAll, setShowAll] = useState(false);
  const stepsToShow = showAll ? trace : trace.slice(0, PAGE_SIZE);
  const hasMore = trace.length > PAGE_SIZE;
  const formatted = useMemo(() =>
    stepsToShow.map((step) => ({
      ...step,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })),
  [stepsToShow]);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gold">Nemotron Planner — Agent Trace</h3>
        {hasMore && (
          <button className="badge" onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? "Show less" : `Show ${trace.length - PAGE_SIZE} more`}
          </button>
        )}
      </div>

      {trace.length === 0 && <div className="text-sm text-white/70">No planner activity yet.</div>}

      <ol className="space-y-2">
        {formatted.map((t) => (
          <li key={t.step} className="flex items-start gap-3">
            <span className="badge badge-verify">{t.step}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{t.tool}</span>
                <span className="text-xs text-white/60">{t.time}</span>
              </div>
              <div className="text-sm text-white/70">{t.summary}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
