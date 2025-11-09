import { MatchRow, DrainEvent } from "../types";

type Props = { matches?: MatchRow[]; drains?: DrainEvent[] };

export default function LogsTable({ matches = [], drains = [] }: Props) {
  // Build rows by joining the first matching drain per match
  const rows = matches.map((m) => {
    const d = drains.find((x) => x.id === m.drain_event_id);
    const t = d?.t_end ? new Date(d.t_end) : null;
    return {
      time: t ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
      cauldron: d?.cauldron_id ?? "—",
      volume: d?.true_volume ?? 0,
      ticket: m.ticket_id ?? "—",
      diff: m.diff_volume ?? 0,
      status: m.status ?? "—",
    };
  });

  // ---- guard: nothing to show
  if (rows.length === 0 && drains.length === 0) {
    return (
      <div className="card p-5 text-white/70">
        <h3 className="text-lg font-semibold text-gold mb-3">Drain & Ticket Logs</h3>
        No drain or ticket activity for this date.
      </div>
    );
  }

  // If there are drains but no matches, show drains alone
  const drainOnlyRows =
    rows.length === 0 && drains.length > 0
      ? drains.map((d) => ({
          time: d.t_end ? new Date(d.t_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
          cauldron: d.cauldron_id,
          volume: d.true_volume ?? d.level_drop ?? 0,
          ticket: "N/A",
          diff: 0,
          status: d.flags ?? "ok",
        }))
      : rows;

  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-gold mb-3">Drain & Ticket Logs</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Cauldron</th>
              <th className="px-3 py-2 text-left">Volume</th>
              <th className="px-3 py-2 text-left">Ticket</th>
              <th className="px-3 py-2 text-left">Δ</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {drainOnlyRows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-3 py-2">{r.time}</td>
                <td className="px-3 py-2">{r.cauldron}</td>
                <td className="px-3 py-2">{Math.round(r.volume)} L</td>
                <td className="px-3 py-2">{r.ticket}</td>
                <td className={`px-3 py-2 ${r.diff > 5 ? "text-rose-300" : r.diff < -5 ? "text-sky-300" : "text-white/80"}`}>
                  {r.diff.toFixed ? r.diff.toFixed(1) : r.diff} L
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`badge ${
                      /over|under|unlogged/i.test(r.status) ? "badge-warn" : "badge-ok"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
