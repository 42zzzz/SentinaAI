// backend/controllers/energy.controller.js
const sustainabilityDb = require("../dbs/sustainability.db");

exports.getEnergyConsumption = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    const result = await sustainabilityDb.query(
      `
      SELECT
        ts,
        venue_id,
        zone_id,
        hall_id,
        source,
        device_id,
        metadata,
        hvac_energy_kwh,
        energy_kwh::float8 AS energy_kwh
      FROM energy_consumption
      ORDER BY ts DESC
      LIMIT $1
      `,
      [limit]
    );
    res.json({ ok: true, rows: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.getTopHallsLatestDay = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "5", 10), 50);
    const zoneId = req.query.zone_id || null;
    const source = req.query.source || null;

    const q = `
      WITH latest AS (
        SELECT MAX(ts) AS max_ts FROM energy_consumption
      ),
      bounds AS (
        SELECT
          date_trunc('day', max_ts AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai' AS start_ts,
          (date_trunc('day', max_ts AT TIME ZONE 'Asia/Dubai') + interval '1 day') AT TIME ZONE 'Asia/Dubai' AS end_ts
        FROM latest
      )
      SELECT
        ec.hall_id,
        ec.zone_id,
        SUM(ec.energy_kwh)::float8 AS total_kwh,
        COUNT(*)::int AS records
      FROM energy_consumption ec
      CROSS JOIN bounds b
      WHERE ec.ts >= b.start_ts
        AND ec.ts <  b.end_ts
        AND ec.hall_id IS NOT NULL
        AND ($1::text IS NULL OR ec.zone_id = $1)
        AND ($2::text IS NULL OR ec.source = $2)
      GROUP BY ec.hall_id, ec.zone_id
      ORDER BY total_kwh DESC
      LIMIT $3;
    `;

    const result = await sustainabilityDb.query(q, [zoneId, source, limit]);
    res.json({
      ok: true,
      timezone: "Asia/Dubai",
      zone_id: zoneId,
      source,
      limit,
      rows: result.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};