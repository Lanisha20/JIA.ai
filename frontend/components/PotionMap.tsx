import React from "react";
import { Overview } from "../types";

type Props = {
  data: Overview;
  mode: "live" | "playback";
  onSetMode: (m: "live" | "playback") => void;
  date?: string;
  onSetDate: (d?: string) => void;
  onLoad: () => void;
};

export default function PotionMap({ data, mode, onSetMode, date, onSetDate, onLoad }: Props) {
  // simple % calc using last_volume / vmax (fallbacks are harmless)
  const cauldronPct = (id: string) => {
    const c = data.cauldrons.find((x: any) => x.id === id);
    if (!c) return 0;
    const v = Number(c.last_volume ?? 0);
    const vmax = Number(c.vmax ?? 1);
    return Math.round((v / vmax) * 100);
  };

  return (
    <div className="card p-0 overflow-hidden">
      {/* top bar with working controls */}
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className="text-lg font-semibold text-gold">Potion Network Map</h3>
        <div className="flex items-center gap-2">
          <button
            className={`tab ${mode === "live" ? "tab-active" : ""}`}
            onClick={() => { onSetMode("live"); onSetDate(undefined); }}
          >
            Live
          </button>
          <button
            className={`tab ${mode === "playback" ? "tab-active" : ""}`}
            onClick={() => onSetMode("playback")}
          >
            Playback
          </button>
          {mode === "playback" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input"
                value={date ?? ""}
                onChange={(e) => onSetDate(e.target.value || undefined)}
              />
              <button className="btn" onClick={onLoad}>Load</button>
            </div>
          )}
        </div>
      </div>

      {/* very simple layout—your existing SVG/canvas can sit here */}
      <div className="px-5 pb-5">
        <div className="rounded-2xl bg-black/30 ring-1 ring-white/5 h-[420px] flex items-center justify-center">
          {/* Example node badges driven by math */}
          <div className="flex gap-10">
            {["C1", "C2", "C3"].map((id) => (
              <div key={id} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-violet-500/40 ring-2 ring-violet-300/50 grid place-items-center">
                  <span className="text-sm text-white">{id}</span>
                </div>
                <div className="text-xs text-white/70">{cauldronPct(id)}%</div>
              </div>
            ))}
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-amber-500/40 ring-2 ring-amber-300/50 grid place-items-center">
                <span className="text-xs text-white">MKT</span>
              </div>
              <div className="text-xs text-white/70">Market</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
