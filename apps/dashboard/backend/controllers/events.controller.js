// backend/controllers/events.controller.js
const coreDb = require("../dbs/core.db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

exports.getEventFilters = async (req, res) => {
  try {
    const [statuses, venues] = await Promise.all([
      coreDb.query(`SELECT DISTINCT status FROM events WHERE status IS NOT NULL ORDER BY status;`),
      coreDb.query(`SELECT venue_id, venue_name FROM venues ORDER BY venue_id;`),
    ]);

    res.json({
      ok: true,
      statuses: statuses.rows.map(r => r.status),
      venues: venues.rows, // [{venue_id, venue_name}]
      sortOptions: [
        "start_desc",
        "start_asc",
        "end_desc",
        "end_asc",
        "name_asc",
        "name_desc",
        "attendance_desc",
        "attendance_asc",
        "exhibitors_desc",
        "exhibitors_asc",
        "revenue_desc",
        "revenue_asc",
      ],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.listEvents = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const status = req.query.status || null;
    const venueId = req.query.venue_id || null;
    const from = req.query.from || null; // ISO
    const to = req.query.to || null;

    const page = Math.max(toInt(req.query.page, 1), 1);
    const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const sort = (req.query.sort || "start_desc").toLowerCase();
    const sortSql = {
      start_desc: `e.start_datetime_utc DESC NULLS LAST`,
      start_asc:  `e.start_datetime_utc ASC NULLS LAST`,
      end_desc:   `e.end_datetime_utc DESC NULLS LAST`,
      end_asc:    `e.end_datetime_utc ASC NULLS LAST`,
      name_asc:   `e.event_name ASC`,
      name_desc:  `e.event_name DESC`,
      attendance_desc: `e.expected_attendance_total DESC NULLS LAST`,
      attendance_asc:  `e.expected_attendance_total ASC NULLS LAST`,
      exhibitors_desc: `exhibitors_joined DESC NULLS LAST`,
      exhibitors_asc:  `exhibitors_joined ASC NULLS LAST`,
      revenue_desc:    `revenue_aed DESC NULLS LAST`,
      revenue_asc:     `revenue_aed ASC NULLS LAST`,
    }[sort] || `e.start_datetime_utc DESC NULLS LAST`;

    // We add two “computed” columns from event_exhibitors:
    // - exhibitors_joined = COUNT(*)
    // - revenue_aed = SUM(amount_paid_aed)
    // LEFT JOIN so events with no exhibitors still appear.
    const baseQuery = `
      FROM events e
      LEFT JOIN event_contacts ec ON ec.event_id = e.event_id
      LEFT JOIN venues v ON v.venue_id = e.venue_id
      LEFT JOIN (
        SELECT
          event_id,
          COUNT(*)::int AS exhibitors_joined,
          COALESCE(SUM(amount_paid_aed), 0)::float8 AS revenue_aed
        FROM event_exhibitors
        GROUP BY event_id
      ) ex ON ex.event_id = e.event_id
      WHERE 1=1
        AND ($1::text IS NULL OR e.status = $1)
        AND ($2::text IS NULL OR e.venue_id = $2)
        AND (
          $3::text = '' OR
          e.event_id ILIKE '%' || $3 || '%' OR
          e.event_name ILIKE '%' || $3 || '%'
        )
        AND ($4::timestamptz IS NULL OR e.start_datetime_utc >= $4)
        AND ($5::timestamptz IS NULL OR e.start_datetime_utc <  $5)
    `;

    const countSql = `SELECT COUNT(*)::int AS total ${baseQuery};`;

    const dataSql = `
      SELECT
        e.event_id,
        e.venue_id,
        v.venue_name,
        e.event_name,
        e.start_datetime_utc,
        e.end_datetime_utc,
        e.expected_attendance_total,
        e.expected_exhibitors,
        e.status,
        e.created_at,
        e.updated_at,
        ec.person_in_charge_name,
        ec.person_in_charge_email,
        COALESCE(ex.exhibitors_joined, 0) AS exhibitors_joined,
        COALESCE(ex.revenue_aed, 0) AS revenue_aed
      ${baseQuery}
      ORDER BY ${sortSql}, e.event_id ASC
      LIMIT $6 OFFSET $7;
    `;

    const params = [status, venueId, q, from, to, pageSize, offset];

    const [countRes, dataRes] = await Promise.all([
      coreDb.query(countSql, params.slice(0, 5)),
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

exports.getEventById = async (req, res) => {
  try {
    const { event_id } = req.params;

    const sql = `
      SELECT
        e.event_id,
        e.venue_id,
        v.venue_name,
        e.event_name,
        e.start_datetime_utc,
        e.end_datetime_utc,
        e.expected_attendance_total,
        e.expected_exhibitors,
        e.status,
        e.created_at,
        e.updated_at,
        ec.person_in_charge_name,
        ec.person_in_charge_email,
        COALESCE(ex.exhibitors_joined, 0) AS exhibitors_joined,
        COALESCE(ex.revenue_aed, 0) AS revenue_aed
      FROM events e
      LEFT JOIN event_contacts ec ON ec.event_id = e.event_id
      LEFT JOIN venues v ON v.venue_id = e.venue_id
      LEFT JOIN (
        SELECT
          event_id,
          COUNT(*)::int AS exhibitors_joined,
          COALESCE(SUM(amount_paid_aed), 0)::float8 AS revenue_aed
        FROM event_exhibitors
        GROUP BY event_id
      ) ex ON ex.event_id = e.event_id
      WHERE e.event_id = $1;
    `;

    const r = await coreDb.query(sql, [event_id]);
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: "Event not found" });

    res.json({ ok: true, event: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};