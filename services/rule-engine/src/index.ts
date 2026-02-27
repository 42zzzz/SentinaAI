import { RuleEngine } from "./ruleEngine";
import { streamTelemetryJsonl } from "./telemetryJsonlReader";

function printAlert(ev: any, alert: any) {
  console.log("\n________________ RULE TRIGGERED ________________");
  console.log(`Time       : ${alert.timestamp}`);
  console.log(`Zone       : ${alert.zoneId}`);
  if (alert.hallId) console.log(`Hall       : ${alert.hallId}`);

  console.log("\nTelemetry Event");
  console.log(`   Type     : ${ev.readingType}`);
  console.log(`   Device   : ${ev.deviceId}`);
  console.log(`   Source   : ${ev.dataSource}`);

  console.log("\nRule Evaluation");
  console.log(`   Rule ID  : ${alert.ruleId}`);
  console.log(`   Severity : ${String(alert.severity).toUpperCase()}`);
  console.log(`   Message  : ${alert.message}`);

  if (alert.details) {
    console.log("\nDetails");
    for (const [key, value] of Object.entries(alert.details)) {
      console.log(`   • ${key}: ${value}`);
    }
  }

  console.log("________________________________________________\n");
}

async function main() {
  const telemetryPath = process.argv[2];

  if (!telemetryPath) {
    console.error('Usage: npx ts-node src/index.ts "<telemetry.jsonl>"');
    process.exit(1);
  }

  // Temporary hardcoded capacity which we will sap later for database
  const capacityByZone: Record<string, number> = {
    zoneA: 450,
    zoneB: 500,
    zoneC: 400,
    zoneD: 600,
  };

  const engine = new RuleEngine(capacityByZone);

  await streamTelemetryJsonl(telemetryPath, (ev) => {
    const alerts = engine.ingest(ev);
    for (const alert of alerts) {
      printAlert(ev, alert);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

