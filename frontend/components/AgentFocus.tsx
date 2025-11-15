import { useMemo } from "react";
import { Cauldron, DrainEvent, MatchRow, TraceStep } from "../types";

type Props = {
  trace?: TraceStep[];
  cauldrons?: Cauldron[];
  plannerRan?: boolean;
  drains?: DrainEvent[];
  matches?: MatchRow[];
};

type AgentTheme = {
  shell: string;
  accent: string;
  badge: string;
};

const AGENT_COLUMNS = [
  { key: "detect", label: "Detect" },
  { key: "match", label: "Match" },
  { key: "audit", label: "Audit" },
  { key: "forecast", label: "Forecast" },
];

const COLUMN_KEYS = AGENT_COLUMNS.map((col) => col.key);

const THEMES: Record<string, AgentTheme> = {
  detect: {
    shell: "bg-amber-500/10 border border-amber-400/40",
    accent: "text-amber-200",
    badge: "bg-amber-500/20 text-amber-900 border border-amber-400/60",
  },
  match: {
    shell: "bg-sky-500/10 border border-sky-400/40",
    accent: "text-sky-100",
    badge: "bg-sky-500/20 text-sky-900 border border-sky-400/60",
  },
  audit: {
    shell: "bg-emerald-500/10 border border-emerald-400/40",
    accent: "text-emerald-200",
    badge: "bg-emerald-500/20 text-emerald-50 border border-emerald-400/60",
  },
  forecast: {
    shell: "bg-purple-500/10 border border-purple-400/40",
    accent: "text-purple-100",
    badge: "bg-purple-500/20 text-purple-100 border border-purple-400/60",
  },
};

const DEFAULT_THEME: AgentTheme = {
  shell: "bg-white/5 border border-white/10",
  accent: "text-gold",
  badge: "bg-white/10 text-white border border-white/20",
};

const ROWS_PER_VIEW = 3;

const cstFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Chicago",
});

const toTimeLabel = (iso?: string) => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return cstFormatter.format(dt);
};

const extractCauldron = (step: TraceStep) =>
  step.context?.cauldron_id ||
  step.input_payload?.context?.cauldron_id ||
  step.input_payload?.cauldron_id ||
  step.output_payload?.context?.cauldron_id;

const deriveCauldronId = (step: TraceStep): string | undefined => {
  const direct = extractCauldron(step);
  if (direct) return direct;
  const output = step.output_payload && typeof step.output_payload === "object" ? step.output_payload : undefined;
  const plan = output && typeof output.plan === "object" ? output.plan : undefined;
  const steps = Array.isArray(plan?.steps)
    ? plan?.steps
    : Array.isArray(output?.steps)
      ? output.steps
      : [];
  for (const s of steps) {
    const payload = s?.payload;
    if (payload && typeof payload === "object") {
      if (payload.cauldron_id) return payload.cauldron_id;
      if (payload.target?.cauldron_id) return payload.target.cauldron_id;
    }
  }
  return undefined;
};

type RowData = {
  cauldronId: string;
  cauldronName: string;
  latestTs: number;
  entries: Record<string, TraceStep>;
  agents: Set<string>;
};

const resolveColumnKey = (step: TraceStep): string | undefined => {
  const tool = (step.tool || "").toLowerCase();
  if (COLUMN_KEYS.includes(tool)) return tool;
  const action = (step.action || "").toLowerCase();
  if (COLUMN_KEYS.includes(action)) return action;
  const tags = step.tags?.map((tag) => tag.toLowerCase()) ?? [];
  const tagMatch = tags.find((tag) => COLUMN_KEYS.includes(tag));
  if (tagMatch) return tagMatch;
  return undefined;
};

