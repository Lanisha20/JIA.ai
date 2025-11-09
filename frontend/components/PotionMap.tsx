import { Cauldron, Overview } from "../types";

type Props = { data: Overview };

const pct = (c: Cauldron) => {
  if (!c.vmax || c.last_volume == null) return null;
  return Math.min(100, Math.max(0, Math.round((c.last_volume / c.vmax) * 100)));
};

export default function PotionMap({ data }: Props) {
  const networkNodes = data.network?.nodes?.length ? data.network.nodes : undefined;
  const nodes = networkNodes
    ? networkNodes.map((node) => {
        const cauldron = data.cauldrons.find((c) => c.id === node.id);
        return {
          id: node.id,
          x: node.x,
          y: node.y,
          vmax: cauldron?.vmax,
          last_volume: cauldron?.last_volume,
          fill_percent: cauldron?.fill_percent,
          name: cauldron?.name ?? node.id,
        } as Cauldron;
      })
    : data.cauldrons || [];
  const links = data.network?.links ?? [];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gold">Potion Network Map</h3>
        <div className="flex gap-2">
          <span className="badge badge-verify">Live</span>
          <span className="badge">Playback</span>
        </div>
      </div>

      <div className="relative w-full h-[340px] rounded-xl overflow-hidden
                      bg-[radial-gradient(600px_300px_at_50%_-20%,#3a2658_0%,#20102E_60%)]">
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
            No cauldron telemetry yet.
          </div>
        )}
        <svg className="absolute inset-0 w-full h-full">
          {/* links */}
          {links.map((l, idx) => {
            const a = nodes.find((n) => n.id === l.source);
            const b = nodes.find((n) => n.id === l.target);
            if (!a || !b) return null;
            const ax = (a.x ?? 50) + "%", ay = (a.y ?? 50) + "%";
            const bx = (b.x ?? 50) + "%", by = (b.y ?? 50) + "%";
            return (
              <line key={idx} x1={ax} y1={ay} x2={bx} y2={by}
                    stroke="#F4C47188" strokeWidth="2" strokeDasharray="5 6" />
            );
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const x = (n.x ?? 50) + "%";
            const y = (n.y ?? 50) + "%";
            const isMarket = n.id.toUpperCase().includes("MKT") || n.name?.toLowerCase().includes("market");
            const fill = isMarket ? "#E58E33" : "#9E7CFD";
            const ring = isMarket ? "#F4C471" : "#7AD3F3";
            const p = pct(n);
            return (
              <g key={n.id}>
                <circle cx={x} cy={y} r="18" fill={fill} opacity="0.9" />
                <circle cx={x} cy={y} r="26" stroke={ring} strokeOpacity="0.35" strokeWidth="2" fill="none" />
                <text x={x} y={`calc(${y} + 36px)`} textAnchor="middle" fontSize="12" fill="#f8e9d6">
                  {n.id}{p != null ? `  ${p}%` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
