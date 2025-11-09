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
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "playback">("live");
  const [date, setDate] = useState<string | undefined>(undefined); // YYYY-MM-DD
  const [stamp, setStamp] = useState("");

  const load = async (m = mode, d = date) => {
    try {
      setError(null);
      const out = await getOverview(m, d);
      setData(out);
      setStamp(String(out.stamp ?? new Date().toLocaleTimeString()));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    }
  };

  // Poll in LIVE, stop in PLAYBACK
  useEffect(() => {
    let id: any;
    load();
    if (mode === "live") id = setInterval(() => load("live", undefined), 5000);
    return () => id && clearInterval(id);
  }, [mode, date]);

  return (
    <main className="container-ppd">
      <Header />
      <Deer />
      <Poyo />

      {/* status row */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-4 flex items-center gap-3 text-sm">
        <span className="badge">status: {error ? "disconnected" : (data ? "connected" : "loading…")}</span>
        {stamp && <span className="badge">stamp: {stamp}</span>}
        <button className="btn" onClick={() => load()}>Refresh</button>
      </div>

      <section className="grid-ppd">
        <div className="lg:col-span-2 space-y-6">
          {data && (
            <PotionMap
              data={data}
              mode={mode}
              onSetMode={(m) => setMode(m)}
              date={date}
              onSetDate={(d) => setDate(d)}
              onLoad={() => load()}
            />
          )}
          {data && <LogsTable matches={data.matches} drains={data.drain_events} />}
        </div>
        <div className="space-y-6">
          {data && <AlertsPanel findings={data.findings} />}
          {data && <ForecastCard title="Potion Level Forecast" f={(data as any).forecast["C3"] || (data as any).forecast} />}
          {data && <AgentTrace trace={data.trace || []} />}
        </div>
      </section>

      <div className="h-24" />
    </main>
  );
}
