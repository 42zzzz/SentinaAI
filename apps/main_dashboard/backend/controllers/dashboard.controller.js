const analyticsDb = require("../dbs/analytics.db");

// Helper: pick the latest timestamp (interval) for a given event/zone
async function getLatestTs({ eventId, zoneId }) {
  const r = await analyticsDb.query(
    `
    SELECT MAX(ts) AS max_ts
    FROM interval_metrics
    WHERE ($1::text IS NULL OR event_id = $1)
      AND ($2::text IS NULL OR zone_id = $2)
    `,
    [eventId || null, zoneId || null]
  );
  return r.rows[0]?.max_ts;
}

exports.debugDb = async (req, res) => {
  try {
    const r = await analyticsDb.query(`
      SELECT current_database() AS db, current_schema() AS schema, current_user AS user
    `);
    res.json({ ok: true, ...r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.getOverview = async (req, res) => {
  try {
    const eventId = req.query.event_id || null;
    const zoneId = req.query.zone_id || null;

    const ts = await getLatestTs({ eventId, zoneId });
    if (!ts) return res.json({ ok: true, ts: null, rows: [], kpis: {} });

    // KPIs computed from latest interval snapshot
    const kpi = await analyticsDb.query(
      `
      SELECT
        COALESCE(SUM(current_occupancy),0)::int AS current_occupancy,
        COALESCE(AVG(indoor_temp_c),0)::float8 AS avg_temp_c,
        COALESCE(AVG(comfort_index),0)::float8 AS avg_comfort_index,
        COALESCE(AVG(flow_congestion_index),0)::float8 AS avg_congestion_index,
        COALESCE(SUM(CASE WHEN is_overcrowded THEN 1 ELSE 0 END),0)::int AS overcrowded_halls
      FROM interval_metrics
      WHERE ts = $1
        AND ($2::text IS NULL OR event_id = $2)
        AND ($3::text IS NULL OR zone_id = $3)
      `,
      [ts, eventId, zoneId]
    );

    // "Crowd flow efficiency" isn’t a direct column. We can derive a proxy:
    // Higher congestion_index => lower efficiency.
    // Clamp to 0-100.
    const row = kpi.rows[0];
    const congestion = Number(row.avg_congestion_index || 0);
    const crowdFlowEfficiency = Math.max(0, Math.min(100, Math.round(100 - congestion * 100)));

    res.json({
      ok: true,
      ts,
      filters: { event_id: eventId, zone_id: zoneId },
      kpis: {
        currentOccupancy: row.current_occupancy,
        averageTemperatureC: Number(row.avg_temp_c.toFixed(2)),
        comfortIndex: Number(row.avg_comfort_index.toFixed(2)),
        crowdFlowEfficiencyPct: crowdFlowEfficiency,
        overcrowdedHalls: row.overcrowded_halls,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.getZonesSummary = async (req, res) => {
  try {
    const eventId = req.query.event_id || null;

    const ts = await getLatestTs({ eventId, zoneId: null });
    if (!ts) return res.json({ ok: true, ts: null, rows: [] });

    const r = await analyticsDb.query(
      `
      SELECT
        zone_id,
        -- occupancy ratio averaged across halls in zone
        (AVG(occupancy_ratio) * 100)::float8 AS occupancy_pct,
        AVG(flow_congestion_index)::float8 AS congestion_index,
        AVG(comfort_index)::float8 AS comfort_index,
        SUM(CASE WHEN is_overcrowded THEN 1 ELSE 0 END)::int AS overcrowded_halls
      FROM interval_metrics
      WHERE ts = $1
        AND ($2::text IS NULL OR event_id = $2)
      GROUP BY zone_id
      ORDER BY zone_id;
      `,
      [ts, eventId]
    );

    // Convert into UI-friendly labels like your Figma
    const rows = r.rows.map(z => {
      const occ = Number(z.occupancy_pct || 0);
      const congestion = Number(z.congestion_index || 0);
      const comfort = Number(z.comfort_index || 0);

      const occupancyStatus =
        occ >= 80 ? `High (${occ.toFixed(0)}%)` :
        occ >= 50 ? `Moderate (${occ.toFixed(0)}%)` :
        `Low (${occ.toFixed(0)}%)`;

      const crowdFlow =
        congestion >= 0.7 ? "Slow" :
        congestion >= 0.4 ? "Caution" :
        "Smooth";

      const issues = z.overcrowded_halls > 0 ? ["Overcrowding"] : [];

      return {
        zone_id: z.zone_id,
        occupancyStatus,
        crowdFlow,
        comfortScore: Number(comfort.toFixed(0)),
        issues,
        issueStatus: issues.length ? "Critical" : "Normal",
      };
    });

    res.json({ ok: true, ts, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.getMapLayer = async (req, res) => {
  try {
    const eventId = req.query.event_id || null;
    const metric = (req.query.metric || "occupancy").toLowerCase();

    const ts = await getLatestTs({ eventId, zoneId: null });
    if (!ts) return res.json({ ok: true, ts: null, metric, rows: [] });

    const metricExpr =
      metric === "comfort" ? "comfort_index" :
      metric === "congestion" ? "flow_congestion_index" :
      "occupancy_ratio"; // default occupancy

    const r = await analyticsDb.query(
      `
      SELECT
        zone_id,
        hall_id,
        hall_name,
        x_coord,
        y_coord,
        ${metricExpr}::float8 AS value
      FROM interval_metrics
      WHERE ts = $1
        AND ($2::text IS NULL OR event_id = $2)
        AND hall_id IS NOT NULL
      `,
      [ts, eventId]
    );

    res.json({ ok: true, ts, metric, rows: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};