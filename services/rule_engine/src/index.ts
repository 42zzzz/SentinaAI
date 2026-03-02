import { runRuleEngine } from "./app";
import { InMemoryCapacityProvider, InMemoryRulesProvider, JsonlFileAlertsSink } from "./stubs";
import { RuleRow } from "./types";
import fs from "node:fs";

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}
function parseNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function loadRulesFromCsv(path: string): RuleRow[] {
  // DEV ONLY. DB provider replaces this.
  const txt = fs.readFileSync(path, "utf8").trim();
  const [headerLine, ...lines] = txt.split(/\r?\n/);
  const headers = headerLine.split(",").map((s) => s.trim());

  return lines.map((line) => {
    const cols = line.split(",");
    const row: any = {};
    headers.forEach((h, i) => (row[h] = cols[i]));

    return {
      rule_key: row.rule_key,
      domain: row.domain,
      rule_name: row.rule_name,
      description: row.description,

      event_type: row.event_type,
      field_path: row.field_path,

      aggregation: row.aggregation,
      window_seconds: parseNum(row.window_seconds),

      operator: row.operator,
      threshold_value: parseNum(row.threshold_value),

      base_severity: row.base_severity,

      escalation_enabled: parseBool(row.escalation_enabled),
      escalation_window_seconds: row.escalation_window_seconds ? parseNum(row.escalation_window_seconds) : null,
      escalation_threshold: row.escalation_threshold ? parseNum(row.escalation_threshold) : null,

      cooldown_seconds: parseNum(row.cooldown_seconds),

      default_response_type: row.default_response_type,
      default_response_action: row.default_response_action,

      auto_mitigation_enabled: parseBool(row.auto_mitigation_enabled),
    } as RuleRow;
  });
}

async function main() {
  const telemetryJsonlPath = process.argv[2];
  if (!telemetryJsonlPath) {
    console.error('Usage: npx ts-node src/index.ts "<telemetry_stream.jsonl>"');
    process.exit(1);
  }

  // TEMP ONLY: rules from CSV 
  const rules = loadRulesFromCsv("./Rules_updated_with_actions_v2.csv");

  // TEMP ONLY: capacity map placeholder
  const capacityByZone: Record<string, number> = {
    zoneA: 450,
    zoneB: 500,
    zoneC: 400,
    zoneD: 600,
  };

  await runRuleEngine({
    telemetryJsonlPath,
    rulesProvider: new InMemoryRulesProvider(rules),
    capacityProvider: new InMemoryCapacityProvider(capacityByZone),
    alertsSink: new JsonlFileAlertsSink("./generated_alerts.jsonl"),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


/**
 //new index after db integration
 // src/index.ts
import { runRuleEngine } from "./app";
import { DbAlertsSink, DbCapacityProvider, DbRulesProvider, makeDbClient } from "./dbProviders";

async function main() {
  const telemetryJsonlPath = process.argv[2];
  if (!telemetryJsonlPath) {
    console.error('Usage: npx ts-node src/index.ts "<telemetry_stream.jsonl>"');
    process.exit(1);
  }

  console.log("Rule Engine starting. Rules source: DB. Alerts sink: DB.");

  const db = await makeDbClient();

  const rulesProvider = new DbRulesProvider(db);
  const capacityProvider = new DbCapacityProvider(db);
  const alertsSink = new DbAlertsSink(db);

  await runRuleEngine({
    telemetryJsonlPath,
    rulesProvider,
    capacityProvider,
    alertsSink,
  });

  console.log("Rule Engine finished processing telemetry stream.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
 */