import { useEffect, useMemo, useState } from "react";
import { Cauldron, DrainEvent, MatchRow, TraceStep } from "../types";

type ThemeConfig = {
  border: string;
  gradient: string;
  accentBar: string;
  stepBg: string;
  agentChip: string;
  tagChip: string;
  glow: string;
  flare: string;
};

const THEMES: ThemeConfig[] = [
  {
    border: "border border-rose-400/30",
    gradient: "from-rose-500/10 via-fuchsia-500/5 to-indigo-500/5",
    accentBar: "from-rose-400/80 via-fuchsia-400/50 to-indigo-400/20",
    stepBg: "bg-rose-500/15 border border-rose-400/40 text-rose-50",
    agentChip: "bg-rose-500/20 border border-rose-400/40 text-rose-50",
    tagChip: "border border-rose-400/40 text-rose-50/90",
    glow: "shadow-[0_15px_35px_rgba(244,196,113,0.18)]",
    flare: "bg-rose-400/25",
  },
  {
    border: "border border-emerald-400/25",
    gradient: "from-emerald-500/10 via-teal-500/5 to-cyan-500/5",
    accentBar: "from-emerald-400/80 via-teal-400/50 to-cyan-400/20",
    stepBg: "bg-emerald-500/15 border border-emerald-400/40 text-emerald-50",
    agentChip: "bg-emerald-500/20 border border-emerald-400/40 text-emerald-50",
    tagChip: "border border-emerald-400/40 text-emerald-50/90",
    glow: "shadow-[0_15px_35px_rgba(122,211,243,0.18)]",
    flare: "bg-emerald-300/20",
  },
  {
    border: "border border-amber-400/30",
    gradient: "from-amber-500/15 via-orange-500/5 to-yellow-500/5",
    accentBar: "from-amber-400/90 via-orange-400/50 to-yellow-400/20",
    stepBg: "bg-amber-500/15 border border-amber-400/40 text-amber-50",
    agentChip: "bg-amber-500/20 border border-amber-400/40 text-amber-50",
    tagChip: "border border-amber-400/40 text-amber-50/90",
    glow: "shadow-[0_15px_35px_rgba(229,142,51,0.20)]",
    flare: "bg-amber-300/20",
  },
  {
    border: "border border-sky-400/30",
    gradient: "from-sky-500/15 via-indigo-500/5 to-purple-500/5",
    accentBar: "from-sky-400/80 via-indigo-400/50 to-purple-400/25",
    stepBg: "bg-sky-500/15 border border-sky-400/40 text-sky-50",
    agentChip: "bg-sky-500/20 border border-sky-400/40 text-sky-50",
    tagChip: "border border-sky-400/40 text-sky-50/90",
    glow: "shadow-[0_15px_35px_rgba(158,124,253,0.22)]",
    flare: "bg-sky-300/20",
  },
];

const ACTION_COLORS: { match: RegExp; primary: string; glow: string }[] = [
  { match: /detect|scan/i, primary: "#7AD3F3", glow: "rgba(122,211,243,0.26)" },
  { match: /match|reconcile/i, primary: "#F4C471", glow: "rgba(244,196,113,0.28)" },
  { match: /audit|variance|verify/i, primary: "#E58E33", glow: "rgba(229,142,51,0.3)" },
  { match: /forecast|predict/i, primary: "#9E7CFD", glow: "rgba(158,124,253,0.28)" },
];

const ACTION_ACTIVE_WINDOW_MS = 5000;

const AGENT_COLUMNS = [
  { key: "detect", label: "Detect", icon: "🔍" },
  { key: "match", label: "Match", icon: "🔗" },
  { key: "audit", label: "Audit", icon: "🧪" },
  { key: "forecast", label: "Forecast", icon: "📈" },
];

const COLUMN_KEYS = AGENT_COLUMNS.map((col) => col.key);

const timeFormatter =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;

