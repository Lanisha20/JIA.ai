import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getOverview } from "../lib/api";
import { Overview } from "../types";

import Header from "../components/Header";
import PotionMap from "../components/PotionMap";
import AlertsPanel from "../components/AlertsPanel";
import LogsTable from "../components/LogsTable";
import ForecastCard from "../components/ForecastCard";
import AgentTrace from "../components/AgentTrace";
import ActionsPanel from "../components/ActionsPanel";

const Poyo = dynamic(() => import("../components/Poyo"), { ssr: false });
const Deer = dynamic(() => import("../components/Deer"), { ssr: false });

export default function Home() {
  const [data, setData] = useState<Overview | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await getOverview();
      setData(res);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    }
  };

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, 5000);
    return () => clearInterval(id);
  }, []);

  const findings = data?.findings ?? [];
  const drains = data?.drain_events ?? [];
  const matches = data?.matches ?? [];
  const trace = data?.trace ?? [];

  const primaryForecast = (() => {
    if (!data?.forecast) return undefined;
    const f: any = data.forecast;
    if (f.series) return f;
    if (typeof f === "object") return Object.values(f as Record<string, any>)[0];
    return undefined;
  })();

  return (
    <main className="container-ppd">
      <Header />
      <Deer />
      <Poyo />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE — Map + Logs + Alerts + Forecast */}
        <div className="lg:col-span-8 min-w-0 space-y-6">
          {data && <PotionMap data={data} />}
          {data && <LogsTable matches={matches} drains={drains} />}
          {data && <AlertsPanel findings={findings} />}
          {data && <ForecastCard title="Potion Level Forecast" f={primaryForecast} />}
        </div>

        {/* RIGHT SIDE — Actions + Trace */}
        <div className="lg:col-span-4 min-w-0 space-y-6">
          <ActionsPanel onRefresh={fetchOverview} />
          {data && <AgentTrace trace={trace} />}
        </div>
      </section>

      <div className="h-24" />
    </main>
  );
}
