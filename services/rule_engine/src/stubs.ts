import { AlertsSink, CapacityProvider, RulesProvider } from "./integration";
import { AlertInsert, RuleRow } from "./types";
import fs from "node:fs/promises";

export class InMemoryRulesProvider implements RulesProvider {
  constructor(private rules: RuleRow[]) {}
  async loadActiveRules(): Promise<RuleRow[]> {
    return this.rules;
  }
}

export class InMemoryCapacityProvider implements CapacityProvider {
  constructor(private cap: Record<string, number>) {}
  async loadCapacityByZone(): Promise<Record<string, number>> {
    return this.cap;
  }
}

/**
 * A sink that writes alerts into a JSONL file.
 * will swap this with a DB insert sink.
 */
export class JsonlFileAlertsSink implements AlertsSink {
  constructor(private outPath: string) {}
  async writeAlerts(alerts: AlertInsert[]): Promise<void> {
    const lines = alerts.map((a) => JSON.stringify(a)).join("\n") + "\n";
    await fs.appendFile(this.outPath, lines, { encoding: "utf8" });
  }
}

