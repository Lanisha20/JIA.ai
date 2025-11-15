import { MatchRow, DrainEvent } from "../types";

export default function LogsTable({ matches, drains }: { matches: MatchRow[]; drains: DrainEvent[] }) {
  const rows = (matches || []).map((m) => {
    const d = drains.find((x) => x.id === m.drain_event_id);
    return {
      time: d ? new Date(d.t_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
      cauldron: d?.cauldron_id ?? "—",
      volume: d?.true_volume ?? 0,
      ticket: m.ticket_id,
      diff: m.diff_volume,
    };
  });

  return (
    <div className="card p-5">
      <h3 className="h-subtitle mb-3">Drain & Ticket Logs</h3>
      <div className="overflow-hidden rounded-xl border border-[rgba(244,196,113,0.15)]">
        {rows.length === 0 && (
          <div className="px-4 py-6 text-sm text-white/70">No drains or matches yet.</div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-[rgba(244,196,113,0.07)] text-white/90">
            <tr>
              <th className="text-left px-4 py-2">Time</th>
              <th className="text-left px-4 py-2">Cauldron</th>
              <th className="text-left px-4 py-2">Volume</th>
              <th className="text-left px-4 py-2">Ticket</th>
              <th className="text-left px-4 py-2">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-black/10">
                <td className="px-4 py-2">{r.time}</td>
                <td className="px-4 py-2">{r.cauldron}</td>
                <td className="px-4 py-2">{Math.round(r.volume)} L</td>
                <td className="px-4 py-2">{r.ticket}</td>
                <td className={`px-4 py-2 ${r.diff > 0 ? "text-amber" : "text-aqua"}`}>{r.diff.toFixed(1)} L</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
