import { FormEvent, useEffect, useMemo, useState } from "react";
import { Cauldron } from "../types";

type DraftNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  fillPercent: number;
  vmax: number;
  linkTarget?: string;
};

type Props = {
  existingIds: string[];
  linkTargets: string[];
  customNodes: Cauldron[];
  onAdd: (draft: DraftNode) => void;
};

const defaultDraft = (linkTarget?: string): DraftNode => ({
  id: "",
  name: "",
  x: 45,
  y: 40,
  fillPercent: 55,
  vmax: 600,
  linkTarget,
});

export default function NetworkComposer({ existingIds, linkTargets, customNodes, onAdd }: Props) {
  const [draft, setDraft] = useState<DraftNode>(() => defaultDraft(linkTargets[0]));

  useEffect(() => {
    if (!draft.linkTarget && linkTargets.length) {
      setDraft((prev) => ({ ...prev, linkTarget: linkTargets[0] }));
    }
  }, [linkTargets, draft.linkTarget]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.id.trim()) return;
    const payload = { ...draft, id: draft.id.trim(), name: draft.name.trim() || draft.id.trim() };
    onAdd(payload);
    setDraft((prev) => ({ ...defaultDraft(linkTargets[0]), linkTarget: prev.linkTarget || linkTargets[0] }));
  };

  const randomizeCoords = () => {
    setDraft((prev) => ({
      ...prev,
      x: Math.min(90, Math.max(10, Math.round(Math.random() * 80) + 10)),
      y: Math.min(90, Math.max(10, Math.round(Math.random() * 70) + 15)),
    }));
  };

  const recent = useMemo(() => customNodes.slice(-3).reverse(), [customNodes]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gold">Map Composer</h3>
          <p className="text-xs text-white/60">Add custom cauldrons directly onto the potion network.</p>
        </div>
        <span className="badge">custom</span>
      </div>

      <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
        <label className="text-xs uppercase tracking-[0.3em] text-white/50 col-span-2">
          Id / Name
          <input
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="C-aurora"
            value={draft.id}
            onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))}
          />
        </label>
        <label className="text-xs uppercase tracking-[0.3em] text-white/50 col-span-2">
          Label
          <input
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="Aurora Basin"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.3em] text-white/50">
          X (%)
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.x}
            onChange={(e) => setDraft((prev) => ({ ...prev, x: Number(e.target.value) }))}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.3em] text-white/50">
          Y (%)
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.y}
            onChange={(e) => setDraft((prev) => ({ ...prev, y: Number(e.target.value) }))}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.3em] text-white/50">
          Fill %
          <input
            type="number"
            min={1}
            max={100}
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.fillPercent}
            onChange={(e) => setDraft((prev) => ({ ...prev, fillPercent: Number(e.target.value) }))}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.3em] text-white/50">
          Max Vol (L)
          <input
            type="number"
            min={100}
            max={2000}
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.vmax}
            onChange={(e) => setDraft((prev) => ({ ...prev, vmax: Number(e.target.value) }))}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.3em] text-white/50 col-span-2">
          Link Target
          <select
            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.linkTarget}
            onChange={(e) => setDraft((prev) => ({ ...prev, linkTarget: e.target.value || undefined }))}
          >
            <option value="">None</option>
            {linkTargets.map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs text-white/60 underline decoration-dotted hover:text-white"
            onClick={randomizeCoords}
          >
            Randomize coords
          </button>
          <button type="submit" className="btn px-4 py-2 text-sm">
            Add node
          </button>
        </div>
      </form>

      {customNodes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Recently added</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((node) => (
              <span key={node.id} className="badge badge-verify text-[11px]">
                {node.id} · {node.fill_percent ?? "--"}%
              </span>
            ))}
          </div>
        </div>
      )}

      {existingIds.length > 0 && (
        <div className="text-[11px] text-white/50">
          Tracking <span className="text-white/80">{existingIds.length}</span> base nodes.
        </div>
      )}
    </div>
  );
}
