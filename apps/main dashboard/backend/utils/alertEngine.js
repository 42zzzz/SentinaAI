const coreDb = require("../dbs/core.db");
const analyticsDb = require("../dbs/analytics.db");

function nowIso() {
  return new Date().toISOString();
}

function isSafeColumnName(s) {
  return /^[a-z_][a-z0-9_]*$/i.test(String(s || ""));
}

function compare(op, lhs, rhs) {
  const a = Number(lhs);
  const b = Number(rhs);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  switch (op) {
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    case "=": return a === b;
    default: return false;
  }
}

function normalizeAgg(agg) {
  const a = String(agg || "LATEST").toUpperCase();
  const allowed = new Set(["COUNT", "SUM", "AVG", "MAX", "LATEST"]);
  return allowed.has(a) ? a : "LATEST";
}

function normalizeOp(op) {
  const o = String(op || ">=");
  return [">", "<", ">=", "<=", "="].includes(o) ? o : ">=";
}

function normalizeSeverity(sev) {
  const s = String(sev || "LOW").toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(s) ? s : "LOW";
}

async function getLatestIntervalTs() {
  const r = await analyticsDb.query(`SELECT MAX(ts) AS max_ts FROM interval_metrics;`);
  return r.rows[0]?.max_ts || null;
}

async function getEnabledRules(domain) {
  const r = await coreDb.query(
    `
    SELECT
      rule_id, rule_key, domain, rule_name, description,
      event_type, field_path, aggregation, window_seconds,
      operator, threshold_value, base_severity,
      escalation_enabled, escalation_window_seconds, escalation_threshold,
      cooldown_seconds, default_response_type, default_response_action,
      auto_mitigation_enabled
    FROM rules
    WHERE enabled = TRUE
      AND ($1::text IS NULL OR domain = $1)
    ORDER BY rule_id ASC;
    `,
    [domain]
  );
  return r.rows || [];
}

async function lastAlertDetectedAt({ ruleKey, domain, zoneId, hallId, deviceId }) {
  const r = await coreDb.query(
    `
    SELECT detected_at
    FROM alerts
    WHERE rule_key = $1
      AND domain = $2
      AND COALESCE(zone_id,'') = COALESCE($3::text,'')
      AND COALESCE(hall_id,'') = COALESCE($4::text,'')
      AND COALESCE(device_id,'') = COALESCE($5::text,'')
    ORDER BY detected_at DESC
    LIMIT 1;
    `,
    [ruleKey, domain, zoneId || "", hallId || "", deviceId || ""]
  );
  return r.rows[0]?.detected_at || null;
}

async function insertAlert(payload) {
  const {
    ruleKey, domain, severity, status,
    deviceId, zoneId, hallId,
    eventTimestamp, triggerValue, thresholdValue,
    message, metadata, recommendedAction,
    actionStatus, autoResponseExecuted,
    responseType, responseAction,
    escalationLevel,
  } = payload;

  const r = await coreDb.query(
    `
    INSERT INTO alerts (
      rule_key, domain, severity, status,
      device_id, zone_id, hall_id,
      event_timestamp, trigger_value, threshold_value,
      message, escalation_level, metadata,
      recommended_action, action_status,
      auto_response_executed, response_type, response_action
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8::timestamptz,
      $9::double precision,
      $10::double precision,
      $11,
      $12::int,
      $13::jsonb,
      $14,
      $15,
      $16::boolean,
      $17,
      $18
    )
    RETURNING alert_id;
    `,
    [
      ruleKey, domain, severity, status,
      deviceId || null, zoneId || null, hallId || null,
      eventTimestamp,
      triggerValue,
      thresholdValue,
      message,
      escalationLevel ?? 0,
      metadata ? JSON.stringify(metadata) : "{}",
      recommendedAction || null,
      actionStatus || null,
      !!autoResponseExecuted,
      responseType || null,
      responseAction || null,
    ]
  );

  return r.rows[0]?.alert_id;
}