export default function AgentFocus({
  trace = [],
  cauldrons = [],
  plannerRan = false,
  drains = [],
  matches = [],
}: Props) {
  const rows = useMemo<RowData[]>(() => {
    const fallbackName = cauldrons[0]?.name ?? cauldrons[0]?.id;
    const sorted = [...trace]
      .map((step) => ({
        step,
        ts: step.created_at ? new Date(step.created_at).getTime() : Date.now(),
      }))
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

    const rowsByCauldron = new Map<string, RowData>();
    const drainOrder = drains.map((drain) => drain.cauldron_id).filter(Boolean) as string[];
    const matchOrder = matches.map((match) => match.cauldron_id).filter(Boolean) as string[];
    const traceSeen = new Set<string>();
    const focusOrder = Array.from(new Set([...drainOrder, ...matchOrder].filter((id): id is string => Boolean(id))));
    const focusSet = new Set(focusOrder);

    const ensureRow = (cauldronId: string, ts: number) => {
      if (focusSet.size > 0 && !focusSet.has(cauldronId)) {
        return null;
      }
      const cauldronName =
        cauldrons.find((c) => c.id === cauldronId)?.name ?? fallbackName ?? cauldronId;
      const existing =
        rowsByCauldron.get(cauldronId) ||
        ({
          cauldronId,
          cauldronName,
          latestTs: ts || Date.now(),
          entries: {},
          actions: new Set<string>(),
        } as RowData);
      existing.cauldronName = cauldronName;
      rowsByCauldron.set(cauldronId, existing);
      return existing;
    };

    const fallbackCycle = focusOrder.length > 0 ? focusOrder : [];
    let fallbackIdx = 0;
    let lastCauldronId: string | undefined;

    sorted.forEach(({ step, ts }) => {
      const columnKey = resolveColumnKey(step);
      if (!columnKey) return;
      let cauldronId = deriveCauldronId(step);
      if (!cauldronId) {
        if (lastCauldronId) {
          cauldronId = lastCauldronId;
        } else if (fallbackCycle.length > 0) {
          cauldronId = fallbackCycle[fallbackIdx % fallbackCycle.length];
          fallbackIdx += 1;
        } else {
          return;
        }
      }
      lastCauldronId = cauldronId;
      let existing = ensureRow(cauldronId, ts || Date.now());
      if (!existing) return;
      const prev = existing.entries[columnKey];
      if (
        !prev ||
        (prev.created_at && step.created_at && new Date(step.created_at) > new Date(prev.created_at))
      ) {
        existing.entries[columnKey] = step;
        const columnLabel = AGENT_COLUMNS.find((col) => col.key === columnKey)?.label ?? columnKey;
        existing.actions.add(columnLabel);
      }
      existing.latestTs = Math.max(existing.latestTs, ts || 0);
    });

    drains.forEach((drain) => {
      const cauldronId = drain.cauldron_id;
      if (!cauldronId) return;
      const tsString = drain.t_end ?? drain.t_start;
      const ts = tsString ? new Date(tsString).getTime() : Date.now();
      const row = ensureRow(cauldronId, ts);
      if (!row) return;
      row.actions.add("Detect");
      row.latestTs = Math.max(row.latestTs, ts);
    });

    matches.forEach((match) => {
      const cauldronId = match.cauldron_id;
      if (!cauldronId) return;
      const tsString = match.created_at;
      const ts = tsString ? new Date(tsString).getTime() : Date.now();
      const row = ensureRow(cauldronId, ts);
      if (!row) return;
      row.actions.add("Match");
      row.latestTs = Math.max(row.latestTs, ts);
    });

    const rowsArray = Array.from(rowsByCauldron.values());
    const baseRows = rowsArray
      .filter((row) => {
        const hasEntries = Object.keys(row.entries).length > 0;
        if (hasEntries) return true;
        if (focusSet.size > 0 && focusSet.has(row.cauldronId)) return true;
        return false;
      })
      .sort((a, b) => b.latestTs - a.latestTs);

    const prioritized: RowData[] = [];
    const seen = new Set<string>();

    drainOrder.forEach((id) => {
      const row = rowsByCauldron.get(id);
      if (row && !seen.has(id)) {
        prioritized.push(row);
        seen.add(id);
      }
    });

    baseRows.forEach((row) => {
      if (!seen.has(row.cauldronId)) {
        prioritized.push(row);
      }
    });

    return prioritized
      .filter((row, index, self) => self.findIndex((item) => item.cauldronId === row.cauldronId) === index)
      .filter((row) => (focusSet.size === 0 ? true : focusSet.has(row.cauldronId)));
  }, [trace, cauldrons, drains, matches]);

  const resolveTheme = (colKey: string) => THEMES[colKey] ?? DEFAULT_THEME;
  const effectiveRows = plannerRan ? rows : [];
  const visibleCount = Math.min(effectiveRows.length, ROWS_PER_VIEW);
  const emptyMessage = plannerRan ? "No agent focus data yet." : "Run Nemotron planner to populate agent focus.";

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="h-subtitle">Agent Focus</h3>
          <p className="text-xs text-white/60">Latest actions per cauldron.</p>
        </div>
        {effectiveRows.length > 0 && (
          <span className="text-xs text-white/50">
            Showing {visibleCount} of {effectiveRows.length}
          </span>
        )}
      </div>

      {effectiveRows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{emptyMessage}</div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1.5">
            {effectiveRows.map((row) => {
              const activeAgents = AGENT_COLUMNS.filter((col) => row.entries[col.key]);
              const agentLabels = Array.from(row.actions);
              return (
              <div key={row.cauldronId} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-white tracking-tight">{row.cauldronId}</p>
                  </div>
                  <span className="text-[11px] text-white/50">{row.latestTs ? toTimeLabel(new Date(row.latestTs).toISOString()) : ""}</span>
                </div>
                {agentLabels.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
                    {agentLabels.map((agent) => (
                      <span key={`${row.cauldronId}-${agent}-chip`} className="badge bg-white/5 text-white/70 border border-white/10">
                        {agent}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {AGENT_COLUMNS.map((col) => {
                    const entry = row.entries[col.key];
                    const theme = resolveTheme(col.key);
                    const summary = entry?.summary || entry?.tool || `${col.label} awaiting action`;
                    const timeLabel = entry?.created_at ? toTimeLabel(entry.created_at) : "";

                    return (
                      <div
                        key={`${row.cauldronId}-${col.key}`}
                        className={`rounded-2xl p-3 space-y-2 ${entry ? theme.shell : "border border-white/5 bg-white/2 text-white/40"} `}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-xs uppercase tracking-[0.3em] ${theme.accent}`}>{col.label}</p>
                          {timeLabel && <span className="text-[11px] text-white/60">{timeLabel}</span>}
                        </div>
                        <div className={`rounded-xl px-3 py-2 text-sm font-medium ${entry ? theme.badge : "bg-transparent text-white/40 border border-dashed border-white/10"}`}>
                          {summary}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
})}
          </div>
        </div>
      )}
    </div>
  );
}
