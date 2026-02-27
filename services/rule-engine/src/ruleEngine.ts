import { EngineAlert, TelemetryEvent } from "./types";
import { EngineContext, evaluateEvent } from "./rules";

export class RuleEngine {
  private ctx: EngineContext;

  constructor(capacityByZone: Record<string, number>) {
    this.ctx = {
      capacityByZone,
      stateByZone: new Map(),
    };
  }

  ingest(ev: TelemetryEvent): EngineAlert[] {
    return evaluateEvent(this.ctx, ev);
  }
}