async function evaluateOperationsRule(rule, endTs) {
  const field = String(rule.field_path || "").trim();
  if (!field || !isSafeColumnName(field)) return { triggered: 0, inserted: 0, skippedCooldown: 0, reasons: ["invalid_field"] };

  const agg = normalizeAgg(rule.aggregation);
  const op = normalizeOp(rule.operator);
  const threshold = Number(rule.threshold_value);
  if (!Number.isFinite(threshold)) return { triggered: 0, inserted: 0, skippedCooldown: 0, reasons: ["invalid_threshold"] };

  const windowSeconds = Number(rule.window_seconds);
  const hasWindow = Number.isFinite(windowSeconds) && windowSeconds > 0;

  const startTs = hasWindow
    ? new Date(new Date(endTs).getTime() - windowSeconds * 1000).toISOString()
    : null;

  let sql;
  let params;

  if (agg === "LATEST" || !hasWindow) {
    sql = `
      SELECT zone_id, hall_id, hall_name, ${field} AS trigger_value
      FROM interval_metrics
      WHERE ts = $1
        AND hall_id IS NOT NULL;
    `;
    params = [endTs];
  } else {
    const aggSql =
      agg === "AVG" ? `AVG(${field})` :
      agg === "MAX" ? `MAX(${field})` :
      agg === "SUM" ? `SUM(${field})` :
      `COUNT(${field})`;

    sql = `
      SELECT zone_id, hall_id, MAX(hall_name) AS hall_name, ${aggSql} AS trigger_value
      FROM interval_metrics
      WHERE ts > $1::timestamptz AND ts <= $2::timestamptz
        AND hall_id IS NOT NULL
      GROUP BY zone_id, hall_id;
    `;
    params = [startTs, endTs];
  }

  const r = await analyticsDb.query(sql, params);
  const rows = r.rows || [];

  let triggered = 0;
  let inserted = 0;
  let skippedCooldown = 0;

  for (const row of rows) {
    const value = row.trigger_value;
    if (!compare(op, value, threshold)) continue;
    triggered += 1;

    const zoneId = row.zone_id || null;
    const hallId = row.hall_id || null;
    const deviceId = null;

    const cooldownSeconds = Number(rule.cooldown_seconds);
    if (Number.isFinite(cooldownSeconds) && cooldownSeconds > 0) {
      const last = await lastAlertDetectedAt({ ruleKey: rule.rule_key, domain: rule.domain, zoneId, hallId, deviceId });
      if (last) {
        const lastMs = new Date(last).getTime();
        const nowMs = Date.now();
        if (Number.isFinite(lastMs) && nowMs - lastMs < cooldownSeconds * 1000) {
          skippedCooldown += 1;
          continue;
        }
      }
    }

    let severity = normalizeSeverity(rule.base_severity);
    let escalationLevel = 0;

    if (rule.escalation_enabled) {
      const escWindow = Number(rule.escalation_window_seconds);
      const escThresh = Number(rule.escalation_threshold);
      if (Number.isFinite(escWindow) && escWindow > 0 && Number.isFinite(escThresh) && escThresh > 0) {
        const since = new Date(Date.now() - escWindow * 1000).toISOString();
        const countRes = await coreDb.query(
          `
          SELECT COUNT(*)::int AS c
          FROM alerts
          WHERE rule_key = $1
            AND domain = $2
            AND COALESCE(zone_id,'') = COALESCE($3::text,'')
            AND COALESCE(hall_id,'') = COALESCE($4::text,'')
            AND detected_at >= $5::timestamptz;
          `,
          [rule.rule_key, rule.domain, zoneId || "", hallId || "", since]
        );
        const c = countRes.rows[0]?.c || 0;
        if (c >= escThresh) {
          severity = "CRITICAL";
          escalationLevel = 1;
        }
      }
    }

    const message = rule.description
      ? `${rule.rule_name}: ${rule.description}`
      : `${rule.rule_name}: ${field} ${op} ${threshold}`;

    await insertAlert({
      ruleKey: rule.rule_key,
      domain: rule.domain,
      severity,
      status: "NEW",
      deviceId,
      zoneId,
      hallId,
      eventTimestamp: endTs,
      triggerValue: Number(value),
      thresholdValue: threshold,
      message,
      escalationLevel,
      metadata: { field_path: field, aggregation: agg, window_seconds: hasWindow ? windowSeconds : null, evaluated_at: nowIso() },
      recommendedAction: rule.default_response_action || null,
      actionStatus: rule.auto_mitigation_enabled ? "PENDING" : null,
      autoResponseExecuted: false,
      responseType: rule.default_response_type || null,
      responseAction: rule.default_response_action || null,
    });

    inserted += 1;
  }

  return { triggered, inserted, skippedCooldown, reasons: [] };
}

async function runOnce() {
  const startedAt = nowIso();
  const endTs = await getLatestIntervalTs();
  if (!endTs) return { startedAt, finishedAt: nowIso(), rules: 0, inserted: 0, note: "No interval_metrics yet" };

  let rules;
  try {
    rules = await getEnabledRules("OPERATIONS");
  } catch (e) {
    return { startedAt, finishedAt: nowIso(), rules: 0, inserted: 0, note: `Rules unavailable: ${e.message}` };
  }

  let inserted = 0;
  const perRule = [];

  for (const rule of rules) {
    try {
      const out = await evaluateOperationsRule(rule, endTs);
      inserted += out.inserted;
      perRule.push({ rule_key: rule.rule_key, ...out });
    } catch (e) {
      perRule.push({ rule_key: rule.rule_key, error: e.message });
    }
  }

  return { startedAt, finishedAt: nowIso(), ts: endTs, rules: rules.length, inserted, perRule };
}

module.exports = { runOnce };