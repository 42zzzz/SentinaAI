const analyticsDb = require("../dbs/analytics.db");
const coreDb = require("../dbs/core.db");
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

// Generic time-series endpoint for dashboards (single-series)
// GET /dashboard/trends?metric=occupancy|congestion|comfort|temperature|energy|carbon
// Optional: event_id, zone_id, hall_id
// Optional: hours (default 6), limit (overrides hours)
exports.getTrends = async (req, res) => {
  try {
    const eventId = req.query.event_id || null;
    const zoneId = req.query.zone_id || null;
    const hallId = req.query.hall_id || null;

    const metric = String(req.query.metric || "occupancy").toLowerCase();
    const hours = Number(req.query.hours || 6);
    const limit = Number.isFinite(Number(req.query.limit))
      ? Number(req.query.limit)
      : Math.max(8, Math.min(7 * 24 * 4, Math.round(hours * 4)));

        // whitelist metrics -> SQL expressions
    const metricExpr =
      metric === "congestion" ? "AVG(flow_congestion_index)::float8" :
      metric === "comfort" ? "AVG(comfort_index)::float8" :
      metric === "temperature" ? "AVG(indoor_temp_c)::float8" :
      metric === "humidity" ? "AVG(humidity_pct)::float8" :
      metric === "efficiency" ? "AVG(energy_efficiency_score)::float8" :
      metric === "energy" ? "AVG(hvac_energy_kwh)::float8" :
      metric === "carbon" ? "AVG(carbon_kg_co2)::float8" :
      "SUM(current_occupancy)::float8";

    const unit =
      metric === "congestion" ? "index" :
      metric === "comfort" ? "index" :
      metric === "temperature" ? "°C" :
      metric === "humidity" ? "%" :
      metric === "efficiency" ? "%" :
      metric === "energy" ? "kWh" :
      metric === "carbon" ? "kgCO2" :
      "people";

    const r = await analyticsDb.query(
      `
      SELECT ts, ${metricExpr} AS value
      FROM interval_metrics
      WHERE ($1::text IS NULL OR event_id = $1)
        AND ($2::text IS NULL OR zone_id = $2)
        AND ($3::text IS NULL OR hall_id = $3)
      GROUP BY ts
      ORDER BY ts DESC
      LIMIT $4;
      `,
      [eventId, zoneId, hallId, limit]
    );

    const points = (r.rows || [])
      .map((x) => ({ ts: x.ts, value: Number(x.value || 0) }))
      .reverse();

    res.json({ ok: true, metric, unit, filters: { event_id: eventId, zone_id: zoneId, hall_id: hallId }, points });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// Snapshot leaderboard to replace large tables with a compact bar chart.
// GET /dashboard/top-halls?metric=occupancy_ratio|congestion|comfort|energy&limit=8
exports.getTopHalls = async (req, res) => {
  try {
    const eventId = req.query.event_id || null;
    const zoneId = req.query.zone_id || null;
    const metric = String(req.query.metric || "occupancy_ratio").toLowerCase();
    const limit = Math.max(3, Math.min(20, Number(req.query.limit || 8)));

    const ts = await getLatestTs({ eventId, zoneId });
    if (!ts) return res.json({ ok: true, ts: null, metric, rows: [] });

    const orderExpr =
      metric === "congestion" ? "flow_congestion_index" :
      metric === "comfort" ? "comfort_index" :
      metric === "energy" ? "hvac_energy_kwh" :
      "occupancy_ratio";

    const r = await analyticsDb.query(
      `
      SELECT
        zone_id,
        hall_id,
        hall_name,
        hall_capacity,
        current_occupancy,
        occupancy_ratio,
        flow_congestion_index,
        comfort_index,
        hvac_energy_kwh,
        carbon_kg_co2,
        is_overcrowded
      FROM interval_metrics
      WHERE ts = $1
        AND ($2::text IS NULL OR event_id = $2)
        AND ($3::text IS NULL OR zone_id = $3)
        AND hall_id IS NOT NULL
      ORDER BY ${orderExpr} DESC NULLS LAST
      LIMIT $4;
      `,
      [ts, eventId, zoneId, limit]
    );

    res.json({ ok: true, ts, metric, rows: r.rows || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ✅ Devices status summary (Active / Inactive / Quarantined)
// GET /dashboard/device-status?zone_id=&hall_id=
exports.getDeviceStatusSummary = async (req, res) => {
  try {
    const zoneId = req.query.zone_id || null;
    const hallId = req.query.hall_id || null;

    const r = await coreDb.query(
      `
      SELECT COALESCE(status,'UNKNOWN') AS status, COUNT(*)::int AS count
      FROM devices
      WHERE ($1::text IS NULL OR zoneid = $1)
        AND ($2::text IS NULL OR hallid = $2)
      GROUP BY COALESCE(status,'UNKNOWN')
      `,
      [zoneId, hallId]
    );

    const raw = r.rows || [];
    const norm = (s) => String(s || "").toLowerCase().trim();

    const isActive = (s) => ["active", "online", "connected"].includes(norm(s));
    const isInactive = (s) => ["inactive", "offline", "disconnected"].includes(norm(s));
    const isQuarantined = (s) =>
      norm(s).includes("quarantine") || norm(s).includes("isolat") || norm(s) === "quarantined";

    let active = 0,
      inactive = 0,
      quarantined = 0,
      other = 0;

    for (const row of raw) {
      const s = row.status;
      const c = Number(row.count || 0);
      if (isActive(s)) active += c;
      else if (isInactive(s)) inactive += c;
      else if (isQuarantined(s)) quarantined += c;
      else other += c;
    }

    res.json({
      ok: true,
      filters: { zone_id: zoneId, hall_id: hallId },
      counts: { active, inactive, quarantined, other },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.getAlertsTrend = async (req, res) => {
  try {
    const domain = (req.query.domain || "OPERATIONS").toUpperCase();

    const lifetime =
      String(req.query.lifetime || "").toLowerCase() === "1" ||
      String(req.query.lifetime || "").toLowerCase() === "true";

    const daysRaw = Number(req.query.days || 0);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 0;

    const hoursRaw = Number(req.query.hours || 6);
    const hours = Number.isFinite(hoursRaw) ? Math.max(1, Math.min(72, hoursRaw)) : 6;

    const bucketMins = 15;
    const mode = lifetime ? "lifetime" : days > 0 ? "days" : "hours";

    const timeClause =
      mode === "lifetime"
        ? ""
        : mode === "days"
        ? "AND detected_at >= NOW() - ($2 || ' days')::interval"
        : "AND detected_at >= NOW() - ($2 || ' hours')::interval";

    const bucketIdx = 1;
    const trendParams =
      mode === "lifetime"
        ? [bucketMins, domain]
        : mode === "days"
        ? [bucketMins, days, domain]
        : [bucketMins, hours, domain];

    const domainIdx = mode === "lifetime" ? 2 : 3;

    const r = await coreDb.query(
      `
      SELECT
        to_timestamp(
          floor(extract(epoch from detected_at) / ($${bucketIdx} * 60)) * ($${bucketIdx} * 60)
        ) AS ts,
        COUNT(*)::int AS value
      FROM alerts
      WHERE domain = $${domainIdx}
      ${timeClause}
      GROUP BY 1
      ORDER BY 1 ASC;
      `,
      trendParams
    );

    const totalParams =
      mode === "lifetime"
        ? [domain]
        : mode === "days"
        ? [days, domain]
        : [hours, domain];

    const totalTimeClause =
      mode === "lifetime"
        ? ""
        : mode === "days"
        ? "AND detected_at >= NOW() - ($1 || ' days')::interval"
        : "AND detected_at >= NOW() - ($1 || ' hours')::interval";

    const totalDomainIdx = mode === "lifetime" ? 1 : 2;

    const totalQ = await coreDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM alerts
      WHERE domain = $${totalDomainIdx}
      ${totalTimeClause}
      `,
      totalParams
    );

    res.json({
      ok: true,
      metric: "alerts",
      unit: "alerts",
      domain,
      range: mode === "lifetime" ? "lifetime" : mode === "days" ? `${days}d` : `${hours}h`,
      lifetime: mode === "lifetime",
      days: mode === "days" ? days : null,
      hours: mode === "hours" ? hours : null,
      total: Number(totalQ.rows?.[0]?.total || 0),
      points: (r.rows || []).map((x) => ({ ts: x.ts, value: Number(x.value || 0) })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.getSocOverview = async (req, res) => {
  try {
    const domain = (req.query.domain || "SECURITY").toUpperCase();

    const [
      openRes,
      criticalOpenRes,
      totalTodayRes,
      resolvedTodayRes,
      quarantinedRes,
      severityRes,
      statusRes,
      recentRes,
      hotZonesRes,
    ] = await Promise.all([
      coreDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM alerts
        WHERE domain = $1
          AND status IN ('NEW', 'ACKNOWLEDGED')
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM alerts
        WHERE domain = $1
          AND status IN ('NEW', 'ACKNOWLEDGED')
          AND severity = 'CRITICAL'
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM alerts
        WHERE domain = $1
          AND detected_at >= date_trunc('day', NOW())
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM alerts
        WHERE domain = $1
          AND status IN ('RESOLVED', 'CLOSED')
          AND resolved_at >= date_trunc('day', NOW())
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM devices
        WHERE LOWER(COALESCE(status, '')) LIKE '%quarantin%'
           OR LOWER(COALESCE(status, '')) LIKE '%isolat%'
        `
      ),

      coreDb.query(
        `
        SELECT severity, COUNT(*)::int AS count
        FROM alerts
        WHERE domain = $1
        GROUP BY severity
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT status, COUNT(*)::int AS count
        FROM alerts
        WHERE domain = $1
        GROUP BY status
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT
          a.alert_id,
          a.rule_key,
          COALESCE(r.rule_name, a.rule_key) AS rule_name,
          a.severity,
          a.status,
          a.zone_id,
          a.hall_id,
          a.device_id,
          a.message,
          a.detected_at
        FROM alerts a
        LEFT JOIN rules r
          ON r.rule_key = a.rule_key
        WHERE a.domain = $1
          AND a.status IN ('NEW', 'ACKNOWLEDGED')
          AND a.severity IN ('CRITICAL', 'HIGH')
        ORDER BY
          CASE a.severity
            WHEN 'CRITICAL' THEN 4
            WHEN 'HIGH' THEN 3
            WHEN 'MEDIUM' THEN 2
            WHEN 'LOW' THEN 1
            ELSE 0
          END DESC,
          a.detected_at DESC
        LIMIT 5
        `,
        [domain]
      ),

      coreDb.query(
        `
        SELECT
          zone_id,
          COUNT(*)::int AS open_count
        FROM alerts
        WHERE domain = $1
          AND status IN ('NEW', 'ACKNOWLEDGED')
          AND zone_id IS NOT NULL
        GROUP BY zone_id
        ORDER BY open_count DESC, zone_id ASC
        LIMIT 5
        `,
        [domain]
      ),
    ]);

    const totalToday = Number(totalTodayRes.rows?.[0]?.total || 0);
    const resolvedToday = Number(resolvedTodayRes.rows?.[0]?.total || 0);

    const severityBreakdown = {};
    for (const row of severityRes.rows || []) {
      severityBreakdown[String(row.severity || "").toUpperCase()] = Number(row.count || 0);
    }

    const statusBreakdown = {};
    for (const row of statusRes.rows || []) {
      statusBreakdown[String(row.status || "").toUpperCase()] = Number(row.count || 0);
    }

    res.json({
      ok: true,
      domain,
      kpis: {
        open_alerts: Number(openRes.rows?.[0]?.total || 0),
        critical_open_alerts: Number(criticalOpenRes.rows?.[0]?.total || 0),
        quarantined_devices: Number(quarantinedRes.rows?.[0]?.total || 0),
        containment_rate_pct: totalToday > 0 ? Math.round((resolvedToday / totalToday) * 100) : 0,
      },
      breakdowns: {
        severity: severityBreakdown,
        status: statusBreakdown,
      },
      recent_alerts: recentRes.rows || [],
      hot_zones: hotZonesRes.rows || [],
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};