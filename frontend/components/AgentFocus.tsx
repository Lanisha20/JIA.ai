import { useMemo } from "react";
import { Cauldron, TraceStep } from "../types";

type Props = {
  trace?: TraceStep[];
  cauldrons?: Cauldron[];
};

type AgentTheme = {
  shell: string;
  accent: string;
  badge: string;
};

const THEMES: Record<string, AgentTheme> = {
  nemotron: {
    shell: "bg-gradient-to-r from-rose-500/15 via-purple-500/10 to-sky-500/10 border border-rose-400/40",
    accent: "text-rose-200",
    badge: "bg-rose-500/20 text-rose-100 border border-rose-400/60",
  },
  audit: {
    shell: "bg-emerald-500/10 border border-emerald-400/40",
    accent: "text-emerald-200",
    badge: "bg-emerald-500/20 text-emerald-50 border border-emerald-400/60",
  },
  detect: {
    shell: "bg-amber-500/10 border border-amber-400/40",
    accent: "text-amber-100",
    badge: "bg-amber-500/20 text-amber-900 border border-amber-400/60",
  },
  match: {
    shell: "bg-sky-500/10 border border-sky-400/40",
    accent: "text-sky-100",
    badge: "bg-sky-500/20 text-sky-900 border border-sky-400/60",
  },
};

const DEFAULT_THEME: AgentTheme = {
  shell: "bg-white/5 border border-white/10",
  accent: "text-gold",
  badge: "bg-white/10 text-white border border-white/20",
};

const AGENT_THEME_OVERRIDES: Record<string, AgentTheme> = {
  nemotron: THEMES.nemotron,
  audit: THEMES.audit,
  detect: THEMES.detect,
  match: THEMES.match,
};

const toTimeLabel = (iso?: string) => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const extractCauldron = (step: TraceStep) =>
  step.context?.cauldron_id ||
  step.input_payload?.context?.cauldron_id ||
  step.input_payload?.cauldron_id ||
  step.output_payload?.context?.cauldron_id;

const inferCauldronFromSteps = (steps: any[]): string | undefined => {
  for (const planStep of steps) {
    const payload = planStep?.payload;
    if (payload && typeof payload === "object") {
      if (payload.cauldron_id) return payload.cauldron_id;
      if (payload.target?.cauldron_id) return payload.target.cauldron_id;
    }
  }
  return undefined;
};

const deriveSnapshotCauldron = (step: TraceStep): string | undefined => {
  const direct = extractCauldron(step);
  if (direct) return direct;
  const output = step.output_payload && typeof step.output_payload === "object" ? step.output_payload : undefined;
  const plan = output && typeof output.plan === "object" ? output.plan : undefined;
  if (plan && Array.isArray(plan.steps)) {
    const inferred = inferCauldronFromSteps(plan.steps);
    if (inferred) return inferred;
  }
  if (Array.isArray(output?.steps)) {
    const inferred = inferCauldronFromSteps(output.steps);
    if (inferred) return inferred;
  }
  return undefined;
};

