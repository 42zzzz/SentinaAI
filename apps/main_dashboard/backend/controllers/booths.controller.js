// backend/controllers/booths.controller.js
const coreDb = require("../dbs/core.db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

exports.getBoothFilters = async (req, res) => {
  try {
    const eventId = req.query.event_id;
    if (!eventId) return res.status(400).json({ ok: false, error: "event_id is required" });

    const [zones, halls, sizes, statuses] = await Promise.all([
      coreDb.query(`SELECT DISTINCT zone_id FROM booths WHERE event_id = $1 ORDER BY zone_id;`, [eventId]),
      coreDb.query(`SELECT DISTINCT hall_id FROM booths WHERE event_id = $1 ORDER BY hall_id;`, [eventId]),
      coreDb.query(`SELECT DISTINCT booth_size_type FROM booths WHERE event_id = $1 ORDER BY booth_size_type;`, [eventId]),
      coreDb.query(`SELECT DISTINCT status FROM booth_assignments WHERE event_id = $1 ORDER BY status;`, [eventId]),
    ]);

    res.json({
      ok: true,
      zones: zones.rows.map(r => r.zone_id),
      halls: halls.rows.map(r => r.hall_id),
      boothSizeTypes: sizes.rows.map(r => r.booth_size_type),
      assignmentStatuses: statuses.rows.map(r => r.status),
      sortOptions: ["booth_code_asc", "booth_code_desc", "area_desc", "area_asc"],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.listBooths = async (req, res) => {
  try {
    const eventId = req.query.event_id;
    if (!eventId) return res.status(400).json({ ok: false, error: "event_id is required" });

    const q = (req.query.q || "").trim();
    const zoneId = req.query.zone_id || null;
    const hallId = req.query.hall_id || null;
    const boothSizeType = req.query.booth_size_type || null;

    const assignedRaw = req.query.assigned; // "true" | "false" | undefined
    const assigned = assignedRaw === "true" ? true : assignedRaw === "false" ? false : null;

    const page = Math.max(toInt(req.query.page, 1), 1);
    const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const sort = (req.query.sort || "booth_code_asc").toLowerCase();
    const sortSql = {
      booth_code_asc: `b.booth_code ASC`,
      booth_code_desc: `b.booth_code DESC`,
      area_desc: `b.booth_area_sqm DESC NULLS LAST`,
      area_asc: `b.booth_area_sqm ASC NULLS LAST`,
    }[sort] || `b.booth_code ASC`;

    const base = `
      FROM booths b
      LEFT JOIN booth_assignments ba
        ON ba.event_id = b.event_id AND ba.booth_id = b.booth_id
      LEFT JOIN exhibitors ex
        ON ex.exhibitor_id = ba.exhibitor_id
      LEFT JOIN halls h
        ON h.hall_id = b.hall_id
      LEFT JOIN zones z
        ON z.zone_id = b.zone_id
      WHERE b.event_id = $1
        AND ($2::text IS NULL OR b.zone_id = $2)
        AND ($3::text IS NULL OR b.hall_id = $3)
        AND ($4::text IS NULL OR b.booth_size_type = $4)
        AND (
          $5::text = '' OR
          b.booth_id ILIKE '%' || $5 || '%' OR
          b.booth_code ILIKE '%' || $5 || '%' OR
          ex.exhibitor_name ILIKE '%' || $5 || '%' OR
          ex.exhibitor_id ILIKE '%' || $5 || '%'
        )
        AND (
          $6::bool IS NULL OR
          ($6 = true AND ba.exhibitor_id IS NOT NULL) OR
          ($6 = false AND ba.exhibitor_id IS NULL)
        )
    `;

    const countSql = `SELECT COUNT(*)::int AS total ${base};`;

    const dataSql = `
      SELECT
        b.event_id,
        b.booth_id,
        b.booth_code,
        b.zone_id,
        b.hall_id,
        h.hall_name,
        h.hall_role,
        b.booth_size_type,
        b.booth_area_sqm,
        ba.exhibitor_id,
        ex.exhibitor_name,
        ba.assigned_at,
        ba.status AS assignment_status,
        (ba.exhibitor_id IS NOT NULL) AS is_assigned
      ${base}
      ORDER BY ${sortSql}, b.booth_id ASC
      LIMIT $7 OFFSET $8;
    `;

    const params = [eventId, zoneId, hallId, boothSizeType, q, assigned, pageSize, offset];

    const [countRes, dataRes] = await Promise.all([
      coreDb.query(countSql, params.slice(0, 6)),
      coreDb.query(dataSql, params),
    ]);

    res.json({
      ok: true,
      page,
      pageSize,
      total: countRes.rows[0]?.total || 0,
      rows: dataRes.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.assignBooth = async (req, res) => {
  try {
    const { event_id, booth_id, exhibitor_id } = req.body || {};
    if (!event_id || !booth_id || !exhibitor_id) {
      return res.status(400).json({ ok: false, error: "event_id, booth_id, exhibitor_id are required" });
    }

    const sql = `
      INSERT INTO booth_assignments (event_id, booth_id, exhibitor_id, assigned_at, status)
      VALUES ($1, $2, $3, NOW(), 'active')
      ON CONFLICT (event_id, booth_id)
      DO UPDATE SET exhibitor_id = EXCLUDED.exhibitor_id, assigned_at = NOW(), status = 'active'
      RETURNING event_id, booth_id, exhibitor_id, assigned_at, status;
    `;

    const r = await coreDb.query(sql, [event_id, booth_id, exhibitor_id]);
    res.json({ ok: true, assignment: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.unassignBooth = async (req, res) => {
  try {
    const { event_id, booth_id } = req.body || {};
    if (!event_id || !booth_id) {
      return res.status(400).json({ ok: false, error: "event_id and booth_id are required" });
    }

    const r = await coreDb.query(
      `DELETE FROM booth_assignments WHERE event_id = $1 AND booth_id = $2 RETURNING event_id, booth_id;`,
      [event_id, booth_id]
    );

    res.json({ ok: true, deleted: r.rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};