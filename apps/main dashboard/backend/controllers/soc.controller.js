const coreDb = require("../dbs/core.db");

exports.getSocOverview = async (req, res) => {
  try {
    const domain = "SECURITY";

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

exports.getSocLogs = async (req, res) => {
  try {
    const r = await coreDb.query(
      `
      SELECT
        l.log_id,
        l.event_type,
        l.outcome,
        l.user_id,
        u.full_name,
        l.email,
        l.ip_address,
        l.user_agent,
        l.request_path,
        l.http_method,
        l.http_status,
        l.reason,
        l.created_at
      FROM auth_access_audit_log l
      LEFT JOIN users u
        ON u.user_id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT 100
      `
    );

    res.json({
      ok: true,
      rows: r.rows || [],
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};