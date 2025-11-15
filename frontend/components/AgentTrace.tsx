import { useEffect, useMemo, useState } from "react";
import { TraceStep } from "../types";

const PAGE_SIZE = 10;

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

type AgentTraceProps = {
  trace?: TraceStep[];
  plannerRan?: boolean;
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

export default function AgentTrace({ trace = [] as TraceStep[], plannerRan = false }: AgentTraceProps) {
  const displayTrace = trace.filter((step) => Boolean(step.agent));
  const hasEntries = displayTrace.length > 0;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil((displayTrace?.length ?? 0) / PAGE_SIZE));
  const pageIndex = Math.min(page, totalPages - 1);
  const start = pageIndex * PAGE_SIZE;
  const stepsToShow = displayTrace.slice(start, start + PAGE_SIZE);

  const entries = useMemo<DecoratedTrace[]>(
    () =>
      stepsToShow.map((step) => {
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
      }),
    [stepsToShow],
  );

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="h-subtitle">Nemotron Planner — Agent Trace</h3>
          <p className="text-[11px] text-white/60">Live log of every autonomous step taken in this session.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`badge ${!canPrev ? "opacity-40 cursor-not-allowed" : ""}`}
            onClick={() => canPrev && setPage((prev) => Math.max(0, prev - 1))}
            disabled={!canPrev}
          >
            ← Prev
          </button>
          <span className="text-xs text-white/60">
            {Math.min(displayTrace.length, start + 1)}-{Math.min(displayTrace.length, start + entries.length)} / {displayTrace.length || 0}
          </span>
          <button
            className={`badge ${!canNext ? "opacity-40 cursor-not-allowed" : ""}`}
            onClick={() => canNext && setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={!canNext}
          >
            Next →
          </button>
        </div>
      </div>

      

      {!hasEntries && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
          {plannerRan ? "Awaiting Nemotron planner activity…" : "No planner activity yet."}
        </div>
      )}

      {hasEntries && (
        <ol className="space-y-2.5">
                  {entries.map((entry) => (
                    <li
                      key={`${entry.step}-${entry.tool}`}
                      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r ${entry.theme.gradient} ${entry.theme.border} ${entry.theme.glow} transition duration-200 hover:-translate-y-0.5 hover:brightness-110`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${entry.theme.accentBar}`}
                      />
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute -right-6 top-1/2 h-24 w-24 -translate-y-1/2 blur-3xl ${entry.theme.flare}`}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 blur-3xl"
                        style={{ background: entry.hoverGlow }}
                      />

                      <div className="relative flex gap-3 p-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold tracking-tight ${entry.theme.stepBg}`}
                          >
                            {String(entry.step).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] uppercase tracking-[0.3em] text-white/40">step</span>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.agent && (
                              <span
                                className={`flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest rounded-full ${entry.theme.agentChip}`}
                              >
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-[10px]">
                                  {entry.initials}
                                </span>
                                {entry.agent}
                              </span>
                            )}
                            {entry.timeLabel && <span className="text-[11px] text-white/60">{entry.timeLabel}</span>}
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">action</p>
                            <p className="text-base font-semibold text-white tracking-tight leading-tight">{entry.tool}</p>
                            <p className="mt-0.5 text-sm text-white/75 leading-snug">{entry.summary}</p>
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-white/40">
                              <span>footprint</span>
                              <span className="text-white/60">{entry.sizeLabel}</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                              <span
                                className="block h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.round(entry.sizeRatio * 100)}%`,
                                  background: `linear-gradient(90deg, ${entry.footprintColor}, ${entry.footprintColor}55)`,
                                }}
                              />
                            </div>
                          </div>

                          {!!entry.tags?.length && (
                            <div className="flex flex-wrap gap-1.5">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`px-2 py-0.5 text-[11px] uppercase tracking-wide rounded-full ${entry.theme.tagChip}`}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
        </ol>
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
