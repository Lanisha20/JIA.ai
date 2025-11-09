export type DrainEvent = {
    id: string; cauldron_id: string; t_start: string; t_end: string;
    true_volume: number; level_drop: number; flags?: string;
  };
  
  export type MatchRow = {
    id: string; ticket_id: string; drain_event_id: string;
    diff_volume: number; status: string;
  };
  
  export type Finding = {
    type: string; cauldron_id?: string; ticket_id?: string;
    drain_event_id?: string; diff_volume?: number; reason?: string;
  };
  
  export type Forecast = { overflow_eta: string | null; series: [string, number][]; };
  
  export type Cauldron = {
    id: string; name?: string; vmax?: number; fill_rate?: number;
    last_volume?: number; x?: number; y?: number;
  };
  
  export type TimelineItem = {
    ts: string; type: "drain_start" | "drain_end" | "ticket_arrival";
    cauldron_id?: string; ticket_id?: string; id?: string; volume?: number;
  };
  
  export type TraceStep = { step: number; tool: string; summary: string };
  
  export type Overview = {
    date: string;
    cauldrons: Cauldron[];
    network?: { nodes?: Cauldron[]; links: { source: string; target: string }[] };
    drain_events: DrainEvent[];
    matches: MatchRow[];
    findings: Finding[];
    forecast: Record<string, Forecast> | Forecast;
    timeline?: TimelineItem[];
    trace?: TraceStep[];
  };
  