// src/dbProviders.ts
/**
 * DB PROVIDERS (Teammate work area)
 * --------------------------------
 * Goal:
 * - Load rules from the RULES table (schema = Rules_updated_with_actions_v2.csv)
 * - Load capacities from sentina_core.zones (zone_id -> zone_capacity)
 * - Insert alerts into the ALERTS table (schema = sentina_generated_alerts_final.csv)
 *
 * IMPORTANT:
 * - Do NOT modify RuleEngine logic files.
 * - These classes are the ONLY place where SQL/DB client code should exist.
 * - Keep returned objects exactly matching RuleRow and AlertInsert from src/types.ts
 */

import type { AlertsSink, CapacityProvider, RulesProvider } from "./integration";
import type { AlertInsert, RuleRow } from "./types";

/**
 * Use whichever DB you actually have (MySQL or Postgres).
 * Your teammate should pick ONE client library:
 *
 * Postgres:
 *   npm i pg
 *   import { Pool } from "pg"
 *
 * MySQL:
 *   npm i mysql2
 *   import mysql from "mysql2/promise"
 *
 * This file is written client-agnostic so you can adapt it easily.
 */

// -------------------------
// 1) Define a minimal DB client shape
// -------------------------
export type DbClient = {
  /**
   * Must return rows as plain JS objects where keys match column names.
   * For pg: pool.query(sql, params) -> { rows: any[] }
   * For mysql2: conn.execute(sql, params) -> [rows, fields]
   */
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
};

// -------------------------
// 2) Create DB client/pool (Teammate fills this)
// -------------------------
export async function makeDbClient(): Promise<DbClient> {
  /**
   * TODO (Teammate):
   * - Read DB connection settings from env vars, e.g.:
   *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
   *
   * - Create connection/pool and return an object that implements:
   *   query(sql, params) => { rows }
   *
   * NOTE:
   * - If you use Postgres with "pg", implement:
   *   const pool = new Pool(...)
   *   return { query: async (sql, params) => { const r = await pool.query(sql, params); return { rows: r.rows }; } }
   *
   * - If you use MySQL with mysql2/promise, implement:
   *   const pool = mysql.createPool(...)
   *   return { query: async (sql, params) => { const [rows] = await pool.execute(sql, params); return { rows: rows as any[] }; } }
   */
  throw new Error("makeDbClient() not implemented yet. Teammate must implement DB connection.");
}

// -------------------------
// 3) Rules Provider: SELECT active rules from DB
// -------------------------
export class DbRulesProvider implements RulesProvider {
  constructor(private db: DbClient) {}

  async loadActiveRules(): Promise<RuleRow[]> {
    /**
     * TODO (Teammate):
     * - Replace table name below with your actual rules table name.
     * - Use the CSV Rules_updated_with_actions_v2.csv as the SOURCE OF TRUTH for columns.
     *
     * REQUIRED OUTPUT: RuleRow[]
     * Keys MUST match src/types.ts exactly.
     *
     * If your DB columns are snake_case already, mapping is easy.
     * If your DB columns differ, map them here.
     */

    const sql = `
      SELECT
        rule_key,
        domain,
        rule_name,
        description,
        event_type,
        field_path,
        aggregation,
        window_seconds,
        operator,
        threshold_value,
        base_severity,
        escalation_enabled,
        escalation_window_seconds,
        escalation_threshold,
        cooldown_seconds,
        default_response_type,
        default_response_action,
        auto_mitigation_enabled
      FROM sentina_core.rules  -- TODO: update table name if different
      WHERE is_active = true   -- TODO: update condition if your schema uses a different flag
    `;

    const { rows } = await this.db.query<any>(sql);

    // Normalize types (DB may return strings for booleans/numbers)
    return rows.map((r) => ({
      rule_key: String(r.rule_key),
      domain: String(r.domain),
      rule_name: String(r.rule_name),
      description: String(r.description ?? ""),

      event_type: String(r.event_type),
      field_path: String(r.field_path),

      aggregation: String(r.aggregation) as RuleRow["aggregation"],
      window_seconds: Number(r.window_seconds),

      operator: String(r.operator) as RuleRow["operator"],
      threshold_value: Number(r.threshold_value),

      base_severity: String(r.base_severity) as RuleRow["base_severity"],

      escalation_enabled: Boolean(r.escalation_enabled),
      escalation_window_seconds:
        r.escalation_window_seconds === null || r.escalation_window_seconds === undefined
          ? null
          : Number(r.escalation_window_seconds),
      escalation_threshold:
        r.escalation_threshold === null || r.escalation_threshold === undefined
          ? null
          : Number(r.escalation_threshold),

      cooldown_seconds: Number(r.cooldown_seconds),

      default_response_type: String(r.default_response_type) as RuleRow["default_response_type"],
      default_response_action: String(r.default_response_action ?? ""),

      auto_mitigation_enabled: Boolean(r.auto_mitigation_enabled),
    }));
  }
}

