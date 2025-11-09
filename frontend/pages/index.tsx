import { useEffect, useState } from "react";
import { getOverview } from "../lib/api";
import { Overview } from "../types";

import Header from "../components/Header";
import PotionMap from "../components/PotionMap";
import AlertsPanel from "../components/AlertsPanel";
import LogsTable from "../components/LogsTable";
import ForecastCard from "../components/ForecastCard";
import AgentTrace from "../components/AgentTrace";
import ActionsPanel from "../components/ActionsPanel";
import Poyo from "../components/Poyo";
import Deer from "../components/Deer";

export default function Home() {
  const [data, setData] = useState<Overview | null>(null);

  const fetchOverview = () => getOverview().then(setData);

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
    const forecast: any = data.forecast;
    if (forecast.series) return forecast;
    if (typeof forecast === "object") {
      const values = Object.values(forecast as Record<string, any>);
      return values[0];
    }
    return undefined;
  })();

  return (
    <main className="container-ppd">
      <Header />
      <Deer />
      <Poyo />

      <section className="grid-ppd">
        <div className="lg:col-span-2 space-y-6">
          {data && <PotionMap data={data} />}
          {data && <LogsTable matches={matches} drains={drains} />}
        </div>
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <ActionsPanel onRefresh={fetchOverview} />
            {data && <AgentTrace trace={trace} />}
          </div>
          {data && <AlertsPanel findings={findings} />}
          {data && <ForecastCard title="Potion Level Forecast" f={primaryForecast} />}
        </div>
      </section>

      <div className="h-24" />
    </main>
  );
}
