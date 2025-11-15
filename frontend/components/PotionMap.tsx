import { Cauldron, Overview } from "../types";

const LABEL_HEIGHT = 5;
const LABEL_PADDING = 1;
const LABEL_GAP = 8;
const LABEL_TEXT_OFFSET = 0.4;
const NODE_RADIUS = 14;
const OUTER_RING = NODE_RADIUS + 6;
const RIPPLE_RING = NODE_RADIUS + 12;

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
  const derivedLinks = links;
  const fallbackLinks =
    derivedLinks.length === 0 && nodes.length > 1
      ? nodes.slice(0, -1).map((node, idx) => ({
          source: node.id,
          target: nodes[idx + 1].id,
          style: "dashed" as const,
        }))
      : [];
  const visualLinks = derivedLinks.length ? derivedLinks : fallbackLinks;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="h-subtitle">Potion Network Map</h3>
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
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-6 right-8 bottom-10 h-px bg-white/10">
            <div className="absolute left-0 -top-1 h-2 w-px bg-white/30" />
            <div className="absolute right-0 -top-1 h-2 w-px bg-white/30" />
            <span className="absolute right-0 -bottom-4 text-[10px] tracking-[0.2em] uppercase text-white/50">
              X axis · flow span
            </span>
          </div>
          <div className="absolute top-6 bottom-12 left-10 w-px bg-white/10">
            <div className="absolute -left-1 top-0 w-2 h-px bg-white/30" />
            <div className="absolute -left-1 bottom-0 w-2 h-px bg-white/30" />
            <span className="absolute -left-6 top-0 -rotate-90 origin-top text-[10px] tracking-[0.2em] uppercase text-white/50">
              Y axis · elevation
            </span>
          </div>
        </div>
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <filter id="labelGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* links */}
          {visualLinks.map((l, idx) => {
            const a = nodes.find((n) => n.id === l.source);
            const b = nodes.find((n) => n.id === l.target);
            if (!a || !b) return null;
            const ax = (a.x ?? 50) + "%", ay = (a.y ?? 50) + "%";
            const bx = (b.x ?? 50) + "%", by = (b.y ?? 50) + "%";
            const dashed = l.style === "dashed";
            const isMarketLink = l.source === "enchanted-market" || l.target === "enchanted-market";
            const strokeColor = isMarketLink ? "#F4C471" : dashed ? "#9E7CFD99" : "#F4C47188";
            return (
              <line
                key={idx}
                x1={ax}
                y1={ay}
                x2={bx}
                y2={by}
                stroke={strokeColor}
                strokeWidth={isMarketLink ? 2.2 : dashed ? 1.5 : 2}
                strokeDasharray={isMarketLink ? undefined : dashed ? "6 6" : undefined}
              />
            );
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const xVal = n.x ?? 50;
            const yVal = n.y ?? 50;
            const x = `${xVal}%`;
            const y = `${yVal}%`;
            const isMarket = n.id === "enchanted-market";
            const fill = isMarket ? "#d4770b" : "#fbe0b5";
            const ring = isMarket ? "#F4C471" : "#f0b679";
            const labelColor = isMarket ? "#F4C471" : "#fbead1";
            const p = pct(n);
            const labelTop = Math.max(2, yVal - (LABEL_HEIGHT + LABEL_PADDING + LABEL_GAP));
            const labelCenter = labelTop + LABEL_HEIGHT / 2 + LABEL_TEXT_OFFSET;
            const labelText = `${n.name ?? n.id}${p != null ? ` • ${p}%` : ""}`;
            const labelWidth = Math.min(30, Math.max(13, labelText.length * 0.65));

            return (
              <g key={n.id} className="transition duration-200 ease-out">
                <g>
                  <rect
                    x={`calc(${x} - ${labelWidth / 2}%)`}
                    y={`${labelTop}%`}
                    width={`${labelWidth}%`}
                    height={`${LABEL_HEIGHT}%`}
                    rx="8"
                    fill="rgba(23,13,33,0.85)"
                    stroke={`${labelColor}aa`}
                    strokeWidth="0.4"
                    filter="url(#labelGlow)"
                  />
                  <text
                    x={x}
                    y={`${labelCenter}%`}
                    textAnchor="middle"
                    fill={labelColor}
                    fontSize="10"
                    fontWeight={600}
                    dominantBaseline="middle"
                  >
                    {labelText}
                  </text>
                </g>
                <circle cx={x} cy={y} r={NODE_RADIUS} fill={fill} opacity="0.95" />
                <circle cx={x} cy={y} r={OUTER_RING} stroke={ring} strokeOpacity="0.65" strokeWidth="2" fill="none" />
                <circle cx={x} cy={y} r={RIPPLE_RING} stroke={ring} strokeOpacity="0.2" strokeWidth="1" fill="none" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