// -------------------------
// 4) Capacity Provider: SELECT zone capacities from DB
// -------------------------
export class DbCapacityProvider implements CapacityProvider {
  constructor(private db: DbClient) {}

  async loadCapacityByZone(): Promise<Record<string, number>> {
    /**
     * TODO (Teammate):
     * - Confirm actual column names: zone_id + zone_capacity (per schema snapshot)
     * - Confirm actual schema/db name prefix if needed
     */
    const sql = `
      SELECT zone_id, zone_capacity
      FROM sentina_core.zones
    `;

    const { rows } = await this.db.query<any>(sql);

    const out: Record<string, number> = {};
    for (const r of rows) {
      const zoneId = String(r.zone_id);
      const cap = Number(r.zone_capacity);
      if (zoneId && Number.isFinite(cap)) out[zoneId] = cap;
    }
    return out;
  }
}

// -------------------------
// 5) Alerts Sink: INSERT generated alerts into DB
// -------------------------
export class DbAlertsSink implements AlertsSink {
  constructor(private db: DbClient) {}

  async writeAlerts(alerts: AlertInsert[]): Promise<void> {
    /**
     * TODO (Teammate):
     * - Replace table name below with your actual alerts table name.
     * - Use sentina_generated_alerts_final.csv as the SOURCE OF TRUTH for columns.
     *
     * NOTE:
     * - Engine already builds metadata as a JSON string.
     * - Keep action/status fields consistent with your DB constraints (enums, etc).
     */
    if (alerts.length === 0) return;

    const sql = `
      INSERT INTO sentina_core.alerts (  -- TODO: update schema/table name
        rule_key, domain, severity, status,
        device_id, zone_id, hall_id,
        event_timestamp, detected_at,
        trigger_value, threshold_value,
        message, escalation_level,
        metadata,
        recommended_action, action_status,
        auto_response_executed,
        acknowledged_by, acknowledged_at, resolved_at,
        response_type, response_action
      )
      VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?,
        ?, ?,
        ?,
        ?, ?, ?,
        ?, ?
      )
    `;

    /**
     * IMPORTANT:
     * - The placeholder style above uses "?" (MySQL style).
     * - If you're using Postgres, you'll change placeholders to $1..$N and batch insert properly.
     *
     * Easiest approach:
     * - For MySQL: loop and call query(sql, params) per alert (fine for prototype)
     * - For Postgres: build one INSERT ... VALUES (...), (...), (...) with $ placeholders
     */

    for (const a of alerts) {
      const params = [
        a.rule_key,
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
        a.escalation_level,

        a.metadata,

        a.recommended_action,
        a.action_status,

        a.auto_response_executed,

        a.acknowledged_by,
        a.acknowledged_at,
        a.resolved_at,

        a.response_type,
        a.response_action,
      ];

      await this.db.query(sql, params);
    }
  }
}