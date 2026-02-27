import fs from "node:fs";
import readline from "node:readline";
import { TelemetryEvent } from "./types";

function safeObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object") return input as Record<string, unknown>;
  return {};
}

function safeParseJsonString(input: unknown): Record<string, unknown> {
  if (typeof input !== "string") return {};
  try {
    const parsed = JSON.parse(input);
    return safeObject(parsed);
  } catch {
    return {};
  }
}

//Normalizes one JSONL record into the TelemetryEvent shape
function normalize(obj: any): TelemetryEvent | null {
  if (!obj || typeof obj !== "object") return null;

  const readingType = obj.readingType ?? obj.type ?? obj.eventType;
  const zoneId = obj.zoneId ?? obj.zone ?? obj.zone_id;
  const timestamp = obj.timestamp ?? obj.time ?? obj.ts;

  
  if (!readingType || !zoneId || !timestamp) return null;

  const readingId = String(obj.readingId ?? obj.id ?? "");
  const deviceId = String(obj.deviceId ?? obj.device ?? obj.device_id ?? "unknown");
  const hallIdRaw = obj.hallId ?? obj.hall ?? obj.hall_id ?? null;
  const hallId = hallIdRaw === null || hallIdRaw === undefined ? null : String(hallIdRaw);

  const quality = String(obj.quality ?? "good");
  const dataSource = String(obj.dataSource ?? obj.source ?? "unknown");

  
  const values =
    (obj.values && typeof obj.values === "object" ? safeObject(obj.values) : {}) ||
    safeParseJsonString(obj.values_json) ||
    (obj.payload && typeof obj.payload === "object" ? safeObject(obj.payload) : {}) ||
    (obj.data && typeof obj.data === "object" ? safeObject(obj.data) : {});

  return {
    readingId,
    deviceId,
    zoneId: String(zoneId),
    hallId,
    timestamp: String(timestamp),
    readingType: String(readingType),
    quality,
    dataSource,
    values,
  };
}

/**
 * Streams a JSONL file line-by-line.
 * Calls onEvent for each normalized TelemetryEvent.
 */
export async function streamTelemetryJsonl(
  filePath: string,
  onEvent: (ev: TelemetryEvent) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath, { encoding: "utf8" });

    const rl = readline.createInterface({
      input,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let obj: any;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        // skip malformed line
        return;
      }

      const ev = normalize(obj);
      if (ev) onEvent(ev);
    });

    rl.on("close", () => resolve());
    rl.on("error", (err) => reject(err));
    input.on("error", (err) => reject(err));
  });
}
