import React from "react";

export default function ActionsPanel({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="card p-5 space-y-5">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gold">Agent Actions</h3>
        <button
          onClick={onRefresh}
          className="badge badge-verify hover:bg-[rgba(244,196,113,0.25)] transition"
        >
          Refresh data
        </button>
      </div>

      <p className="text-sm text-white/70 leading-snug">
        Run tools or a full Nemotron plan directly from the dashboard.
      </p>

      {/* Tool Buttons Grid */}
      <div className="grid gap-4">
        <ActionCard
          title="Detect Drain Events"
          desc="Runs the Nemotron detector over the latest telemetry to log new drain events."
          btn="Run"
        />
        <ActionCard
          title="Match Tickets"
          desc="Greedy matcher pairs ticket volumes with recent drain events."
          btn="Run"
        />
        <ActionCard
          title="Planner (Detect + Match)"
          desc="Nemotron planner decides the best next steps and calls tools in order."
          btn="Run"
        />
        <ActionCard
          title="Audit Discrepancies"
          desc="Auditor flags under / over reports plus unmatched tickets or drains."
          btn="Run"
        />
      </div>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  btn,
}: {
  title: string;
  desc: string;
  btn: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-[rgba(80,70,120,0.3)] to-[rgba(30,20,60,0.2)] border border-white/10 hover:border-white/20 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm mb-1 leading-tight">
            {title}
          </h4>
          <p className="text-xs text-white/60 leading-snug">{desc}</p>
        </div>
        <button className="btn px-3 py-1 text-xs shrink-0">{btn}</button>
      </div>
    </div>
  );
}
