// backend/controllers/exhibitors.controller.js
const coreDb = require("../dbs/core.db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

exports.getExhibitorFilters = async (req, res) => {
  try {
    const [industries, countries, statuses, tiers] = await Promise.all([
      coreDb.query(`SELECT DISTINCT industry FROM exhibitors WHERE industry IS NOT NULL ORDER BY industry;`),
      coreDb.query(`SELECT DISTINCT hq_country FROM exhibitors WHERE hq_country IS NOT NULL ORDER BY hq_country;`),
      coreDb.query(`SELECT DISTINCT status FROM exhibitors WHERE status IS NOT NULL ORDER BY status;`),
      coreDb.query(`SELECT DISTINCT package_tier FROM event_exhibitors WHERE package_tier IS NOT NULL ORDER BY package_tier;`),
    ]);

    res.json({
      ok: true,
      industries: industries.rows.map(r => r.industry),
      hqCountries: countries.rows.map(r => r.hq_country),
      statuses: statuses.rows.map(r => r.status),
      packageTiers: tiers.rows.map(r => r.package_tier),
      sortOptions: [
        "name_asc",
        "name_desc",
        "revenue_desc",
        "revenue_asc",
        "events_desc",
        "events_asc",
      ],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.listExhibitors = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const industry = req.query.industry || null;
    const hqCountry = req.query.hq_country || null;
    const status = req.query.status || null;

    // Optional: event-specific mode
    const eventId = req.query.event_id || null;
    const packageTier = req.query.package_tier || null;

    const page = Math.max(toInt(req.query.page, 1), 1);
    const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const sort = (req.query.sort || "name_asc").toLowerCase();
    const sortSql = {
      name_asc: `exhibitor_name ASC`,
      name_desc: `exhibitor_name DESC`,
      revenue_desc: `total_paid_aed DESC NULLS LAST`,
      revenue_asc: `total_paid_aed ASC NULLS LAST`,
      events_desc: `events_count DESC NULLS LAST`,
      events_asc: `events_count ASC NULLS LAST`,
    }[sort] || `exhibitor_name ASC`;

    // Aggregate participation/revenue.
    // If eventId is provided, we restrict participation rows to that event only.
    // Otherwise it’s global across all events.
    const sqlCTE = `
      WITH ex_agg AS (
        SELECT
          ee.exhibitor_id,
          COUNT(*)::int AS events_count,
          COALESCE(SUM(ee.amount_paid_aed), 0)::float8 AS total_paid_aed,
          MAX(ee.package_tier) AS any_package_tier
        FROM event_exhibitors ee
        WHERE ($5::text IS NULL OR ee.event_id = $5)
          AND ($6::text IS NULL OR ee.package_tier = $6)
        GROUP BY ee.exhibitor_id
      )
      SELECT
        e.exhibitor_id,
        e.exhibitor_name,
        e.industry,
        e.hq_country,
        e.status,
        e.created_at,
        e.updated_at,
        ec.contact_name,
        ec.contact_email,
        ec.contact_phone,
        COALESCE(a.events_count, 0) AS events_count,
        COALESCE(a.total_paid_aed, 0) AS total_paid_aed,
        a.any_package_tier
      FROM exhibitors e
      LEFT JOIN exhibitor_contacts ec
        ON ec.exhibitor_id = e.exhibitor_id
      LEFT JOIN ex_agg a
        ON a.exhibitor_id = e.exhibitor_id
      WHERE 1=1
        AND ($1::text IS NULL OR e.industry = $1)
        AND ($2::text IS NULL OR e.hq_country = $2)
        AND ($3::text IS NULL OR e.status = $3)
        AND (
          $4::text = '' OR
          e.exhibitor_id ILIKE '%' || $4 || '%' OR
          e.exhibitor_name ILIKE '%' || $4 || '%'
        )
        -- If event_id is provided, only show exhibitors who are actually in that event
        AND ($5::text IS NULL OR a.exhibitor_id IS NOT NULL)
      ORDER BY ${sortSql}, e.exhibitor_id ASC
      LIMIT $7 OFFSET $8;
    `;

    const countSql = `
      WITH ex_agg AS (
        SELECT ee.exhibitor_id
        FROM event_exhibitors ee
        WHERE ($5::text IS NULL OR ee.event_id = $5)
          AND ($6::text IS NULL OR ee.package_tier = $6)
        GROUP BY ee.exhibitor_id
      )
      SELECT COUNT(*)::int AS total
      FROM exhibitors e
      LEFT JOIN ex_agg a ON a.exhibitor_id = e.exhibitor_id
      WHERE 1=1
        AND ($1::text IS NULL OR e.industry = $1)
        AND ($2::text IS NULL OR e.hq_country = $2)
        AND ($3::text IS NULL OR e.status = $3)
        AND (
          $4::text = '' OR
          e.exhibitor_id ILIKE '%' || $4 || '%' OR
          e.exhibitor_name ILIKE '%' || $4 || '%'
        )
        AND ($5::text IS NULL OR a.exhibitor_id IS NOT NULL);
    `;

    const params = [industry, hqCountry, status, q, eventId, packageTier, pageSize, offset];

    const [countRes, dataRes] = await Promise.all([
      coreDb.query(countSql, params.slice(0, 6)),
      coreDb.query(sqlCTE, params),
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

exports.getExhibitorById = async (req, res) => {
  try {
    const { exhibitor_id } = req.params;

    const sql = `
      SELECT
        e.exhibitor_id,
        e.exhibitor_name,
        e.industry,
        e.hq_country,
        e.status,
        e.created_at,
        e.updated_at,
        ec.contact_name,
        ec.contact_email,
        ec.contact_phone
      FROM exhibitors e
      LEFT JOIN exhibitor_contacts ec ON ec.exhibitor_id = e.exhibitor_id
      WHERE e.exhibitor_id = $1;
    `;

    const r = await coreDb.query(sql, [exhibitor_id]);
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: "Exhibitor not found" });

    res.json({ ok: true, exhibitor: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.getExhibitorEvents = async (req, res) => {
  try {
    const { exhibitor_id } = req.params;

    const sql = `
      SELECT
        ee.event_id,
        ev.event_name,
        ev.start_datetime_utc,
        ev.end_datetime_utc,
        ee.package_tier,
        ee.discount_pct,
        ee.amount_paid_aed
      FROM event_exhibitors ee
      JOIN events ev ON ev.event_id = ee.event_id
      WHERE ee.exhibitor_id = $1
      ORDER BY ev.start_datetime_utc DESC;
    `;

    const r = await coreDb.query(sql, [exhibitor_id]);
    res.json({ ok: true, exhibitor_id, rows: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};