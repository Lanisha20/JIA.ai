import { Forecast } from "../types";

export default function ForecastCard({ title, f }: { title: string; f?: Forecast }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gold">{title}</h3>
        <div className="text-xs text-white/70">
          {f?.overflow_eta ? `Overflow: ${new Date(f.overflow_eta).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : "No overflow"}
        </div>
      </div>
      <div className="mt-3 h-32 relative">
        <svg className="absolute inset-0 w-full h-full">
          {f?.series && f.series.length > 1 && (() => {
            const vals = f.series.map((p) => p[1]);
            const min = Math.min(...vals), max = Math.max(...vals);
            const x = (i: number) => (i / (f.series.length - 1)) * 100;
            const y = (v: number) => 100 - ((v - min) / Math.max(1, max - min)) * 100;
            const d = f.series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[1])}`).join(" ");
            return <path d={d} stroke="#F4C471" strokeWidth="2" fill="none" />;
          })()}
        </svg>
      </div>
    </div>
  );
}
