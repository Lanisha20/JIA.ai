import { useEffect, useState } from "react";
import { getOverview } from "../lib/api";
import { Overview } from "../types";

import Header from "../components/Header";
import PotionMap from "../components/PotionMap";
import AlertsPanel from "../components/AlertsPanel";
import LogsTable from "../components/LogsTable";
import ForecastCard from "../components/ForecastCard";
import AgentTrace from "../components/AgentTrace";
import Poyo from "../components/Poyo";
import Deer from "../components/Deer";

export default function Home() {
    const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    getOverview().then(setData);
    const id = setInterval(() => getOverview().then(setData), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="container-ppd">
      <Header />
      <Deer />
      <Poyo />

      <section className="grid-ppd">
        <div className="lg:col-span-2 space-y-6">
          {data && <PotionMap data={data} />}
          {data && <LogsTable matches={data.matches} drains={data.drain_events} />}
        </div>
        <div className="space-y-6">
          {data && <AlertsPanel findings={data.findings} />}
          {data && <ForecastCard title="Potion Level Forecast" f={(data.forecast as any)["C3"] || (data.forecast as any)} />}
          {data && <AgentTrace trace={data.trace || []} />}
        </div>
      </section>

      <div className="h-24" />
    </main>
  );
}