function formatTime(value?: string) {
  if (!value) return "";
  const needsOffset = !!value && !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);
  const normalized = needsOffset ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  if (timeFormatter) {
    try {
      return timeFormatter.format(date);
    } catch {
      /* fall through */
    }
  }
  return date.toISOString().slice(11, 16);
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickTheme(key?: string | number): ThemeConfig {
  if (!key) return THEMES[0];
  const idx = hashSeed(String(key));
  return THEMES[idx % THEMES.length];
}

function getInitials(label?: string) {
  if (!label) return "AI";
  const chars = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return chars.toUpperCase() || "AI";
}

type DecoratedTrace = TraceStep & {
  theme: ThemeConfig;
  timeLabel: string;
  initials: string;
  sizeRatio: number;
  sizeLabel: string;
  footprintColor: string;
  hoverGlow: string;
};

type AgentsByCouldrentProps = {
  trace?: TraceStep[];
  plannerRan?: boolean;
  cauldrons?: Cauldron[];
  drains?: DrainEvent[];
  matches?: MatchRow[];
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

type CauldronGroup = {
  cauldronId: string;
  cauldronName: string;
  latestTs: number;
  highlights: string[];
  agents: Map<string, ThemeConfig>;
  columns: Record<string, DecoratedTrace | undefined>;
};

function computeSizeMetrics(step: TraceStep): { ratio: number; label: string } {
  const summaryLength = (step.summary || "").length;
  const tagBonus = (step.tags?.length || 0) * 18;
  const total = summaryLength + tagBonus + (step.tool?.length || 0);
  const ratio = Math.min(1, Math.max(0.18, total / 220));
  if (ratio < 0.4) return { ratio, label: "light" };
  if (ratio < 0.7) return { ratio, label: "steady" };
  return { ratio, label: "intense" };
}

function decorateTrace(step: TraceStep): DecoratedTrace {
  const theme = pickTheme(step.agent ?? step.tool ?? step.summary ?? step.step);
  const sizeMetrics = computeSizeMetrics(step);
  const actionColors = resolveActionColors(step.action ?? step.tool ?? step.summary);
  return {
    ...step,
    theme,
    timeLabel: formatTime(step.created_at),
    initials: getInitials(step.agent ?? step.tool),
    sizeRatio: sizeMetrics.ratio,
    sizeLabel: sizeMetrics.label,
    footprintColor: actionColors.footprint,
    hoverGlow: actionColors.glow,
  };
}

export default function AgentsByCouldrent({
  trace = [] as TraceStep[],
  plannerRan = false,
  cauldrons = [],
  drains = [],
  matches = [],
}: AgentsByCouldrentProps) {
  const displayTrace = trace;
  const [tick, setTick] = useState(Date.now());
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(Date.now());
      setPulseIndex((prev) => prev + 1);
    }, ACTION_ACTIVE_WINDOW_MS);
    return () => clearInterval(id);
  }, []);

  const decoratedEntries = useMemo(() => {
    return [...displayTrace]
      .sort((a, b) => {
        const tsA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tsB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tsB - tsA;
      })
      .map(decorateTrace);
  }, [displayTrace]);



  const rows = useMemo<CauldronGroup[]>(() => {
    const fallbackName = cauldrons[0]?.name ?? cauldrons[0]?.id;
    type InternalGroup = {
      cauldronId: string;
      cauldronName: string;
      latestTs: number;
      columns: Record<string, DecoratedTrace | undefined>;
      highlights: Set<string>;
      agents: Map<string, ThemeConfig>;
    };

    const rowsByCauldron = new Map<string, InternalGroup>();
    const drainOrder = drains.map((drain) => drain.cauldron_id).filter(Boolean) as string[];
    const matchOrder = matches.map((match) => match.cauldron_id).filter(Boolean) as string[];
    const focusOrder = Array.from(new Set([...drainOrder, ...matchOrder].filter((id): id is string => Boolean(id))));
    const focusSet = new Set(focusOrder);

    const ensureRow = (cauldronId: string, ts: number) => {
      if (focusSet.size > 0 && !focusSet.has(cauldronId)) {
        return null;
      }
      const cauldronName =
        cauldrons.find((c) => c.id === cauldronId)?.name ?? cauldronId ?? fallbackName ?? "Unknown Cauldron";
      if (rowsByCauldron.has(cauldronId)) {
        const existing = rowsByCauldron.get(cauldronId)!;
        existing.cauldronName = cauldronName;
        existing.latestTs = Math.max(existing.latestTs, ts || 0);
        return existing;
      }
      const created: InternalGroup = {
        cauldronId,
        cauldronName,
        latestTs: ts || Date.now(),
        columns: AGENT_COLUMNS.reduce<Record<string, DecoratedTrace | undefined>>((acc, col) => {
          acc[col.key] = undefined;
          return acc;
        }, {}),
        highlights: new Set<string>(),
        agents: new Map<string, ThemeConfig>(),
      };
      rowsByCauldron.set(cauldronId, created);
      return created;
    };

    const fallbackCycle = focusOrder.length > 0 ? focusOrder : [];
    let fallbackIdx = 0;
    let lastCauldronId: string | undefined;

    decoratedEntries.forEach((entry) => {
      const ts = entry.created_at ? new Date(entry.created_at).getTime() : Date.now();
      let cauldronId = deriveCauldronId(entry);
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
      const row = ensureRow(cauldronId, ts);
      if (!row) return;
      const agentLabel = entry.agent ?? entry.tool ?? "Agent";
      row.agents.set(agentLabel, entry.theme);
      const columnKey = resolveColumnKey(entry);
      if (columnKey) {
        const existing = row.columns[columnKey];
        const existingTs = existing?.created_at ? new Date(existing.created_at).getTime() : 0;
        if (!existing || ts > existingTs) {
          row.columns[columnKey] = entry;
        }
        const highlightLabel = AGENT_COLUMNS.find((col) => col.key === columnKey)?.label ?? columnKey;
        row.highlights.add(highlightLabel);
      }
      row.latestTs = Math.max(row.latestTs, ts || 0);
    });

    drains.forEach((drain) => {
      const cauldronId = drain.cauldron_id;
      if (!cauldronId) return;
      const tsString = drain.t_end ?? drain.t_start;
      const ts = tsString ? new Date(tsString).getTime() : Date.now();
      const row = ensureRow(cauldronId, ts);
      if (!row) return;
      row.highlights.add("Detect");
      row.latestTs = Math.max(row.latestTs, ts);
    });

    matches.forEach((match) => {
      const cauldronId = match.cauldron_id;
      if (!cauldronId) return;
      const tsString = match.created_at;
      const ts = tsString ? new Date(tsString).getTime() : Date.now();
      const row = ensureRow(cauldronId, ts);
      if (!row) return;
      row.highlights.add("Match");
      row.latestTs = Math.max(row.latestTs, ts);
    });

    const rowsArray = Array.from(rowsByCauldron.values());
    const baseRows = rowsArray
      .filter((row) => {
        const hasEntries = Object.values(row.columns).some(Boolean);
        if (hasEntries) return true;
        if (focusSet.size > 0 && focusSet.has(row.cauldronId)) return true;
        return false;
      })
      .sort((a, b) => b.latestTs - a.latestTs);

    const prioritized: InternalGroup[] = [];
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
        seen.add(row.cauldronId);
      }
    });

    return prioritized
      .filter((row, index, self) => self.findIndex((item) => item.cauldronId === row.cauldronId) === index)
      .filter((row) => (focusSet.size === 0 ? true : focusSet.has(row.cauldronId)))
      .map((row) => ({
        cauldronId: row.cauldronId,
        cauldronName: row.cauldronName,
        latestTs: row.latestTs,
        columns: row.columns,
        highlights: Array.from(row.highlights),
        agents: row.agents,
      }));
  }, [decoratedEntries, cauldrons, drains, matches]);


  const hasEntries = rows.length > 0;
  const emptyMessage = plannerRan ? "No agent coverage yet." : "Run Nemotron planner to populate agent coverage.";

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="h-subtitle">Agents by Cauldron</h3>
          <p className="text-[11px] text-white/60">Agent Trace calls grouped by cauldron.</p>
        </div>
        {hasEntries && (
          <span className="text-xs text-white/60">Tracking {rows.length} cauldrons</span>
        )}
      </div>

      {!hasEntries ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{emptyMessage}</div>
      ) : (
        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1.5">
          {rows.map((group) => (
            <div key={group.cauldronId} className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Cauldron</p>
                  <p className="text-lg font-semibold text-white tracking-tight">{group.cauldronName}</p>
                </div>
                {group.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.3em] text-white/70">
                    {group.highlights.map((highlight) => (
                      <span
                        key={`${group.cauldronId}-${highlight}-highlight`}
                        className="badge border border-emerald-300/60 bg-emerald-400/15 text-white shadow shadow-emerald-500/30"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {(() => {
                  const offset = Math.abs(hashSeed(group.cauldronId)) % AGENT_COLUMNS.length;
                  const highlightIdx = (pulseIndex + offset) % AGENT_COLUMNS.length;
                  const trailingIdx = (highlightIdx - 1 + AGENT_COLUMNS.length) % AGENT_COLUMNS.length;
                  return AGENT_COLUMNS.map((col, idx) => {
                    const colorTheme = ACTION_COLORS[idx % ACTION_COLORS.length];
                    const themeColor = colorTheme?.primary ?? "#7AD3F3";
                    const isHighlighted = idx === highlightIdx;
                    const isTrailing = idx === trailingIdx && highlightIdx !== trailingIdx;
                    const iconClass = `flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-all duration-300 ${
                      isHighlighted
                        ? "shadow shadow-emerald-400/40"
                        : isTrailing
                          ? "shadow shadow-emerald-400/10"
                          : "text-white/40 border-white/15"
                    }`;
                    const activeStyle = isHighlighted
                      ? {
                          borderColor: themeColor,
                          color: themeColor,
                          boxShadow: `0 0 20px ${themeColor}88`,
                          background: `linear-gradient(135deg, ${themeColor}33, ${themeColor}0A)`,
                        }
                      : isTrailing
                        ? {
                            borderColor: `${themeColor}55`,
                            color: `${themeColor}99`,
                            boxShadow: `0 0 10px ${themeColor}44`,
                          }
                        : {
                            borderColor: "#ffffff22",
                            color: "#ffffff55",
                          };
                    return (
                      <div key={`${group.cauldronId}-${col.key}-icon`} className="flex flex-1 flex-col items-center gap-1">
                        <span className={iconClass} style={activeStyle}>
                          {col.icon}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">{col.label}</span>
                      </div>
                    );
                  });
                })()}
              </div>

              {group.agents.size > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[10px] tracking-[0.15em] text-white/80">
                  {Array.from(group.agents.entries()).map(([agentName, theme]) => (
                    <span
                      key={`${group.cauldronId}-${agentName}-agent`}
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-semibold uppercase rounded-full ${theme.agentChip}`}
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-[10px]">
                        {getInitials(agentName)}
                      </span>
                      {agentName}
                    </span>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function resolveActionColors(action?: string): { footprint: string; glow: string } {
  if (!action) {
    return { footprint: "#C3B4FF", glow: "rgba(195,180,255,0.25)" };
  }
  const entry = ACTION_COLORS.find((item) => item.match.test(action));
  return entry ? { footprint: entry.primary, glow: entry.glow } : { footprint: "#C3B4FF", glow: "rgba(195,180,255,0.25)" };
}
