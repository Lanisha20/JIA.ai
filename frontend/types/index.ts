export type DrainEvent = {
  id: string;
  cauldron_id: string;
  t_start: string;
  t_end: string;
  true_volume: number;
  level_drop: number;
  flags?: string;
};

export type MatchRow = {
  id: string;
  ticket_id: string;
  drain_event_id: string;
  diff_volume: number;
  status: string;
};

export type Finding = {
  type: string;
  cauldron_id?: string;
  ticket_id?: string;
  drain_event_id?: string;
  diff_volume?: number;
  reason?: string;
};

// add/ensure this type exists
export type Forecast = {
    overflow_eta?: string | null;
    /** optional timestamp the server says is “now” */
    now_ts?: string;
    /** series of [ISO timestamp, volume] points */
    series: [string, number][];
  };
  

export type Cauldron = {
  id: string;
  name?: string;
  vmax?: number | null;
  fill_rate?: number | null;
  last_volume?: number | null;
  fill_percent?: number | null;
  x?: number;
  y?: number;
};

export type TimelineItem = {
  ts: string;
  type: "drain_start" | "drain_end" | "ticket_arrival";
  cauldron_id?: string;
  ticket_id?: string;
  id?: string;
  volume?: number;
};

export type TraceStep = {
  step: number;
  tool: string;
  summary: string;
  agent?: string;
  tags?: string[];
  created_at?: string;
  action?: string;
};

export type NetworkLink = {
  source: string;
  target: string;
  style?: "solid" | "dashed";
};

export type Overview = {
  date?: string;
  cauldrons: Cauldron[];
  network?: { nodes?: Cauldron[]; links: NetworkLink[] };
  drain_events: DrainEvent[];
  matches: MatchRow[];
  findings: Finding[];
  forecast: Record<string, Forecast> | Forecast | null;
  timeline?: TimelineItem[];
  trace: TraceStep[];
};
  
