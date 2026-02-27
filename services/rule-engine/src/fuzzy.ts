export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function tri(x: number, a: number, b: number, c: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

export function trap(x: number, a: number, b: number, c: number, d: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

export function severityFromScore(score01: number) {
  const s = clamp01(score01);
  if (s >= 0.85) return "critical";
  if (s >= 0.70) return "high";
  if (s >= 0.45) return "medium";
  return "low";
}

/**
 * Crowd / Overcrowding fuzzy risk from occupancyRate (0..1).
 */
export function overcrowdingRiskFromOccupancyRate(occRate: number): number {
  const low = trap(occRate, -0.2, 0.0, 0.40, 0.65);
  const med = tri(occRate, 0.55, 0.72, 0.88);
  const high = trap(occRate, 0.80, 0.90, 1.05, 1.30);

  const denom = low + med + high;
  const score = low * 0.12 + med * 0.55 + high * 0.95;
  return clamp01(denom > 0 ? score / denom : 0);
}

/**
 * CO2 fuzzy risk (ppm). Gradual degradation.
 */
export function co2RiskFromPpm(co2ppm: number): number {
  const low = trap(co2ppm, 300, 400, 750, 950);
  const med = tri(co2ppm, 850, 1100, 1350);
  const high = trap(co2ppm, 1250, 1450, 2000, 2600);

  const denom = low + med + high;
  const score = low * 0.10 + med * 0.55 + high * 0.95;
  return clamp01(denom > 0 ? score / denom : 0);
}

/**
 * Flow congestion risk from net inflow (inflow - outflow).
 */
export function flowRiskFromNetInflow(net: number): number {
  const low = trap(net, -50, -5, 3, 10);
  const med = tri(net, 6, 16, 28);
  const high = trap(net, 22, 32, 70, 140);

  const denom = low + med + high;
  const score = low * 0.12 + med * 0.55 + high * 0.92;
  return clamp01(denom > 0 ? score / denom : 0);
}

/**
 * Thermal discomfort from temperatureC and humidityPct.
 * Returns 0..1 where higher = more discomfort.
 * These ranges are "reasonable indoor defaults" for prototypes.
 */
export function thermalDiscomfortRisk(temperatureC: number, humidityPct: number): number {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(humidityPct)) return 0;

  // Temperature discomfort:
  // comfy around ~23-24C, discomfort grows below ~20 and above ~26+
  const tLowBad = trap(temperatureC, -50, 0, 18, 20);
  const tOk = tri(temperatureC, 20, 23.5, 26);
  const tHighBad = trap(temperatureC, 25.5, 27.5, 40, 60);

  // Convert "ok" into discomfort by taking 1-ok-ish
  const tDiscomfort = clamp01(tLowBad * 0.9 + tHighBad * 0.9 + (1 - tOk) * 0.2);

  // Humidity discomfort:
  // comfy ~40-55%, discomfort below ~30 or above ~65+
  const hLowBad = trap(humidityPct, -10, 0, 28, 35);
  const hOk = tri(humidityPct, 30, 45, 60);
  const hHighBad = trap(humidityPct, 58, 68, 90, 110);

  const hDiscomfort = clamp01(hLowBad * 0.9 + hHighBad * 0.9 + (1 - hOk) * 0.2);

  // Combine temperature + humidity discomfort
  const discomfort = clamp01(0.6 * tDiscomfort + 0.4 * hDiscomfort);

  // Shape into fuzzy low/med/high discomfort
  const low = trap(discomfort, -0.2, 0.0, 0.18, 0.35);
  const med = tri(discomfort, 0.25, 0.50, 0.72);
  const high = trap(discomfort, 0.62, 0.78, 1.05, 1.30);

  const denom = low + med + high;
  const score = low * 0.10 + med * 0.55 + high * 0.95;
  return clamp01(denom > 0 ? score / denom : 0);
}

/**
 * Sustainability / energy waste risk.
 * Uses:
 * - hvacPowerKW / hvacEnergyKWh (if present)
 * - occupancyRate (context)
 * - hvacInefficient flag (strong signal if true)
 */
export function hvacSustainabilityRisk(
  hvacPowerKW: number | undefined,
  hvacEnergyKWh: number | undefined,
  occupancyRate: number | undefined,
  hvacInefficientFlag: boolean | undefined
): number {
  const flagRisk = hvacInefficientFlag ? 0.85 : 0.0;

  // Occupancy low degree
  const occ = typeof occupancyRate === "number" && Number.isFinite(occupancyRate) ? occupancyRate : undefined;
  const lowOcc = occ === undefined ? 0.25 : trap(occ, -0.2, 0.0, 0.18, 0.30);

  // Power risk (venue-dependent, prototype defaults)
  let powerRisk = 0;
  if (typeof hvacPowerKW === "number" && Number.isFinite(hvacPowerKW)) {
    const pLow = trap(hvacPowerKW, -10, 0, 40, 90);
    const pMed = tri(hvacPowerKW, 70, 130, 190);
    const pHigh = trap(hvacPowerKW, 170, 240, 380, 650);

    // waste = high power while low occupancy
    const wasteHigh = clamp01(pHigh * lowOcc);
    const wasteMed = clamp01(pMed * (lowOcc * 0.6));
    powerRisk = clamp01(wasteMed * 0.55 + wasteHigh * 0.95 + (1 - pLow) * 0.10);
  }

  // Energy kWh risk (per 15-min window, depends on your generation; prototype defaults)
  let energyRisk = 0;
  if (typeof hvacEnergyKWh === "number" && Number.isFinite(hvacEnergyKWh)) {
    const eLow = trap(hvacEnergyKWh, -1, 0, 4, 10);
    const eMed = tri(hvacEnergyKWh, 8, 16, 28);
    const eHigh = trap(hvacEnergyKWh, 22, 35, 60, 120);

    const denom = eLow + eMed + eHigh;
    const base = eLow * 0.10 + eMed * 0.55 + eHigh * 0.95;
    const eScore = clamp01(denom > 0 ? base / denom : 0);

    // If low occupancy, energy waste matters more
    energyRisk = clamp01(eScore * (0.6 + 0.4 * lowOcc));
  }

  return clamp01(Math.max(flagRisk, powerRisk, energyRisk));
}

/**
 * Carbon impact estimate (placeholder).
 * If your dataset has a carbon factor later, swap this.
 */
export const EMISSION_FACTOR_KG_PER_KWH = 0.4;

export function carbonImpactRiskFromEnergy(hvacEnergyKWh: number): { kgCO2: number; risk: number } {
  if (!Number.isFinite(hvacEnergyKWh)) return { kgCO2: 0, risk: 0 };

  const kg = hvacEnergyKWh * EMISSION_FACTOR_KG_PER_KWH;

  const low = trap(kg, -1, 0, 5, 15);
  const med = tri(kg, 10, 25, 45);
  const high = trap(kg, 35, 55, 90, 160);

  const denom = low + med + high;
  const score = low * 0.10 + med * 0.55 + high * 0.95;
  return { kgCO2: kg, risk: clamp01(denom > 0 ? score / denom : 0) };
}

/**
 * Lighting reduction level (0..1) based on occupancyRate.
 * No isEvent in telemetry, so we assume "not event" unless you add it later.
 */
export function lightingReductionLevelFromOccupancy(occRate: number): number {
  // "emptiness" degree
  const empty = trap(occRate, -0.2, 0.0, 0.10, 0.30);
  const mild = tri(occRate, 0.15, 0.35, 0.55);
  return clamp01(empty * 0.95 + mild * 0.35);
}

/**
 * Ventilation increase level (0..1) from CO2 ppm.
 */
export function ventilationIncreaseLevelFromCO2(co2ppm: number): number {
  return co2RiskFromPpm(co2ppm);
}

/**
 * Combine comfort drivers into one overall comfort degradation risk (0..1).
 * Uses crowd + thermal + CO2 (weighted).
 */
export function overallComfortRisk(params: {
  crowdRisk?: number;
  thermalRisk?: number;
  co2Risk?: number;
}): number {
  const crowd = clamp01(params.crowdRisk ?? 0);
  const therm = clamp01(params.thermalRisk ?? 0);
  const co2 = clamp01(params.co2Risk ?? 0);

  return clamp01(0.40 * crowd + 0.35 * therm + 0.25 * co2);
}

