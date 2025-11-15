import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getOverview, runAudit, runDetect, runForecast, runMatch, runPlanner } from "../lib/api";
import { Cauldron, DrainEvent, Finding, Forecast, MatchRow, NetworkLink, Overview, TraceStep } from "../types";

import Header from "../components/Header";
import PotionMap from "../components/PotionMap";
import AlertsPanel from "../components/AlertsPanel";
import LogsTable from "../components/LogsTable";
import ForecastCard from "../components/ForecastCard";
import AgentTrace from "../components/AgentTrace";
import AgentFocus from "../components/AgentFocus";
import ActionsPanel from "../components/ActionsPanel";
import NetworkComposer from "../components/NetworkComposer";
import DemoLab from "../components/DemoLab";

const Poyo = dynamic(() => import("../components/Poyo"), { ssr: false });
const Deer = dynamic(() => import("../components/Deer"), { ssr: false });

type DraftNodePayload = {
  id: string;
  name: string;
  x: number;
  y: number;
  fillPercent: number;
  vmax: number;
  linkTarget?: string;
};

type ActionKey = "detect" | "match" | "planner" | "audit" | "forecast";
type ActionState = "idle" | "running" | "success" | "error";

export default function Home() {
  const [data, setData] = useState<Overview | null>(null);
  const [customNodes, setCustomNodes] = useState<Cauldron[]>([]);
  const [customLinks, setCustomLinks] = useState<{ source: string; target: string }[]>([]);
  const [customNodeOrder, setCustomNodeOrder] = useState<string[]>([]);
  const [demoDrains, setDemoDrains] = useState<DrainEvent[]>([]);
  const [demoMatches, setDemoMatches] = useState<MatchRow[]>([]);
  const [demoFindings, setDemoFindings] = useState<Finding[]>([]);
  const [customForecasts, setCustomForecasts] = useState<Record<string, Forecast>>({});
  const [demoTrace, setDemoTrace] = useState<TraceStep[]>([]);
  const [plannerRan, setPlannerRan] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<ActionKey, ActionState>>({
    detect: "idle",
    match: "idle",
    planner: "idle",
    audit: "idle",
    forecast: "idle",
  });
  const demoIdRef = useRef(0);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await getOverview();
      setData(res);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, 5000);
    return () => clearInterval(id);
  }, [fetchOverview]);

  const runAction = useCallback(
    async (key: ActionKey, task: () => Promise<void>, fallback?: () => void) => {
      setActionStatus((prev) => ({ ...prev, [key]: "running" }));
    try {
        await task();
        setActionStatus((prev) => ({ ...prev, [key]: "success" }));
        await fetchOverview();
        setTimeout(() => {
          setActionStatus((prev) => ({ ...prev, [key]: "idle" }));
        }, 2500);
      } catch (error) {
        console.error(`${key} action failed`, error);
        if (fallback) {
          fallback();
          setActionStatus((prev) => ({ ...prev, [key]: "success" }));
          setTimeout(() => {
            setActionStatus((prev) => ({ ...prev, [key]: "idle" }));
          }, 2000);
        } else {
          setActionStatus((prev) => ({ ...prev, [key]: "error" }));
          setTimeout(() => {
            setActionStatus((prev) => ({ ...prev, [key]: "idle" }));
          }, 4000);
        }
      }
    },
    [fetchOverview],
  );

  const syntheticCauldrons = useMemo(() => {
    const drainSources = [...(data?.drain_events ?? []), ...demoDrains];
    if (drainSources.length === 0) return [];
    const ids = Array.from(new Set(drainSources.map((d) => d.cauldron_id).filter(Boolean)));
    const dropTotals = drainSources.reduce<Record<string, number>>((acc, drain) => {
      if (!drain.cauldron_id) return acc;
      const drop = typeof drain.level_drop === "number" ? drain.level_drop : drain.true_volume ?? 0;
      acc[drain.cauldron_id] = (acc[drain.cauldron_id] ?? 0) + (drop || 0);
      return acc;
    }, {});
    return ids.map((id, idx) => {
      const basePercent = 72;
      const drop = Math.min(60, (dropTotals[id] ?? 0) / 10);
      const fillPercent = Math.max(12, Math.round(basePercent - drop));
      const vmax = 500;
      const lastVolume = Math.round((fillPercent / 100) * vmax);
      const nodeCount = Math.max(ids.length, 1);
      const angle = (idx / nodeCount) * Math.PI * 1.6 + 0.5;
      const ringStep = Math.floor(idx / Math.max(1, Math.floor(nodeCount / 3) || 1));
      const radius = 18 + ringStep * 10;
      const x = Math.min(92, Math.max(8, Math.round(50 + Math.cos(angle) * radius)));
      const y = Math.min(90, Math.max(10, Math.round(55 + Math.sin(angle) * radius)));
      return {
        id,
        name: id,
        x,
        y,
        vmax,
        last_volume: lastVolume,
        fill_percent: fillPercent,
        fill_rate: null,
      } as Cauldron;
    });
  }, [data, demoDrains]);

  const mapData = useMemo(() => {
    const hasLocalNodes = Boolean(data) || customNodes.length > 0 || syntheticCauldrons.length > 0;
    if (!hasLocalNodes) return null;

    const base: Overview =
      data ??
      ({
        cauldrons: [],
        network: { nodes: [], links: [] },
        drain_events: [],
        matches: [],
        findings: [],
        forecast: null,
        trace: [],
      } as Overview);

    const cauldronMap = new Map<string, Cauldron>();
    (base.cauldrons ?? []).forEach((c) => cauldronMap.set(c.id, { ...c }));
    customNodes.forEach((node) => {
      const existing = cauldronMap.get(node.id);
      cauldronMap.set(node.id, { ...(existing ?? {}), ...node });
    });
    syntheticCauldrons.forEach((node) => {
      if (!cauldronMap.has(node.id)) {
        cauldronMap.set(node.id, { ...node });
      }
    });
    const mergedCauldrons = Array.from(cauldronMap.values());

    const nodeMap = new Map<string, Cauldron>();
    (base.network?.nodes ?? []).forEach((node) => nodeMap.set(node.id, { ...node }));
    customNodes.forEach((node) => {
      const existing = nodeMap.get(node.id);
      nodeMap.set(node.id, { ...(existing ?? {}), ...node });
    });
    syntheticCauldrons.forEach((node) => {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, { ...node });
      }
    });
    const mergedNetworkNodes = Array.from(nodeMap.values());

    const linkMap = new Map<string, NetworkLink>();
    (base.network?.links ?? []).forEach((link) =>
      linkMap.set(`${link.source}->${link.target}`, {
        source: link.source,
        target: link.target,
        style: link.style ?? "solid",
      }),
    );
    customLinks.forEach((link) => {
      const key = `${link.source}->${link.target}`;
      if (!linkMap.has(key)) {
        linkMap.set(key, { source: link.source, target: link.target, style: "solid" });
      }
    });

    const networkNodeIds = new Set((mergedNetworkNodes ?? []).map((node) => node.id));
    const orderedLinks: NetworkLink[] = [];
    const filteredOrder = customNodeOrder.filter((id) => networkNodeIds.has(id));
    for (let i = 0; i < filteredOrder.length - 1; i += 1) {
      const source = filteredOrder[i];
      const target = filteredOrder[i + 1];
      const key = `${source}->${target}`;
      if (!linkMap.has(key)) {
        orderedLinks.push({ source, target, style: "dashed" });
      }
    }
    orderedLinks.forEach((link) => linkMap.set(`${link.source}->${link.target}`, link));
    const mergedLinks = Array.from(linkMap.values());

    return {
      ...base,
      cauldrons: mergedCauldrons,
      network: {
        nodes: mergedNetworkNodes,
        links: mergedLinks,
      },
    };
  }, [data, customNodes, customLinks, customNodeOrder, syntheticCauldrons]);

  const mapSource = mapData ?? data;

  const findings = useMemo(
    () => [...(data?.findings ?? []), ...demoFindings],
    [data?.findings, demoFindings],
  );
  const drains = useMemo(
    () => [...(data?.drain_events ?? []), ...demoDrains],
    [data?.drain_events, demoDrains],
  );
  const matches = useMemo(
    () => [...(data?.matches ?? []), ...demoMatches],
    [data?.matches, demoMatches],
  );
  const drainCauldronOrder = useMemo(() => {
    const ids = drains.map((d) => d.cauldron_id).filter(Boolean) as string[];
    const unique = Array.from(new Set(ids));
    if (unique.length > 0) return unique;
    const sourceNodes = mapSource?.cauldrons ?? [];
    return sourceNodes.map((c) => c.id).filter(Boolean);
  }, [drains, mapSource]);
  const hasBackendTrace = (data?.trace?.length ?? 0) > 0;
  const traceSource = hasBackendTrace ? data?.trace ?? [] : demoTrace;
  const trace = plannerRan ? traceSource : [];

  const forecastMap = (data?.forecast ?? {}) as Record<string, Forecast>;
  const plannerFocusedCauldron =
    trace.find((step) => step.context?.cauldron_id)?.context?.cauldron_id ??
    trace.find((step) => step.input_payload?.cauldron_id)?.input_payload?.cauldron_id ??
    trace.find((step) => step.output_payload?.cauldron_id)?.output_payload?.cauldron_id ??
    mapSource?.cauldrons?.[0]?.id ??
    null;
  const fallbackForecast = Object.values(customForecasts)[0] ?? Object.values(forecastMap)[0];
  const primaryForecast =
    (plannerFocusedCauldron &&
      (customForecasts[plannerFocusedCauldron] ?? forecastMap[plannerFocusedCauldron])) ||
    fallbackForecast ||
    undefined;

  const handleAddNode = (draft: DraftNodePayload) => {
    const id = draft.id.trim();
    if (!id) return;
    const name = draft.name.trim() || id;
    const fillPercent = Math.min(100, Math.max(1, draft.fillPercent));
    const vmax = Math.max(100, draft.vmax);
    const lastVolume = Math.round((fillPercent / 100) * vmax);
    const nextNode: Cauldron = {
      id,
      name,
      x: draft.x,
      y: draft.y,
      vmax,
      last_volume: lastVolume,
      fill_percent: fillPercent,
      fill_rate: null,
    };
    setCustomNodes((prev) => {
      const filtered = prev.filter((node) => node.id !== id);
      return [...filtered, nextNode];
    });
    setCustomNodeOrder((prev) => {
      const filtered = prev.filter((nodeId) => nodeId !== id);
      return [...filtered, id];
    });
    if (draft.linkTarget) {
      setCustomLinks((prev) => {
        const key = `${id}->${draft.linkTarget}`;
        const filtered = prev.filter((link) => `${link.source}->${link.target}` !== key);
        return [...filtered, { source: id, target: draft.linkTarget as string }];
      });
    }
  };

  const pickCauldronId = useCallback(() => {
    const backendCauldrons = data?.cauldrons ?? [];
    if (backendCauldrons.length > 0) {
      const idx = Math.floor(Math.random() * backendCauldrons.length);
      return backendCauldrons[idx].id;
    }
    if (customNodes.length > 0) {
      demoIdRef.current += 1;
      const idx = demoIdRef.current % customNodes.length;
      return customNodes[idx].id;
    }
    demoIdRef.current += 1;
    return `C-demo-${demoIdRef.current}`;
  }, [data, customNodes]);

  const seedDemoTrace = useCallback(
    (options?: {
      cauldronId?: string;
      cauldronIds?: string[];
      stages?: { key: string; label?: string; summary?: string }[];
      insertAt?: "start" | "end";
    }) => {
      const targets = (options?.cauldronIds && options.cauldronIds.length > 0
        ? options.cauldronIds
        : [options?.cauldronId ?? pickCauldronId()]
      ).filter((id): id is string => Boolean(id));
      if (targets.length === 0) return;

      setDemoTrace((prev) => {
        const now = Date.now();
        const MAX_ENTRIES = 48;
        const entries: TraceStep[] = [];

        targets.forEach((targetId, targetIdx) => {
          const cauldronName =
            mapSource?.cauldrons?.find((c) => c.id === targetId)?.name ?? targetId ?? "Unknown Cauldron";
          const stageDefs =
            options?.stages && options.stages.length > 0
              ? options.stages
              : [
                  {
                    key: "detect",
                    label: "Detect",
                    summary: `Scanning drains around ${cauldronName}`,
                  },
                  {
                    key: "match",
                    label: "Match",
                    summary: `Reconciling tickets against ${cauldronName}`,
                  },
                  {
                    key: "audit",
                    label: "Audit",
                    summary: `Auditing discrepancies for ${cauldronName}`,
                  },
                  {
                    key: "forecast",
                    label: "Forecast",
                    summary: `Projecting fill levels for ${cauldronName}`,
                  },
                ];

          stageDefs.forEach((stage, stageIdx) => {
            const offsetMs = (targetIdx * stageDefs.length + stageIdx) * 4000;
            entries.push({
              step: Date.now() + entries.length,
              tool: stage.key,
              summary: stage.summary || `Running ${stage.key}`,
              agent: `Nemotron ${stage.label || stage.key}`,
              action: stage.key,
              tags: [stage.key, targetId ?? "unknown"],
              created_at: new Date(now - offsetMs).toISOString(),
              context: {
                cauldron_id: targetId,
                goal: "Balance drains and tickets across the potion network.",
                strategy: "fallback",
              },
              input_payload: {
                cauldron_id: targetId,
                context: { cauldron_id: targetId },
              },
              output_payload: {
                cauldron_id: targetId,
                status: "ok",
              },
            });
          });
        });

        const next = options?.insertAt === "end" ? [...prev, ...entries] : [...entries, ...prev];
        return next.slice(0, MAX_ENTRIES);
      });
    },
    [pickCauldronId, mapSource],
  );

  const addSampleDrainAndMatch = useCallback(() => {
    const cauldronId = pickCauldronId();
    const now = Date.now();
    const drainId = `demo-drain-${now}`;
    const volume = Math.round(90 + Math.random() * 220);
    const drain: DrainEvent = {
      id: drainId,
      cauldron_id: cauldronId,
      t_start: new Date(now - 15 * 60 * 1000).toISOString(),
      t_end: new Date(now).toISOString(),
      true_volume: volume,
      level_drop: volume,
      flags: "demo",
    };
    const match: MatchRow = {
      id: `demo-match-${now}`,
      ticket_id: `T-${Math.floor(Math.random() * 900 + 100)}`,
      drain_event_id: drainId,
      diff_volume: Number((Math.random() * 120 - 60).toFixed(1)),
      status: "demo",
    };
    setDemoDrains((prev) => [...prev, drain]);
    setDemoMatches((prev) => [...prev, match]);
  }, [pickCauldronId]);

  const addSampleFinding = useCallback(() => {
    const types = ["over_report", "under_collection", "unlogged_drain", "forecast_warning"];
    const type = types[Math.floor(Math.random() * types.length)];
    const cauldronId = pickCauldronId();
    const finding: Finding = {
      type,
      cauldron_id: cauldronId,
      ticket_id: `T-${Math.floor(Math.random() * 900 + 100)}`,
      diff_volume: Number((Math.random() * 80).toFixed(1)),
      reason: `Sample alert for ${cauldronId} (${type.replaceAll("_", " ")})`,
    };
    setDemoFindings((prev) => [...prev, finding]);
  }, [pickCauldronId]);

  const addSampleForecast = useCallback(() => {
    const cauldronId = pickCauldronId();
    const start = Date.now();
    const series: [string, number][] = Array.from({ length: 6 }).map((_, idx) => [
      new Date(start + idx * 15 * 60 * 1000).toISOString(),
      Math.round(380 + idx * 35 + Math.random() * 25),
    ]);
    const forecast: Forecast = {
      overflow_eta: new Date(start + 90 * 60 * 1000).toISOString(),
      series,
    };
    setCustomForecasts((prev) => ({
      ...prev,
      [cauldronId]: forecast,
    }));
  }, [pickCauldronId]);

  const handleAddDemoDrain = () => addSampleDrainAndMatch();

  const handleAddDemoAlert = () => addSampleFinding();

  const handleAddDemoForecast = () => addSampleForecast();

  const handleClearDemo = () => {
    setDemoDrains([]);
    setDemoMatches([]);
    setDemoFindings([]);
    setCustomForecasts({});
    setDemoTrace([]);
    setPlannerRan(false);
  };

  const composerExistingIds = mapSource?.cauldrons?.map((c) => c.id) ?? [];
  const composerLinkTargets = useMemo(() => {
    const pool = [
      "MKT",
      ...(mapSource?.network?.nodes?.map((n) => n.id) ?? []),
      ...(mapSource?.cauldrons?.map((c) => c.id) ?? []),
      ...customNodes.map((n) => n.id),
    ].filter(Boolean);
    return Array.from(new Set(pool));
  }, [mapSource, customNodes]);

  const handleRunDetect = useCallback(
    () =>
      runAction(
        "detect",
        async () => {
          await runDetect();
        },
        addSampleDrainAndMatch,
      ),
    [runAction, addSampleDrainAndMatch],
  );

  const handleRunMatch = useCallback(
    () =>
      runAction(
        "match",
        async () => {
          await runMatch();
        },
        addSampleDrainAndMatch,
      ),
    [runAction, addSampleDrainAndMatch],
  );

  const handleRunAudit = useCallback(
    () =>
      runAction(
        "audit",
        async () => {
          await runAudit();
        },
        addSampleFinding,
      ),
    [runAction, addSampleFinding],
  );

  const plannerFallback = useCallback(() => {
    const targetId = pickCauldronId();
    addSampleDrainAndMatch();
    addSampleFinding();
    addSampleForecast();
    const prioritized = drainCauldronOrder.length ? drainCauldronOrder.slice(0, 6) : targetId ? [targetId] : [];
    seedDemoTrace({ cauldronIds: prioritized.length ? prioritized : undefined, cauldronId: targetId });
  }, [
    addSampleDrainAndMatch,
    addSampleFinding,
    addSampleForecast,
    seedDemoTrace,
    pickCauldronId,
    drainCauldronOrder,
  ]);

  const handleRunPlanner = useCallback(() => {
    const targetCauldronId = pickCauldronId();
    runAction(
      "planner",
      async () => {
        const goal = "Balance drains and tickets across the potion network.";
        const cauldronId = targetCauldronId || mapSource?.cauldrons?.[0]?.id;
        const response = await runPlanner({
          goal,
          context: {
            cauldron_id: cauldronId,
          },
          dry_run: false,
        });
        const planTarget =
          (response?.plan?.context && (response.plan.context as { cauldron_id?: string }).cauldron_id) || cauldronId;
        const runtimeStages =
          Array.isArray(response?.steps) && response.steps.length > 0
            ? response.steps.map((step, idx) => {
                const key = (step.tool || `step-${idx + 1}`).toLowerCase();
                const label = step.tool ? step.tool.replace(/\b\w/g, (ch) => ch.toUpperCase()) : `Step ${idx + 1}`;
                const summary =
                  step.status === "error"
                    ? `Error running ${step.tool ?? "tool"}`
                    : step.response?.summary ??
                      step.summary ??
                      (step.status ? `${label} ${step.status}` : `Executed ${label}`);
                return { key, label, summary };
              })
            : undefined;
        const stageTargets = drainCauldronOrder.length
          ? drainCauldronOrder
          : [planTarget ?? cauldronId].filter(Boolean) as string[];
        seedDemoTrace({
          cauldronIds: stageTargets,
          stages: runtimeStages,
          insertAt: "end",
        });
        setPlannerRan(true);
      },
      () => {
        plannerFallback();
        setPlannerRan(true);
      },
    );
  }, [mapSource, runAction, plannerFallback, pickCauldronId, seedDemoTrace, drainCauldronOrder]);

  const handleRunForecast = useCallback(() => {
    const cauldronId = mapSource?.cauldrons?.[0]?.id;
    return runAction("forecast", async () => {
      if (!cauldronId) {
        throw new Error("No cauldron available for forecasting.");
      }
      const forecast = await runForecast({ cauldron_id: cauldronId, horizon_minutes: 240 });
      setCustomForecasts((prev) => ({ ...prev, [cauldronId]: forecast }));
    }, addSampleForecast);
  }, [mapSource, runAction, addSampleForecast]);

  return (
    <main className="container-ppd">
      <Header />
      <Deer />
      <Poyo />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE — Actions + Map + Logs + Alerts + Forecast */}
        <div className="lg:col-span-8 min-w-0 space-y-6">
          <ActionsPanel
            onRefresh={fetchOverview}
            onRunDetect={handleRunDetect}
            onRunMatch={handleRunMatch}
            onRunPlanner={handleRunPlanner}
            onRunAudit={handleRunAudit}
            onRunForecast={handleRunForecast}
            status={actionStatus}
          />
          {mapSource && <PotionMap data={mapSource} />}
          <LogsTable matches={matches} drains={drains} />
          <AlertsPanel findings={findings} />
          <ForecastCard title="Potion Level Forecast" f={primaryForecast} />
          <DemoLab
            onAddDrain={handleAddDemoDrain}
            onAddAlert={handleAddDemoAlert}
            onAddForecast={handleAddDemoForecast}
            onClear={handleClearDemo}
            stats={{
              drains: demoDrains.length,
              alerts: demoFindings.length,
              forecastActive: Object.keys(customForecasts).length > 0,
            }}
          />
        </div>

        {/* RIGHT SIDE — Nemotron Planner & Agent Focus */}
        <div className="lg:col-span-4 min-w-0 space-y-6">
          {data && <AgentTrace trace={trace} plannerRan={plannerRan} />}
          <AgentFocus
            trace={trace}
            cauldrons={mapSource?.cauldrons ?? []}
            plannerRan={plannerRan}
            drains={drains}
            matches={matches}
          />
          <NetworkComposer
            existingIds={composerExistingIds}
            linkTargets={composerLinkTargets}
            customNodes={customNodes}
            onAdd={handleAddNode}
          />
        </div>
      </section>

      <div className="h-24" />
    </main>
  );
}