export default function AgentFocus({ trace = [], cauldrons = [] }: Props) {
  const plannerDiagrams = useMemo(() => {
    const plansByCauldron = new Map<
      string,
      {
        cauldronId: string;
        entries: Array<{
          createdAt?: string;
          createdTs: number;
          strategy?: string;
          goal?: string;
          steps: any[];
        }>;
      }
    >();

    trace.forEach((step, idx) => {
      if ((step.agent || "").toLowerCase() !== "nemotron") return;
      const output = step.output_payload && typeof step.output_payload === "object" ? step.output_payload : undefined;
      const plan = output && typeof output.plan === "object" ? output.plan : undefined;
      const steps = Array.isArray(plan?.steps)
        ? plan?.steps
        : Array.isArray(output?.steps)
          ? output.steps
          : [];
      if (!steps.length) return;
      const cauldronId =
        extractCauldron(step) ??
        inferCauldronFromSteps(steps) ??
        step.context?.cauldron_id ??
        `plan-${idx}`;
      const createdTs = step.created_at ? new Date(step.created_at).getTime() : Date.now() - idx * 1000;
      const entry = {
        createdAt: step.created_at,
        createdTs,
        strategy: plan?.strategy ?? step.context?.strategy,
        goal: step.context?.goal,
        steps,
      };
      const existing = plansByCauldron.get(cauldronId);
      if (!existing) {
        plansByCauldron.set(cauldronId, {
          cauldronId,
          entries: [entry],
        });
      } else {
        existing.entries.push(entry);
      }
    });

    return Array.from(plansByCauldron.values())
      .map((record) => {
        const sorted = record.entries.sort((a, b) => (b.createdTs ?? 0) - (a.createdTs ?? 0));
        return {
          cauldronId: record.cauldronId,
          latest: sorted[0],
          history: sorted,
        };
      })
      .sort((a, b) => (b.latest.createdTs ?? 0) - (a.latest.createdTs ?? 0));
  }, [trace]);

  const snapshots = useMemo(() => {
    const fallbackCauldronId = cauldrons[0]?.id;
    return trace
      .map((step) => ({
        agent: (step.agent || "agent").toLowerCase(),
        step,
        ts: step.created_at ? new Date(step.created_at).getTime() : Date.now(),
        cauldronId: deriveSnapshotCauldron(step) ?? fallbackCauldronId,
      }))
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .filter((entry) => Boolean(entry.cauldronId))
      .slice(0, 3);
  }, [trace, cauldrons]);

  const resolveCauldronName = (cauldronId?: string) => {
    if (!cauldronId) return undefined;
    return cauldrons.find((c) => c.id === cauldronId)?.name ?? cauldronId;
  };
  const containerClass =
    snapshots.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-3";

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gold">Agent Focus</h3>
          <p className="text-xs text-white/60">Live snapshots per agent.</p>
        </div>
        <span className="badge badge-verify">live</span>
      </div>

      {snapshots.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Latest Snapshots</p>
          <div className={containerClass}>
            {snapshots.map(({ agent, step, cauldronId }, snapshotIdx) => {
              const theme = AGENT_THEME_OVERRIDES[agent] ?? DEFAULT_THEME;
              const cauldronLabel = resolveCauldronName(cauldronId);
              const displayCauldron = cauldronLabel ?? cauldronId ?? "Unassigned";
              const happening = step.summary || `Running ${step.action ?? step.tool ?? "task"}`;
              const bubbleText = `${displayCauldron}: ${happening}`;
              const timeLabel = toTimeLabel(step.created_at);
              const title = step.agent ?? agent;
              const cauldronChip = `${displayCauldron}${
                cauldronId && cauldronId !== displayCauldron ? ` (${cauldronId})` : ""
              }`;

              return (
                <div
                  key={`${snapshotIdx}-${agent}-${step.action}-${step.created_at ?? ""}`}
                  className={`relative rounded-2xl p-4 space-y-3 ${theme.shell}`}
                >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-xs uppercase tracking-[0.3em] ${theme.accent}`}>{title}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Cauldron: <span className="font-semibold text-white">{displayCauldron}</span>
                  </p>
                  <p className="text-base font-semibold text-white">{step.action ?? step.tool ?? "activity"}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  {timeLabel && <span>{timeLabel}</span>}
                  {step.tags && step.tags.length > 0 && (
                    <span className="badge badge-ghost uppercase tracking-[0.2em]">{step.tags[0]}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span className="badge badge-ghost uppercase tracking-[0.2em] text-white/70">
                  {cauldronChip}
                </span>
                {step.context?.goal && (
                  <span className="text-white/60">Goal: {step.context.goal}</span>
                )}
              </div>

              <div className="mt-3 relative">
                <div className={`inline-flex max-w-full rounded-2xl px-3 py-2 text-sm font-medium ${theme.badge}`}>
                  {bubbleText}
                </div>
              </div>

              <div className="mt-1 text-xs text-white/70 flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-white/60" />
                Watching {displayCauldron}
              </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {snapshots.length === 0 && (
        <div className="text-sm text-white/60">No agent snapshots yet.</div>
      )}

      {plannerDiagrams.length > 0 ? (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Nemotron Plans</p>
            <span className="text-[11px] text-white/50">{plannerDiagrams.length} diagram{plannerDiagrams.length === 1 ? "" : "s"}</span>
          </div>
          {plannerDiagrams.map((diagram) => {
            const cauldronLabel = resolveCauldronName(diagram.cauldronId) ?? diagram.cauldronId ?? "Unassigned";
            const timeLabel = toTimeLabel(diagram.latest.createdAt) || "just now";
            return (
              <div key={diagram.cauldronId ?? timeLabel} className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">{cauldronLabel}</p>
                    <p className="text-sm font-semibold text-white">Strategy: {diagram.latest.strategy ?? "default"}</p>
                    {diagram.latest.goal && (
                      <p className="text-[11px] text-white/60 mt-0.5">Goal: {diagram.latest.goal}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-white/60">{timeLabel}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {diagram.latest.steps.map((planStep, stepIdx) => {
                    const label = (planStep.tool ?? planStep.action ?? `Step ${stepIdx + 1}`).toUpperCase();
                    const detailPayload =
                      typeof planStep.payload === "object" && planStep.payload
                        ? Object.entries(planStep.payload)
                            .slice(0, 2)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" · ")
                        : null;
                    return (
                      <div key={`${diagram.cauldronId}-step-${stepIdx}`} className="flex items-center gap-2">
                        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                          <p className="text-xs font-semibold tracking-[0.2em] text-white/80">{label}</p>
                          {detailPayload && <p className="text-[11px] text-white/60 mt-0.5">{detailPayload}</p>}
                        </div>
                        {stepIdx < diagram.latest.steps.length - 1 && <span className="text-white/50 text-lg">→</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Plan history</p>
                  <ol className="list-decimal pl-5 text-xs text-white/70 space-y-1">
                    {diagram.history.map((entry, idx) => {
                      const summaryTools = entry.steps.map((s) => s.tool ?? s.action ?? "step").join(" → ");
                      const entryTime = toTimeLabel(entry.createdAt) || "just now";
                      const entryLabel = idx === 0 ? "Latest" : `Run ${idx + 1}`;
                      return (
                        <li key={`${diagram.cauldronId}-history-${idx}`}>
                          <span className="font-semibold text-white/80">{entryLabel}</span> · {entryTime} · {summaryTools}
                        </li>
                      );
                    })}
                  </ol>
                  {diagram.history.length > 1 && (
                    <ul className="list-disc pl-5 text-[11px] text-white/60 space-y-1">
                      {diagram.history.slice(1).map((entry, idx) => {
                        const entryTime = toTimeLabel(entry.createdAt) || "just now";
                        const detail =
                          entry.steps[0]?.summary ||
                          entry.steps.map((step) => step.summary || step.tool || "step").join(" / ");
                        return (
                          <li key={`${diagram.cauldronId}-prior-${idx}`}>
                            {entryTime}: {detail}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pt-4 border-t border-dashed border-white/10 text-sm text-white/60">
          No Nemotron plans yet this session.
        </div>
      )}
    </div>
  );
}
