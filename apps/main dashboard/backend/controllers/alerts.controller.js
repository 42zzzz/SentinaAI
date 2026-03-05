// backend/controllers/alerts.controller.js

const coreDb = require("../dbs/core.db");
const pool = require("../db");
const { runOnce } = require("../utils/alertEngine");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function severityOrderSql(dir = "DESC") {
  const d = String(dir).toUpperCase() === "ASC" ? "ASC" : "DESC";
  return `CASE a.severity
    WHEN 'CRITICAL' THEN 4
    WHEN 'HIGH' THEN 3
    WHEN 'MEDIUM' THEN 2
    WHEN 'LOW' THEN 1
    ELSE 0
  END ${d}`;
}

exports.getAlertFilters = async (req, res) => {
  try {

    const domain = (req.query.domain || "OPERATIONS").toUpperCase();

    const [severities, statuses, zones, halls, rules] = await Promise.all([

      coreDb
        .query(
          `SELECT DISTINCT severity
           FROM alerts
           WHERE domain = $1 AND severity IS NOT NULL
           ORDER BY severity`,
          [domain]
        )
        .catch(() => ({ rows: [] })),

      coreDb
        .query(
          `SELECT DISTINCT status
           FROM alerts
           WHERE domain = $1 AND status IS NOT NULL
           ORDER BY status`,
          [domain]
        )
        .catch(() => ({ rows: [] })),

      coreDb
        .query(
          `SELECT DISTINCT zone_id
           FROM zones
           WHERE zone_id IS NOT NULL
           ORDER BY zone_id`
        )
        .catch(() => ({ rows: [] })),

      coreDb
        .query(
          `SELECT DISTINCT hall_id
           FROM halls
           WHERE hall_id IS NOT NULL
           ORDER BY hall_id`
        )
        .catch(() => ({ rows: [] })),

      coreDb
        .query(
          `SELECT rule_key, rule_name
           FROM rules
           WHERE domain = $1
           ORDER BY rule_key`,
          [domain]
        )
        .catch(() => ({ rows: [] })),
    ]);

    const defaultSev = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const defaultStatus = ["NEW", "ACKNOWLEDGED", "RESOLVED", "CLOSED"];

    res.json({
      ok: true,
      domain,
      severities: severities.rows.length
        ? severities.rows.map((r) => r.severity)
        : defaultSev,

      statuses: statuses.rows.length
        ? statuses.rows.map((r) => r.status)
        : defaultStatus,

      zones: zones.rows.map((r) => r.zone_id),
      halls: halls.rows.map((r) => r.hall_id),
      rules: rules.rows,

      sortOptions: [
        "detected_desc",
        "detected_asc",
        "severity_desc",
        "severity_asc",
        "status_asc",
        "status_desc",
      ],
    });

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.listAlerts = async (req, res) => {

  const domain = (req.query.domain || "OPERATIONS").toUpperCase();

  try {

    const q = (req.query.q || "").trim();
    const severity = req.query.severity || null;
    const status = req.query.status || null;
    const ruleKey = req.query.rule_key || null;
    const zoneId = req.query.zone_id || null;
    const hallId = req.query.hall_id || null;
    const deviceId = req.query.device_id || null;

    const from = req.query.from || null;
    const to = req.query.to || null;

    const page = Math.max(toInt(req.query.page, 1), 1);
    const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const sort = (req.query.sort || "detected_desc").toLowerCase();

    const sortSql =
      {
        detected_desc: `a.detected_at DESC NULLS LAST, a.alert_id DESC`,
        detected_asc: `a.detected_at ASC NULLS LAST, a.alert_id ASC`,
        severity_desc: `${severityOrderSql("DESC")}, a.detected_at DESC NULLS LAST`,
        severity_asc: `${severityOrderSql("ASC")}, a.detected_at DESC NULLS LAST`,
        status_asc: `a.status ASC NULLS LAST, a.detected_at DESC NULLS LAST`,
        status_desc: `a.status DESC NULLS LAST, a.detected_at DESC NULLS LAST`,
      }[sort] || `a.detected_at DESC NULLS LAST, a.alert_id DESC`;

    const base = `
      FROM alerts a
      LEFT JOIN rules r ON r.rule_key = a.rule_key
      WHERE a.domain = $1
        AND ($2::text IS NULL OR a.severity = $2)
        AND ($3::text IS NULL OR a.status = $3)
        AND ($4::text IS NULL OR a.rule_key = $4)
        AND ($5::text IS NULL OR a.zone_id = $5)
        AND ($6::text IS NULL OR a.hall_id = $6)
        AND ($7::text IS NULL OR a.device_id = $7)
        AND (
          $8::text = '' OR
          CAST(a.alert_id AS TEXT) ILIKE '%' || $8 || '%' OR
          a.message ILIKE '%' || $8 || '%' OR
          a.rule_key ILIKE '%' || $8 || '%' OR
          COALESCE(r.rule_name,'') ILIKE '%' || $8 || '%' OR
          COALESCE(a.device_id,'') ILIKE '%' || $8 || '%' OR
          COALESCE(a.hall_id,'') ILIKE '%' || $8 || '%' OR
          COALESCE(a.zone_id,'') ILIKE '%' || $8 || '%'
        )
        AND ($9::timestamptz IS NULL OR a.detected_at >= $9)
        AND ($10::timestamptz IS NULL OR a.detected_at < $10)
    `;

    const countSql = `SELECT COUNT(*)::int AS total ${base};`;

    const dataSql = `
      SELECT
        a.alert_id,
        a.rule_key,
        COALESCE(r.rule_name, a.rule_key) AS rule_name,
        a.domain,
        a.severity,
        a.status,
        a.device_id,
        a.zone_id,
        a.hall_id,
        a.event_timestamp,
        a.detected_at,
        a.trigger_value,
        a.threshold_value,
        a.message,
        a.metadata,
        a.recommended_action,
        a.action_status,
        a.auto_response_executed,
        a.acknowledged_by,

        CASE
          WHEN a.status IN ('ACKNOWLEDGED','RESOLVED','CLOSED')
          THEN a.acknowledged_at
          ELSE NULL
        END AS acknowledged_at,

        CASE
          WHEN a.status IN ('RESOLVED','CLOSED')
          THEN a.resolved_at
          ELSE NULL
        END AS resolved_at,

        a.response_type,
        a.response_action

      ${base}

      ORDER BY ${sortSql}

      LIMIT $11 OFFSET $12
    `;

    const params = [
      domain,
      severity,
      status,
      ruleKey,
      zoneId,
      hallId,
      deviceId,
      q,
      from,
      to,
      pageSize,
      offset,
    ];

    const [countRes, dataRes] = await Promise.all([
      coreDb.query(countSql, params.slice(0, 10)),
      coreDb.query(dataSql, params),
    ]);

    res.json({
      ok: true,
      domain,
      page,
      pageSize,
      total: countRes.rows[0]?.total || 0,
      rows: dataRes.rows || [],
    });

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.acknowledgeAlert = async (req, res) => {

  const domain = (req.query.domain || "OPERATIONS").toUpperCase();

  try {

    const id = toInt(req.params.id, null);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid alert id" });

    const userId = req.body?.user_id ? String(req.body.user_id) : null;

    const upd = await coreDb.query(
      `
      UPDATE alerts
      SET
        status = 'ACKNOWLEDGED',
        acknowledged_by = COALESCE($2::bigint, acknowledged_by),
        acknowledged_at = NOW()
      WHERE alert_id = $1
        AND domain = $3
        AND status = 'NEW'
      RETURNING alert_id, status, acknowledged_by, acknowledged_at
      `,
      [id, userId, domain]
    );

    if (!upd.rows.length) {

      const cur = await coreDb.query(
        `
        SELECT alert_id, status, acknowledged_by, acknowledged_at
        FROM alerts
        WHERE alert_id = $1 AND domain = $2
        LIMIT 1
        `,
        [id, domain]
      );

      if (!cur.rows.length)
        return res.status(404).json({ ok: false, error: "Alert not found" });

      return res.status(409).json({
        ok: false,
        error: "Alert already acknowledged/resolved",
        alert: cur.rows[0],
      });
    }

    res.json({ ok: true, alert: upd.rows[0] });

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.resolveAlert = async (req, res) => {

  const domain = (req.query.domain || "OPERATIONS").toUpperCase();

  try {

    const id = toInt(req.params.id, null);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid alert id" });

    const r = await coreDb.query(
      `
      UPDATE alerts
      SET
        status = CASE
          WHEN status IN ('RESOLVED','CLOSED') THEN status
          ELSE 'RESOLVED'
        END,

        resolved_at = CASE
          WHEN status IN ('RESOLVED','CLOSED') THEN resolved_at
          ELSE NOW()
        END

      WHERE alert_id = $1
        AND domain = $2

      RETURNING alert_id, status, resolved_at
      `,
      [id, domain]
    );

    if (!r.rows.length)
      return res.status(404).json({ ok: false, error: "Alert not found" });

    res.json({ ok: true, alert: r.rows[0] });

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.runEngineOnce = async (req, res) => {
  try {
    const out = await runOnce();
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.getAlertDetails = async (req, res) => {

  try {

    const { id } = req.params;

    const alertQuery = `
      SELECT 
        a.alert_id,
        a.rule_key,
        r.rule_name,
        a.severity,
        a.status,
        a.zone_id,
        a.hall_id,
        a.device_id,
        a.trigger_value,
        a.threshold_value,
        a.detected_at,
        a.message,
        a.action_taken,

        r.default_response_action,
        r.default_response_type,
        r.auto_mitigation_enabled,
        r.recommended_actions

      FROM alerts a
      JOIN rules r
        ON a.rule_key = r.rule_key
      WHERE a.alert_id = $1
    `;

    const result = await coreDb.query(alertQuery, [id]);

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Alert not found"
      });
    }

    const alert = result.rows[0];

    /* ---------- Build actions ---------- */

    let actions = [];

    if (alert.recommended_actions) {

      const list = alert.recommended_actions
        .split(",")
        .map(a => a.trim())
        .filter(Boolean);

      actions = list.map((name, i) => ({
        action_key: name.toLowerCase().replace(/\s+/g, "_"),
        action_name: name,
        impact: String(alert.severity || "medium").toLowerCase(),
        automated: i === 0 && alert.auto_mitigation_enabled === true
      }));

    }

    res.json({
      ok: true,
      alert,
      actions
    });

  } catch (err) {

    console.error("getAlertDetails error:", err);

    res.status(500).json({
      ok: false,
      error: "Failed to fetch alert details"
    });

  }

};

exports.executeActions = async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid alert id" });

    const userId = req.body?.user_id ? Number(req.body.user_id) : null;
    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];

    if (!actions.length) {
      return res.status(400).json({ ok: false, error: "No actions provided" });
    }

    // store the executed actions as a readable string
    const actionTakenText = actions.join(", ");

    const upd = await coreDb.query(
      `
      UPDATE alerts
      SET
        action_taken = $2,
        response_action = $2,
        response_type = 'MANUAL',
        action_status = 'COMPLETED',
        auto_response_executed = TRUE,
        status = 'RESOLVED',
        resolved_at = NOW(),
        acknowledged_by = COALESCE($3, acknowledged_by),
        acknowledged_at = COALESCE(acknowledged_at, NOW())
      WHERE alert_id = $1
      AND status NOT IN ('RESOLVED','CLOSED')
      RETURNING alert_id, status, action_status, action_taken, response_action
      `,
      [id, actionTakenText, userId]
    );

    if (!upd.rows.length) return res.status(404).json({ ok: false, error: "Alert not found" });

    res.json({ ok: true, alert: upd.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};