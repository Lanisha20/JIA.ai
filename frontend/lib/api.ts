import {
  Cauldron,
  DrainEvent,
  Finding,
  Forecast,
  MatchRow,
  NetworkLink,
  Overview,
  TraceStep,
} from "../types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function polarPosition(index: number, total: number) {
  if (total === 0) return { x: 50, y: 50 };
  const angle = (index / total) * Math.PI * 2;
  const radius = 35;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

function adaptState(state: any, findings: Finding[], forecast: Forecast | null): Overview {
  const cauldronRows = Array.isArray(state.cauldrons) ? state.cauldrons : [];
  const drainRows = Array.isArray(state.drain_events) ? state.drain_events : [];
  const matchRows = Array.isArray(state.matches) ? state.matches : [];
  const traceRows = Array.isArray(state.agent_trace) ? state.agent_trace : [];

  const cauldrons: Cauldron[] = cauldronRows.map((c: any, idx: number) => {
    const coords = polarPosition(idx, cauldronRows.length);
    const meta = c.metadata || {};
    return {
      id: c.cauldron_id,
      name: c.name || c.cauldron_id,
      vmax: c.max_volume ?? meta.maxVolume ?? null,
      fill_rate: c.fill_rate ?? meta.fillRate ?? null,
      last_volume: c.volume ?? null,
      fill_percent: c.fill_percent ?? null,
      x: meta.x ?? coords.x,
      y: meta.y ?? coords.y,
    };
  });

  const drains: DrainEvent[] = drainRows.map((d: any) => ({
    id: String(d.event_id),
    cauldron_id: d.cauldron_id,
    t_start: d.detected_at,
    t_end: d.detected_at,
    true_volume: Number(d.estimated_loss ?? 0),
    level_drop: Number(d.estimated_loss ?? 0),
  }));

  const matches: MatchRow[] = matchRows.map((m: any, idx: number) => ({
    id: String(m.match_id ?? idx),
    ticket_id: m.ticket ?? "unknown",
    drain_event_id: String(m.drain_event_id ?? m.match_id ?? idx),
    diff_volume: Number(m.discrepancy ?? 0),
    status: m.status ?? "pending",
  }));

  const fallbackNow = Date.now();
  const trace: TraceStep[] = traceRows.map((row: any, idx: number) => {
    const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean).map(String) : [];
    const summaryBits = [row.summary, row.description, row.note].filter(Boolean);
    const fallbackSummary = [row.agent, row.action, row.tool, ...tags].filter(Boolean).join(" · ");
    const agent = row.agent ?? "nemotron";
    const createdAt =
      row.created_at ??
      row.timestamp ??
      row.logged_at ??
      new Date(fallbackNow - (traceRows.length - idx) * 60_000).toISOString();

    return {
      step: row.step ?? idx + 1,
      tool: row.action ?? row.tool ?? agent ?? `step-${idx + 1}`,
      summary: summaryBits[0] || fallbackSummary || "running tool",
      agent,
      tags,
      created_at: createdAt,
      action: row.action ?? row.tool ?? undefined,
    };
  });

  const forecastBucket = forecast && cauldrons.length
    ? { [cauldrons[0].id]: forecast }
    : forecast;

  const network = state.network || { nodes: [], links: [] };
  const normalizedLinks: NetworkLink[] = (network.links || []).map((link: any) => ({
    source: link.source,
    target: link.target,
    style: link.style as NetworkLink["style"],
  }));

  return {
    date: new Date().toISOString(),
    cauldrons,
    network: { nodes: network.nodes, links: normalizedLinks },
    drain_events: drains,
    matches,
    findings,
    forecast: forecastBucket ?? null,
    trace,
  };
}

async function fetchFindings(): Promise<Finding[]> {
  try {
    const res = await fetch(`${API_BASE}/tools/audit`, { method: "POST" });
    if (!res.ok) return [];
    const body = await res.json();
    return body.findings ?? [];
  } catch {
    return [];
  }
}

async function fetchForecast(cauldronId?: string): Promise<Forecast | null> {
  if (!cauldronId) return null;
  try {
    const res = await fetch(`${API_BASE}/tools/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cauldron_id: cauldronId, horizon_minutes: 240 }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return {
      overflow_eta: body.overflow_eta ?? null,
      series: (body.series ?? body.forecast ?? body?.result ?? []).map((entry: any) => [entry.ts || entry[0], entry.fill_percent ?? entry.volume ?? entry[1]]),
    } as Forecast;
  } catch {
    return null;
  }
}

export async function getOverview(): Promise<Overview> {
  try {
    const stateRes = await fetch(`${API_BASE}/state/overview`, { cache: "no-store" });
    if (!stateRes.ok) throw new Error("state");
    const state = await stateRes.json();
    const cauldronId = Array.isArray(state.cauldrons) && state.cauldrons[0]?.cauldron_id;
    const [findings, forecast] = await Promise.all([
      fetchFindings(),
      fetchForecast(cauldronId),
    ]);
    return adaptState(state, findings, forecast);
  } catch (error) {
    const fallback = await fetch("/overview.json", { cache: "no-store" });
    return fallback.json();
  }
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function runDetect(params?: { cauldron_ids?: string[]; minutes?: number; persist?: boolean }) {
  return postJson("/tools/detect", {
    minutes: 180,
    persist: true,
    ...params,
  });
}

export async function runMatch(params?: { days?: number; persist?: boolean }) {
  return postJson("/tools/match", {
    days: 3,
    persist: true,
    ...params,
  });
}

export async function runAudit() {
  return postJson("/tools/audit", {});
}

export async function runForecast(params: { cauldron_id: string; horizon_minutes?: number }) {
  return postJson<Forecast>("/tools/forecast", {
    horizon_minutes: 240,
    ...params,
  });
}

export async function runPlanner(params: { goal: string; context?: Record<string, any>; dry_run?: boolean }) {
  return postJson("/planner/run", {
    dry_run: false,
    context: {},
    ...params,
  });
}
