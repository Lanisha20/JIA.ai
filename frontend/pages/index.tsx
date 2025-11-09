import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getOverview, runAudit, runDetect, runForecast, runMatch, runPlanner } from "../lib/api";
import { Cauldron, DrainEvent, Finding, Forecast, MatchRow, Overview } from "../types";

import Header from "../components/Header";
import PotionMap from "../components/PotionMap";
import AlertsPanel from "../components/AlertsPanel";
import LogsTable from "../components/LogsTable";
import ForecastCard from "../components/ForecastCard";
import AgentTrace from "../components/AgentTrace";
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
  const [demoDrains, setDemoDrains] = useState<DrainEvent[]>([]);
  const [demoMatches, setDemoMatches] = useState<MatchRow[]>([]);
  const [demoFindings, setDemoFindings] = useState<Finding[]>([]);
  const [customForecast, setCustomForecast] = useState<Forecast | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<ActionKey, ActionState>>({
    detect: "idle",
    match: "idle",
    planner: "idle",
    audit: "idle",
    forecast: "idle",
  });

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
    async (key: ActionKey, task: () => Promise<void>) => {
      setActionStatus((prev) => ({ ...prev, [key]: "running" }));
      try {
        const result = await task();
        setActionStatus((prev) => ({ ...prev, [key]: "success" }));
        await fetchOverview();
        setTimeout(() => {
          setActionStatus((prev) => ({ ...prev, [key]: "idle" }));
        }, 2500);
        return result;
      } catch (error) {
        console.error(`${key} action failed`, error);
        setActionStatus((prev) => ({ ...prev, [key]: "error" }));
        setTimeout(() => {
          setActionStatus((prev) => ({ ...prev, [key]: "idle" }));
        }, 4000);
      }
    },
    [fetchOverview],
  );

  const mapData = useMemo(() => {
    if (!data) return null;
    const cauldronMap = new Map<string, Cauldron>();
    data.cauldrons.forEach((c) => cauldronMap.set(c.id, { ...c }));
    customNodes.forEach((node) => cauldronMap.set(node.id, { ...cauldronMap.get(node.id), ...node }));
    const mergedCauldrons = Array.from(cauldronMap.values());

    const nodeMap = new Map<string, Cauldron>();
    (data.network?.nodes ?? []).forEach((node) => nodeMap.set(node.id, { ...node }));
    customNodes.forEach((node) => nodeMap.set(node.id, { ...node }));
    const mergedNetworkNodes = Array.from(nodeMap.values());

    const linkMap = new Map<string, { source: string; target: string }>();
    (data.network?.links ?? []).forEach((link) => linkMap.set(`${link.source}->${link.target}`, link));
    customLinks.forEach((link) => linkMap.set(`${link.source}->${link.target}`, link));
    const mergedLinks = Array.from(linkMap.values());

    return {
      ...data,
      cauldrons: mergedCauldrons,
      network: {
        nodes: mergedNetworkNodes,
        links: mergedLinks,
      },
    };
  }, [data, customNodes, customLinks]);

  const mapSource = mapData ?? data;

  const findings = [...(data?.findings ?? []), ...demoFindings];
  const drains = [...(data?.drain_events ?? []), ...demoDrains];
  const matches = [...(data?.matches ?? []), ...demoMatches];
  const trace = data?.trace ?? [];

  const baseForecast = (() => {
    if (!data?.forecast) return undefined;
    const f: any = data.forecast;
    if (f.series) return f;
    if (typeof f === "object") return Object.values(f as Record<string, any>)[0];
    return undefined;
  })();

  const primaryForecast = customForecast ?? baseForecast;

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
    if (draft.linkTarget) {
      setCustomLinks((prev) => {
        const key = `${id}->${draft.linkTarget}`;
        const filtered = prev.filter((link) => `${link.source}->${link.target}` !== key);
        return [...filtered, { source: id, target: draft.linkTarget as string }];
      });
    }
  };

  const pickCauldronId = () => {
    const sourceList = mapSource?.cauldrons ?? customNodes;
    return sourceList[0]?.id ?? `C-demo-${Math.floor(Math.random() * 900 + 100)}`;
  };

  const handleAddDemoDrain = () => {
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
  };

  const handleAddDemoAlert = () => {
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
  };

  const handleAddDemoForecast = () => {
    const start = Date.now();
    const series: [string, number][] = Array.from({ length: 6 }).map((_, idx) => [
      new Date(start + idx * 15 * 60 * 1000).toISOString(),
      Math.round(380 + idx * 35 + Math.random() * 25),
    ]);
    setCustomForecast({
      overflow_eta: new Date(start + 90 * 60 * 1000).toISOString(),
      series,
    });
  };

  const handleClearDemo = () => {
    setDemoDrains([]);
    setDemoMatches([]);
    setDemoFindings([]);
    setCustomForecast(null);
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

  const handleRunDetect = useCallback(() => runAction("detect", async () => {
    await runDetect();
  }), [runAction]);

  const handleRunMatch = useCallback(() => runAction("match", async () => {
    await runMatch();
  }), [runAction]);

  const handleRunAudit = useCallback(() => runAction("audit", async () => {
    await runAudit();
  }), [runAction]);

  const handleRunPlanner = useCallback(() => runAction("planner", async () => {
    const goal = "Balance drains and tickets across the potion network.";
    await runPlanner({
      goal,
      context: {
        cauldron_id: mapSource?.cauldrons?.[0]?.id,
      },
      dry_run: false,
    });
  }), [mapSource, runAction]);

  const handleRunForecast = useCallback(() => {
    const cauldronId = mapSource?.cauldrons?.[0]?.id;
    return runAction("forecast", async () => {
      if (!cauldronId) {
        throw new Error("No cauldron available for forecasting.");
      }
      const forecast = await runForecast({ cauldron_id: cauldronId, horizon_minutes: 240 });
      setCustomForecast(forecast);
    });
  }, [mapSource, runAction, setCustomForecast]);

  return (
    <main className="container-ppd">
      <Header />
      <Deer />
      <Poyo />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE — Map + Logs + Alerts + Forecast */}
        <div className="lg:col-span-8 min-w-0 space-y-6">
          {mapSource && <PotionMap data={mapSource} />}
          <NetworkComposer
            existingIds={composerExistingIds}
            linkTargets={composerLinkTargets}
            customNodes={customNodes}
            onAdd={handleAddNode}
          />
          <LogsTable matches={matches} drains={drains} />
          <AlertsPanel findings={findings} />
          <ForecastCard title="Potion Level Forecast" f={primaryForecast} />
        </div>

        {/* RIGHT SIDE — Actions + Trace */}
        <div className="lg:col-span-4 min-w-0 space-y-6">
          <ActionsPanel
            onRefresh={fetchOverview}
            onRunDetect={handleRunDetect}
            onRunMatch={handleRunMatch}
            onRunPlanner={handleRunPlanner}
            onRunAudit={handleRunAudit}
            onRunForecast={handleRunForecast}
            status={actionStatus}
          />
          <DemoLab
            onAddDrain={handleAddDemoDrain}
            onAddAlert={handleAddDemoAlert}
            onAddForecast={handleAddDemoForecast}
            onClear={handleClearDemo}
            stats={{ drains: demoDrains.length, alerts: demoFindings.length, forecastActive: Boolean(customForecast) }}
          />
          {data && <AgentTrace trace={trace} />}
        </div>
      </section>

      <div className="h-24" />
    </main>
  );
}
