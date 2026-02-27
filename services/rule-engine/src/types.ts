export type ReadingType =
  | "heartbeat"
  | "edge_status"
  | "video_analytics"
  | "occupancy"
  | "temp_humidity"
  | "environment"
  | "hvac_energy"
  | string;

export type AlertSeverity = "low" | "medium" | "high" | "critical";


export type TelemetryEvent = {
  readingId: string;
  deviceId: string;
  zoneId: string;
  hallId?: string | null;
  timestamp: string; // ISO string
  readingType: ReadingType;
  quality: "good" | "bad" | string;
  dataSource: string;


  values: Record<string, unknown>;
};

export type EngineAlert = {
  timestamp: string;
  zoneId: string;
  hallId?: string | null;
  ruleId: string;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, unknown>;
};

