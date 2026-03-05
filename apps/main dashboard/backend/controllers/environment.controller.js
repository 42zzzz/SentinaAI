const analyticsDb = require("../dbs/analytics.db");
const coreDb = require("../dbs/core.db");

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Simple “air quality score” proxy from available fields (0–100)
function airQualityScore({ tempC, humidityPct, carbonAvg }) {
  // target bands: temp ~23C, humidity ~50%
  const tempPenalty = Math.abs((tempC ?? 0) - 23) * 6.0;       // temp drift hurts fast
  const humPenalty = Math.abs((humidityPct ?? 0) - 50) * 0.8;  // humidity drift moderate
  const carbonPenalty = (carbonAvg ?? 0) * 0.02;               // carbon avg scaled

  const raw = 100 - (tempPenalty + humPenalty + carbonPenalty);
  return Math.round(clamp(raw, 0, 100));
}

// GET /environment/overview?hours=24&zone_id=&hall_id=
exports.getEnvironmentOverview = async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(168, Number(req.query.hours || 24))); // cap 7 days
    const zoneId = req.query.zone_id || null;
    const hallId = req.query.hall_id || null;

    const r = await analyticsDb.query(
      `
      SELECT
        AVG(indoor_temp_c)::float8            AS avg_temp_c,
        AVG(humidity_pct)::float8            AS avg_humidity_pct,
        AVG(comfort_index)::float8           AS avg_comfort_index,
        AVG(energy_efficiency_score)::float8 AS avg_efficiency_score,
        AVG(carbon_kg_co2)::float8           AS avg_carbon_kgco2,
        SUM(carbon_kg_co2)::float8           AS total_carbon_kgco2,
        MAX(indoor_temp_c)::float8           AS max_temp_c,
        MIN(indoor_temp_c)::float8           AS min_temp_c
      FROM interval_metrics
      WHERE ts >= NOW() - make_interval(hours => $1::int)
        AND ($2::text IS NULL OR zone_id = $2)
        AND ($3::text IS NULL OR hall_id = $3);
      `,
      [hours, zoneId, hallId]
    );

    const row = (r.rows && r.rows[0]) || {};
    const avgTempC = Number(row.avg_temp_c || 0);
    const avgHumidityPct = Number(row.avg_humidity_pct || 0);
    const avgComfortIndex = Number(row.avg_comfort_index || 0);
    const avgEfficiencyScore = Number(row.avg_efficiency_score || 0);
    const avgCarbonKg = Number(row.avg_carbon_kgco2 || 0);
    const totalCarbonKg = Number(row.total_carbon_kgco2 || 0);

    const aq = airQualityScore({ tempC: avgTempC, humidityPct: avgHumidityPct, carbonAvg: avgCarbonKg });

    res.json({
      ok: true,
      hours,
      filters: { zone_id: zoneId, hall_id: hallId },
      kpis: {
        air_quality_score: aq,
        avg_temp_c: avgTempC,
        avg_humidity_pct: avgHumidityPct,
        avg_comfort_index: avgComfortIndex,
        avg_efficiency_score: avgEfficiencyScore,
        avg_carbon_kgco2: avgCarbonKg,
        total_carbon_kgco2: totalCarbonKg,
        min_temp_c: Number(row.min_temp_c || 0),
        max_temp_c: Number(row.max_temp_c || 0),
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// GET /environment/by-zone?metric=air_quality|temperature|humidity|carbon|efficiency|comfort&hours=24
exports.getEnvironmentByZone = async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(168, Number(req.query.hours || 24)));
    const metric = String(req.query.metric || "air_quality").toLowerCase();

    const r = await analyticsDb.query(
      `
      SELECT
        zone_id,
        AVG(indoor_temp_c)::float8            AS avg_temp_c,
        AVG(humidity_pct)::float8            AS avg_humidity_pct,
        AVG(carbon_kg_co2)::float8           AS avg_carbon_kgco2,
        AVG(energy_efficiency_score)::float8 AS avg_efficiency_score,
        AVG(comfort_index)::float8           AS avg_comfort_index
      FROM interval_metrics
      WHERE ts >= NOW() - make_interval(hours => $1::int)
        AND zone_id IS NOT NULL
      GROUP BY zone_id
      ORDER BY zone_id ASC;
      `,
      [hours]
    );

    const rows = (r.rows || []).map((z) => {
      const tempC = Number(z.avg_temp_c || 0);
      const hum = Number(z.avg_humidity_pct || 0);
      const carbon = Number(z.avg_carbon_kgco2 || 0);
      const eff = Number(z.avg_efficiency_score || 0);
      const comfort = Number(z.avg_comfort_index || 0);

      const aq = airQualityScore({ tempC, humidityPct: hum, carbonAvg: carbon });

      const value =
        metric === "temperature" ? tempC :
        metric === "humidity" ? hum :
        metric === "carbon" ? carbon :
        metric === "efficiency" ? eff :
        metric === "comfort" ? comfort :
        aq; // default air_quality

      return {
        zone_id: z.zone_id,
        value: Number.isFinite(value) ? value : 0,
        meta: { aq, tempC, hum, carbon, eff, comfort },
      };
    });

    res.json({ ok: true, hours, metric, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// GET /environment/anomalies?hours=24&limit=6
exports.getEnvironmentAnomalies = async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(168, Number(req.query.hours || 24)));
    const limit = Math.max(3, Math.min(12, Number(req.query.limit || 6)));

    const r = await coreDb.query(
      `
      SELECT
        COALESCE(rule_name, rule_key) AS label,
        COUNT(*)::int AS count
      FROM alerts
      WHERE domain = 'SUSTAINABILITY'
        AND detected_at >= NOW() - make_interval(hours => $1::int)
      GROUP BY COALESCE(rule_name, rule_key)
      ORDER BY COUNT(*) DESC
      LIMIT $2;
      `,
      [hours, limit]
    );

    res.json({ ok: true, hours, rows: r.rows || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};