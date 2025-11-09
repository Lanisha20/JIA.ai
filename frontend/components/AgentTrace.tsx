import { TraceStep } from "../types";
export default function AgentTrace({ trace = [] as TraceStep[] }) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-gold mb-3">Nemotron Planner — Agent Trace</h3>
      <ol className="space-y-2">
        {trace.map(t => (
          <li key={t.step} className="flex items-start gap-3">
            <span className="badge badge-verify">{t.step}</span>
            <div>
              <div className="font-medium">{t.tool}</div>
              <div className="text-sm text-white/70">{t.summary}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
