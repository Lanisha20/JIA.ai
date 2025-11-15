import { Forecast } from "../types";

type Props = { title: string; f?: Forecast };

export default function ForecastCard({ title, f }: Props) {
  // guard
  if (!f || !Array.isArray(f.series) || f.series.length < 2) {
    return (
      <div className="card p-5">
        <h3 className="h-subtitle">{title}</h3>
        <p className="text-sm text-white/60 mt-3">No forecast data.</p>
      </div>
    );
  }

  // ---------- chart prep ----------
  // split into past (<= now) and future (> now) using client time
  const now = Date.now();
  const pts = f.series
    .map((entry) => {
      if (Array.isArray(entry)) {
        const [ts, v] = entry;
        const t = new Date(ts).getTime();
        const value = typeof v === "number" ? v : Number(v);
        return Number.isFinite(t) && Number.isFinite(value) ? { t, v: value } : null;
      }
      if (entry && typeof entry === "object") {
        const ts = (entry as { ts?: string | number; time?: string | number; 0?: string | number }).ts ?? entry.time ?? entry[0];
        const vVal = (entry as { v?: number; value?: number; 1?: number }).v ?? entry.value ?? entry[1];
        const t = new Date(ts as any).getTime();
        const value = typeof vVal === "number" ? vVal : Number(vVal);
        return Number.isFinite(t) && Number.isFinite(value) ? { t, v: value } : null;
      }
      return null;
    })
    .filter((pt): pt is { t: number; v: number } => Boolean(pt));
  if (pts.length < 2) {
    return (
      <div className="card p-5">
        <h3 className="h-subtitle">{title}</h3>
        <p className="text-sm text-white/60 mt-3">No forecast data.</p>
      </div>
    );
  }
  let cut = pts.findIndex(p => p.t > now);
  if (cut === -1) cut = pts.length;         // all past/future edge cases

  const w = 100;                             // viewbox width (%)
  const h = 100;                             // viewbox height (%)
  const values = pts.map(p => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const xAt = (i: number) => (i / (pts.length - 1)) * w;
  const yAt = (v: number) => h - ((v - min) / span) * h;

  const pathFor = (from: number, to: number) => {
    const seg = pts.slice(from, to);
    if (seg.length < 2) return "";
    return seg
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(from + i)} ${yAt(p.v)}`)
      .join(" ");
  };

  const pastD   = pathFor(0, cut);
  const futureD = pathFor(Math.max(0, cut - 1), pts.length); // connect from last past point

  // ---------- table prep (hourly snapshots) ----------
  // group by hour boundary (first point of each hour)
  const hourly = (() => {
    const out: { time: string; value: number; ts: number }[] = [];
    let lastHour = -1;
    for (const p of pts) {
      const d = new Date(p.t);
      const hr = d.getUTCHours();
      if (hr !== lastHour) {
        const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        out.push({
          time: label,
          value: p.v,
          ts: d.getTime(),
        });
        lastHour = hr;
      }
      if (out.length >= 6) break; // keep table small
    }
    // always include final point if it isn’t already captured
    const last = pts[pts.length - 1];
    const lastDate = new Date(last.t);
    const lastLabel = lastDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (!out.find(r => r.time === lastLabel)) {
      out.push({ time: lastLabel, value: last.v, ts: lastDate.getTime() });
    }
    return out.slice(0, 6);
  })();
  const overflowTs = f.overflow_eta ? new Date(f.overflow_eta).getTime() : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="h-subtitle">{title}</h3>
        <div className="text-xs text-white/70">
          {f.overflow_eta
            ? `Overflow: ${new Date(f.overflow_eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "No overflow"}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4 h-40 relative">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* optional faint axes */}
          <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,.05)" strokeWidth="0.8" />
          <line x1="0" y1="0"   x2="0"   y2="100" stroke="rgba(255,255,255,.05)" strokeWidth="0.8" />

          {/* solid history */}
          {pastD && (
            <path d={pastD} stroke="#F4C471" strokeWidth="2.2" fill="none" />
          )}

          {/* dotted forecast */}
          {futureD && pts.length > cut && (
            <path
              d={futureD}
              stroke="#F4C471"
              strokeWidth="2.2"
              fill="none"
              strokeDasharray="4 4"
            />
          )}
        </svg>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Projected Volume</th>
              <th className="text-left px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {hourly.map((r, i) => {
              const isOverflow = overflowTs != null && r.ts >= overflowTs;
              return (
                <tr key={i} className="bg-white/[0.02] hover:bg-white/[0.04]">
                  <td className="px-3 py-2">{r.time}</td>
                  <td className="px-3 py-2">{r.value.toFixed(1)} L</td>
                  <td className="px-3 py-2">
                    {isOverflow ? (
                      <span className="badge badge-warn">after overflow</span>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
