import { EngineAlert, TelemetryEvent } from "./types";
import {
  severityFromScore,
  overcrowdingRiskFromOccupancyRate,
  flowRiskFromNetInflow,
  co2RiskFromPpm,
  thermalDiscomfortRisk,
  hvacSustainabilityRisk,
  carbonImpactRiskFromEnergy,
  lightingReductionLevelFromOccupancy,
  ventilationIncreaseLevelFromCO2,
  overallComfortRisk,
} from "./fuzzy";

export type ZoneState = {
  lastOccRate?: number;
  lastOccCount?: number;

  lastInflow?: number;
  lastOutflow?: number;
  lastEstimatedCount?: number;

  lastCO2?: number;
  lastNoiseDb?: number;

  lastTempC?: number;
  lastHumidityPct?: number;

  lastHvacPowerKW?: number;
  lastHvacEnergyKWh?: number;
  lastHvacInefficient?: boolean;

  lastQueueDepth?: number;
  lastCpuPct?: number;
  lastMemPct?: number;

  // Derived memory
  lastCrowdRisk?: number;
  lastThermalRisk?: number;
  lastCo2Risk?: number;
};

export type EngineContext = {
  capacityByZone: Record<string, number>;
  stateByZone: Map<string, ZoneState>;
};

function getZoneState(ctx: EngineContext, zoneId: string): ZoneState {
  const existing = ctx.stateByZone.get(zoneId);
  if (existing) return existing;
  const s: ZoneState = {};
  ctx.stateByZone.set(zoneId, s);
  return s;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function evaluateEvent(ctx: EngineContext, ev: TelemetryEvent): EngineAlert[] {
  const alerts: EngineAlert[] = [];
  const s = getZoneState(ctx, ev.zoneId);

  if (ev.quality && ev.quality !== "good") return alerts;

  // Helper consistent fuzzy alert pushing
  function pushFuzzy(ruleId: string, score: number, message: string, details?: Record<string, unknown>) {
    const severity = severityFromScore(score);
    if (severity === "low") return;

    alerts.push({
      timestamp: ev.timestamp,
      zoneId: ev.zoneId,
      hallId: ev.hallId ?? null,
      ruleId,
      severity,
      message,
      details: {
        riskScore: Number(score.toFixed(3)),
        ...(details ?? {}),
      },
    });
  }

  // =========================
  // Update state from event
  // =========================
  const v = ev.values;

  if (ev.readingType === "occupancy") {
    const occRate = num(v["occupancyRate"]);
    const occCount = num(v["occupancyCount"]);
    if (occRate !== undefined) s.lastOccRate = occRate;
    if (occCount !== undefined) s.lastOccCount = occCount;

    if (occRate !== undefined) {
      const crowdRisk = overcrowdingRiskFromOccupancyRate(occRate);
      s.lastCrowdRisk = crowdRisk;

      // Rule 1: Overcrowding risk
      pushFuzzy(
        "OPS_OVER_CROWD_FUZZY_01",
        crowdRisk,
        "Overcrowding risk elevated (fuzzy)",
        { occupancyRate: occRate, occupancyCount: occCount }
      );

      // Lighting reduction when not being used
      const lightLevel = lightingReductionLevelFromOccupancy(occRate);
      pushFuzzy(
        "SUS_LIGHTING_REDUCTION_FUZZY_01",
        lightLevel,
        "Recommend reducing lighting due to low usage (fuzzy)",
        {
          action: "reduce_lighting",
          reductionLevel: Number(lightLevel.toFixed(3)),
          suggestedReductionPercent: Math.round(lightLevel * 60), 
          occupancyRate: occRate,
        }
      );
    }
  }

  if (ev.readingType === "video_analytics") {
    const inflow = num(v["inflow"]);
    const outflow = num(v["outflow"]);
    const est = num(v["estimatedCount"]);
    if (inflow !== undefined) s.lastInflow = inflow;
    if (outflow !== undefined) s.lastOutflow = outflow;
    if (est !== undefined) s.lastEstimatedCount = est;

    if (inflow !== undefined && outflow !== undefined) {
      const net = inflow - outflow;
      const flowRisk = flowRiskFromNetInflow(net);

      // Rule 2: Flow congestion risk
      pushFuzzy(
        "OPS_FLOW_CONGESTION_FUZZY_01",
        flowRisk,
        "Flow congestion building (fuzzy)",
        { inflow, outflow, netInflow: net, estimatedCount: est }
      );
    }
  }

  if (ev.readingType === "environment") {
    const co2 = num(v["co2ppm"]);
    const noiseDb = num(v["noiseDb"]);
    if (co2 !== undefined) s.lastCO2 = co2;
    if (noiseDb !== undefined) s.lastNoiseDb = noiseDb;

    if (co2 !== undefined) {
      const co2Risk = co2RiskFromPpm(co2);
      s.lastCo2Risk = co2Risk;

      // Increase ventilation if CO2 too high
      const ventLevel = ventilationIncreaseLevelFromCO2(co2);
      pushFuzzy(
        "OPS_VENTILATION_INCREASE_FUZZY_01",
        ventLevel,
        "Recommend increasing ventilation due to elevated CO₂ (fuzzy)",
        {
          action: "increase_ventilation",
          ventilationIncreaseLevel: Number(ventLevel.toFixed(3)),
          suggestedIncreasePercent: Math.round(ventLevel * 40),
          co2ppm: co2,
          noiseDb,
        }
      );
    }
  }

  if (ev.readingType === "temp_humidity") {
    const t = num(v["temperatureC"]);
    const h = num(v["humidityPct"]);
    if (t !== undefined) s.lastTempC = t;
    if (h !== undefined) s.lastHumidityPct = h;

    if (t !== undefined && h !== undefined) {
      const thermalRisk = thermalDiscomfortRisk(t, h);
      s.lastThermalRisk = thermalRisk;

      // Rule 3: Thermal comfort degradation
      pushFuzzy(
        "OPS_THERMAL_COMFORT_FUZZY_01",
        thermalRisk,
        "Thermal comfort degrading (temperature/humidity fuzzy)",
        { temperatureC: t, humidityPct: h }
      );
    }
  }

  if (ev.readingType === "hvac_energy") {
    const p = num(v["hvacPowerKW"]);
    const e = num(v["hvacEnergyKWh"]);
    const ineff = typeof v["hvacInefficient"] === "boolean" ? (v["hvacInefficient"] as boolean) : undefined;

    if (p !== undefined) s.lastHvacPowerKW = p;
    if (e !== undefined) s.lastHvacEnergyKWh = e;
    if (ineff !== undefined) s.lastHvacInefficient = ineff;

    const occRate = s.lastOccRate; 

    // Rule 4: Energy efficiency / sustainability risk
    const susRisk = hvacSustainabilityRisk(p, e, occRate, ineff);
    pushFuzzy(
      "SUS_ENERGY_EFF_FUZZY_01",
      susRisk,
      "Sustainability risk elevated (HVAC energy vs usage fuzzy)",
      {
        hvacPowerKW: p,
        hvacEnergyKWh: e,
        hvacInefficient: ineff,
        occupancyRate: occRate,
      }
    );

    // Rule 5: Carbon impact 
    if (e !== undefined) {
      const { kgCO2, risk } = carbonImpactRiskFromEnergy(e);
      pushFuzzy(
        "SUS_CARBON_IMPACT_FUZZY_01",
        risk,
        "Carbon impact elevated (estimated from energy use fuzzy)",
        { estimatedCarbonKgCO2: Number(kgCO2.toFixed(3)), hvacEnergyKWh: e }
      );
    }
  }

  if (ev.readingType === "edge_status") {
    const q = num(v["queueDepth"]);
    const cpu = num(v["cpuPct"]);
    const mem = num(v["memPct"]);
    if (q !== undefined) s.lastQueueDepth = q;
    if (cpu !== undefined) s.lastCpuPct = cpu;
    if (mem !== undefined) s.lastMemPct = mem;

    // Keeping this as a reliability rule 
    if (q !== undefined) {
      // Normalize queue depth into 0..1-ish risk 
      const score = Math.max(0, Math.min(1, q / 150)); 
      pushFuzzy(
        "OPS_EDGE_HEALTH_FUZZY_01",
        score,
        "Edge processing health degrading (backlog increasing)",
        { queueDepth: q, cpuPct: cpu, memPct: mem }
      );
    }
  }

  // =========================
  // Rule 6: Overall Comfort Status
  // This can trigger on ANY event once we have some context in state.
  // =========================
  const overall = overallComfortRisk({
    crowdRisk: s.lastCrowdRisk,
    thermalRisk: s.lastThermalRisk,
    co2Risk: s.lastCo2Risk,
  });

  // Only emit if we have at least one driver present
  if ((s.lastCrowdRisk ?? 0) > 0 || (s.lastThermalRisk ?? 0) > 0 || (s.lastCo2Risk ?? 0) > 0) {
    pushFuzzy(
      "OPS_COMFORT_STATUS_FUZZY_01",
      overall,
      "Overall comfort degrading (combined fuzzy)",
      {
        crowdRisk: s.lastCrowdRisk,
        thermalRisk: s.lastThermalRisk,
        co2Risk: s.lastCo2Risk,
      }
    );
  }

  return alerts;
}


