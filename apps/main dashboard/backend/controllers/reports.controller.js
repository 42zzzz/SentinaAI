const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const core = require("../dbs/core.db");
const analytics = require("../dbs/analytics.db");
const { renderReport } = require("../services/reportExport.client");

const DOMAIN_PREFIX = {
  operations: "OP",
  sustainability: "SU",
  exhibitors: "EX",
  soc: "SC",
};

const SECTION_LABELS = {
  operations: {
    hall_utilization: "Hall Utilization Ranking",
    event_impact: "Event Impact Analysis",
    peak_congestion: "Peak Congestion Windows",
    stress_index: "Operational Stress Index",
  },
  sustainability: {
    energy: "Energy Consumption",
    environment: "Environmental Conditions",
    occupancy: "Occupancy Overview",
  },
  exhibitors: {
    booth_profile: "Exhibitor Profile",
    traffic_overview: "Booth Traffic Overview",
    engagement_analysis: "Visitor Engagement Analysis",
    time_analysis: "Operating Environment Analysis",
    performance_breakdown: "Performance Breakdown",
  },
};

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
  return [String(value)];
}

function normalizeFormat(format) {
  const fmt = String(format || "pdf").toLowerCase();
  return fmt === "xlsx" ? "xlsx" : "pdf";
}

function normalizeDomain(domain) {
  const value = String(domain || "").toLowerCase();
  if (["operations", "sustainability", "exhibitors", "soc"].includes(value)) {
    return value;
  }
  throw new Error(`Unsupported report domain: ${domain}`);
}

function reportStorageRoot() {
  const root = path.resolve(__dirname, "..", "storage", "reports");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function buildReportStorage(domain, reportCode, format) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const folder = path.join(reportStorageRoot(), domain, year, month);
  fs.mkdirSync(folder, { recursive: true });
  const fileName = `${reportCode}.${format}`;
  return {
    fileName,
    filePath: path.join(folder, fileName),
  };
}

function fallbackReportCode(domain) {
  const prefix = DOMAIN_PREFIX[domain] || "RP";
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  return `${prefix}-${stamp}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

async function generateReportCode(domain) {
  try {
    const result = await core.query("SELECT generate_report_code($1) AS report_code", [domain]);
    const value = result.rows?.[0]?.report_code;
    if (value) return value;
  } catch (error) {
    console.warn("[reports] generate_report_code fallback:", error.message);
  }
  return fallbackReportCode(domain);
}

async function getUserDisplayName(userId) {
  if (!userId) return null;
  try {
    const result = await core.query("SELECT full_name FROM users WHERE user_id = $1 LIMIT 1", [userId]);
    return result.rows?.[0]?.full_name || null;
  } catch {
    return null;
  }
}

function deriveReportType(domain, sectionList) {
  const labels = sectionList
    .map((item) => SECTION_LABELS[domain]?.[item] || String(item || "").replace(/_/g, " "))
    .filter(Boolean);

  if (labels.length === 1) return labels[0];

  return (
    {
      operations: "Operations",
      sustainability: "Sustainability",
      exhibitors: "Exhibitor",
      soc: "SOC",
    }[domain] || domain
  );
}

function deriveDescription(domain, sectionList, filters) {
  const labels = sectionList
    .map((item) => SECTION_LABELS[domain]?.[item])
    .filter(Boolean);

  const pieces = [];
  if (labels.length) pieces.push(`Sections: ${labels.join(", ")}`);

  const zones = toArray(filters?.zones);
  const facilities = toArray(filters?.facilities);
  const boothIds = toArray(filters?.booth_ids);

  if (zones.length) pieces.push(`Zones: ${zones.join(", ")}`);
  if (facilities.length) pieces.push(`Facilities: ${facilities.join(", ")}`);
  if (boothIds.length) pieces.push(`Booths: ${boothIds.join(", ")}`);
  if (filters?.custom_notes) pieces.push(String(filters.custom_notes).slice(0, 120));

  return pieces.join(" • ") || "Generated report";
}

function mapReportRow(row) {
  const filters = row.filters_json || {};
  const sections = Array.isArray(row.section_list) ? row.section_list : [];
  return {
    report_id: row.report_id,
    report_code: row.report_code,
    report_title: row.report_name,
    description: deriveDescription(row.domain, sections, filters),
    timestamp: row.generated_at || row.created_at,
    report_type: deriveReportType(row.domain, sections),
    format: String(row.format || "").toUpperCase(),
    status: row.status,
    domain: row.domain,
    section_list: sections,
    filters_json: filters,
    generated_by_name: row.generated_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    generated_at: row.generated_at,
  };
}

function parseDateOnly(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed.toISOString().slice(0, 10);
}

function validateFilters(domain, filters) {
  if (!filters || typeof filters !== "object") {
    throw new Error("filters are required");
  }

  const normalized = {
    ...filters,
    module: domain,
    report_title: String(filters.report_title || "").trim(),
    frequency: String(filters.frequency || "Hourly"),
    zones: toArray(filters.zones),
    facilities: toArray(filters.facilities),
    sections: toArray(filters.sections),
    booth_ids: toArray(filters.booth_ids),
    device_groups: toArray(filters.device_groups),
    custom_notes: filters.custom_notes ? String(filters.custom_notes) : null,
    event_id: filters.event_id ? String(filters.event_id) : null,
    exhibitor_id: filters.exhibitor_id ? String(filters.exhibitor_id) : null,
  };

  if (!normalized.report_title) throw new Error("Report title is required");
  normalized.date_from = parseDateOnly(filters.date_from);
  normalized.date_to = parseDateOnly(filters.date_to);

  if (domain === "exhibitors") {
    if (!normalized.event_id) throw new Error("event_id is required for exhibitor reports");
    if (!normalized.exhibitor_id) throw new Error("exhibitor_id is required for exhibitor reports");
  }

  return normalized;
}

async function fetchMetricsRows(filters) {
  const values = [filters.date_from, filters.date_to];
  const where = ["ts >= $1::date", "ts < ($2::date + interval '1 day')"];

  if (filters.zones.length) {
    values.push(filters.zones);
    where.push(`zone_id = ANY($${values.length})`);
  }

  if (filters.facilities.length) {
    values.push(filters.facilities);
    where.push(`hall_id = ANY($${values.length})`);
  }

  const query = `
    SELECT
      ts AS timestamp,
      day_of_week AS "dayOfWeek",
      is_holiday AS "isHoliday",
      zone_id AS "zoneId",
      hall_id AS "hallId",
      hall_name AS "hallName",
      event_id AS "eventId",
      is_event AS "isEvent",
      hall_capacity AS "hallCapacity",
      threshold,
      current_occupancy AS "currentOccupancy",
      is_overcrowded AS "isOvercrowded",
      occupancy_ratio AS "occupancyRatio",
      crowd_density_class AS "crowdDensityClass",
      inflow_count AS "inflowCount",
      outflow_count AS "outflowCount",
      flow_congestion_index AS "flowCongestionIndex",
      is_queue AS "isQueue",
      queue_length_class AS "queueLengthClass",
      recommended_action AS "recommendedAction",
      hour_of_day AS "hourOfDay",
      day_of_year AS "dayOfYear",
      outdoor_temp_c AS "outdoorTempC",
      humidity_pct AS "humidityPct",
      indoor_temp_c AS "indoorTempC",
      temp_comfort_score AS "tempComfortScore",
      humidity_comfort_score AS "humidityComfortScore",
      crowd_comfort_penalty AS "crowdComfortPenalty",
      comfort_index AS "comfortIndex",
      comfort_status AS "comfortStatus",
      hvac_energy_kwh AS "hvacEnergyKWh",
      carbon_kg_co2 AS "carbonKgCO2",
      energy_efficiency_score AS "energyEfficiencyScore",
      sustainability_status AS "sustainabilityStatus",
      venue_role AS "venueRole",
      x_coord AS "xCoord",
      y_coord AS "yCoord"
    FROM interval_metrics
    WHERE ${where.join(" AND ")}
    ORDER BY ts ASC, hall_id ASC
  `;

  const result = await analytics.query(query, values);
  return result.rows;
}

async function fetchExhibitorDatasets(filters) {
  const eventResult = await core.query(
    `
      SELECT
        event_id,
        event_name,
        venue_id,
        venue_name,
        start_datetime_utc,
        end_datetime_utc,
        expected_attendance_total,
        expected_exhibitors,
        status,
        person_in_charge_name,
        person_in_charge_email,
        created_at,
        updated_at
      FROM events
      WHERE event_id = $1
      LIMIT 1
    `,
    [filters.event_id]
  );

  const exhibitorResult = await core.query(
    `
      SELECT exhibitor_id, exhibitor_name, industry, hq_country, status, created_at, updated_at
      FROM exhibitors
      WHERE exhibitor_id = $1
      LIMIT 1
    `,
    [filters.exhibitor_id]
  );

  const assignmentValues = [filters.event_id, filters.exhibitor_id];
  let boothClause = "";
  if (filters.booth_ids.length) {
    assignmentValues.push(filters.booth_ids);
    boothClause = ` AND ba.booth_id = ANY($${assignmentValues.length})`;
  }

  const assignmentsResult = await core.query(
    `
      SELECT
        ba.event_id,
        ba.exhibitor_id,
        ba.booth_id,
        b.booth_code,
        b.zone_id,
        b.hall_id,
        b.hall_name,
        b.booth_size_type,
        b.booth_area_sqm,
        ba.assigned_at,
        ba.package_tier,
        ba.discount_pct,
        ba.amount_paid_aed,
        ba.status
      FROM booth_assignments ba
      LEFT JOIN booths b ON b.booth_id = ba.booth_id
      WHERE ba.event_id = $1
        AND ba.exhibitor_id = $2
        ${boothClause}
      ORDER BY b.hall_name ASC, b.booth_code ASC
    `,
    assignmentValues
  );

  const hallIds = [...new Set(assignmentsResult.rows.map((row) => row.hall_id).filter(Boolean))];
  const zoneIds = [...new Set(assignmentsResult.rows.map((row) => row.zone_id).filter(Boolean))];

  const metricValues = [filters.event_id, filters.date_from, filters.date_to];
  const metricWhere = [
    `event_id = $1`,
    `bucket_ts >= $2::date`,
    `bucket_ts < ($3::date + interval '1 day')`,
  ];

  if (hallIds.length) {
    metricValues.push(hallIds);
    metricWhere.push(`hall_id = ANY($${metricValues.length})`);
  }

  if (zoneIds.length) {
    metricValues.push(zoneIds);
    metricWhere.push(`zone_id = ANY($${metricValues.length})`);
  }

  const metricsResult = await analytics.query(
    `
      SELECT
        node_id,
        event_id,
        zone_id,
        hall_id,
        hall_name,
        bucket_ts,
        occupancy_ratio,
        inflow_count,
        outflow_count,
        flow_congestion_index,
        is_event,
        is_overcrowded,
        is_queue,
        crowd_comfort_penalty,
        comfort_index,
        density_score,
        hour_of_day AS hour,
        day_of_week,
        is_weekend,
        engagement_truth
      FROM report_metrics
      WHERE ${metricWhere.join(" AND ")}
      ORDER BY bucket_ts ASC, hall_id ASC
    `,
    metricValues
  );

  return {
    events: eventResult.rows,
    exhibitors: exhibitorResult.rows,
    assignments: assignmentsResult.rows,
    metrics: metricsResult.rows,
  };
}

async function buildDatasets(domain, filters) {
  if (domain === "exhibitors") {
    return fetchExhibitorDatasets(filters);
  }

  return {
    rows: await fetchMetricsRows(filters),
  };
}

async function getOptions(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain);

    if (domain === "operations" || domain === "sustainability") {
      const [zonesResult, hallsResult] = await Promise.all([
        core.query(`SELECT zone_id, venue_id FROM zones ORDER BY zone_id ASC`),
        core.query(`SELECT hall_id, hall_name, zone_id FROM halls ORDER BY hall_name ASC`),
      ]);

      return res.json({
        success: true,
        data: {
          zones: zonesResult.rows,
          facilities: hallsResult.rows,
        },
      });
    }

    if (domain === "exhibitors") {
      const eventId = req.query.eventId ? String(req.query.eventId) : null;
      const exhibitorId = req.query.exhibitorId ? String(req.query.exhibitorId) : null;

      const eventsResult = await core.query(
        `SELECT event_id, event_name, start_datetime_utc, end_datetime_utc, status FROM events ORDER BY start_datetime_utc DESC`
      );

      let exhibitorsResult;
      if (eventId) {
        exhibitorsResult = await core.query(
          `
            SELECT DISTINCT e.exhibitor_id, e.exhibitor_name
            FROM booth_assignments ba
            JOIN exhibitors e ON e.exhibitor_id = ba.exhibitor_id
            WHERE ba.event_id = $1
            ORDER BY e.exhibitor_name ASC
          `,
          [eventId]
        );
      } else {
        exhibitorsResult = await core.query(
          `SELECT exhibitor_id, exhibitor_name FROM exhibitors ORDER BY exhibitor_name ASC`
        );
      }

      let boothsResult = { rows: [] };
      if (eventId && exhibitorId) {
        boothsResult = await core.query(
          `
            SELECT b.booth_id, b.booth_code, b.hall_name, b.zone_id, b.hall_id
            FROM booth_assignments ba
            JOIN booths b ON b.booth_id = ba.booth_id
            WHERE ba.event_id = $1 AND ba.exhibitor_id = $2
            ORDER BY b.hall_name ASC, b.booth_code ASC
          `,
          [eventId, exhibitorId]
        );
      }

      return res.json({
        success: true,
        data: {
          events: eventsResult.rows,
          exhibitors: exhibitorsResult.rows,
          booths: boothsResult.rows,
        },
      });
    }

    return res.status(400).json({ success: false, error: "Unsupported domain" });
  } catch (error) {
    console.error("[reports.options]", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to load options" });
  }
}

async function listReports(req, res) {
  try {
    const domain = req.query.domain ? normalizeDomain(req.query.domain) : null;
    const values = [];
    const where = ["deleted_at IS NULL"];

    if (domain) {
      values.push(domain);
      where.push(`domain = $${values.length}`);
    }

    const result = await core.query(
      `
        SELECT *
        FROM reports
        WHERE ${where.join(" AND ")}
        ORDER BY COALESCE(generated_at, created_at) DESC, created_at DESC
      `,
      values
    );

    return res.json({
      success: true,
      data: result.rows.map(mapReportRow),
    });
  } catch (error) {
    console.error("[reports.list]", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to list reports" });
  }
}

async function getReportRow(reportId) {
  const result = await core.query(
    `SELECT * FROM reports WHERE report_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [reportId]
  );
  return result.rows[0] || null;
}

async function getReport(req, res) {
  try {
    const report = await getReportRow(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }

    return res.json({ success: true, data: mapReportRow(report) });
  } catch (error) {
    console.error("[reports.get]", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch report" });
  }
}

async function createDraft(req, res) {
  try {
    const domain = normalizeDomain(req.body?.domain || req.body?.filters?.module);
    const filters = validateFilters(domain, req.body.filters || {});
    const format = normalizeFormat(req.body.format);
    const reportId = crypto.randomUUID();
    const reportCode = await generateReportCode(domain);
    const generatedByName = (await getUserDisplayName(req.user?.user_id)) || null;

    const insert = await core.query(
      `
        INSERT INTO reports (
          report_id,
          report_code,
          report_name,
          domain,
          section_list,
          filters_json,
          status,
          format,
          generated_by_user_id,
          generated_by_name,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6::jsonb,
          'DRAFT',
          $7,
          $8,
          $9,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        reportId,
        reportCode,
        filters.report_title,
        domain,
        JSON.stringify(filters.sections),
        JSON.stringify(filters),
        format,
        req.user?.user_id || null,
        generatedByName,
      ]
    );

    return res.status(201).json({ success: true, data: mapReportRow(insert.rows[0]) });
  } catch (error) {
    console.error("[reports.createDraft]", error);
    return res.status(400).json({ success: false, error: error.message || "Failed to save draft" });
  }
}

async function updateDraft(req, res) {
  try {
    const existing = await getReportRow(req.params.reportId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ success: false, error: "Only draft reports can be edited" });
    }

    const domain = normalizeDomain(req.body?.domain || req.body?.filters?.module || existing.domain);
    const filters = validateFilters(domain, req.body.filters || existing.filters_json || {});
    const format = normalizeFormat(req.body.format || existing.format);

    const update = await core.query(
      `
        UPDATE reports
        SET
          report_name = $2,
          domain = $3,
          section_list = $4::jsonb,
          filters_json = $5::jsonb,
          format = $6,
          updated_at = NOW()
        WHERE report_id = $1
        RETURNING *
      `,
      [
        existing.report_id,
        filters.report_title,
        domain,
        JSON.stringify(filters.sections),
        JSON.stringify(filters),
        format,
      ]
    );

    return res.json({ success: true, data: mapReportRow(update.rows[0]) });
  } catch (error) {
    console.error("[reports.updateDraft]", error);
    return res.status(400).json({ success: false, error: error.message || "Failed to update draft" });
  }
}

async function persistGeneratedReport({ report, domain, filters, format, buffer, userId, generatedByName }) {
  const reportId = report?.report_id || crypto.randomUUID();
  const reportCode = report?.report_code || (await generateReportCode(domain));
  const { fileName, filePath } = buildReportStorage(domain, reportCode, format);

  fs.writeFileSync(filePath, buffer);

  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const stats = fs.statSync(filePath);

  if (report) {
    const update = await core.query(
      `
        UPDATE reports
        SET
          report_name = $2,
          domain = $3,
          section_list = $4::jsonb,
          filters_json = $5::jsonb,
          status = 'GENERATED',
          format = $6,
          generated_by_user_id = $7,
          generated_by_name = $8,
          updated_at = NOW(),
          generated_at = NOW(),
          file_path = $9,
          file_name = $10,
          mime_type = $11,
          file_size_bytes = $12,
          checksum = $13
        WHERE report_id = $1
        RETURNING *
      `,
      [
        reportId,
        filters.report_title,
        domain,
        JSON.stringify(filters.sections),
        JSON.stringify(filters),
        format,
        userId || null,
        generatedByName || null,
        filePath,
        fileName,
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        stats.size,
        checksum,
      ]
    );
    return update.rows[0];
  }

  const insert = await core.query(
    `
      INSERT INTO reports (
        report_id,
        report_code,
        report_name,
        domain,
        section_list,
        filters_json,
        status,
        format,
        generated_by_user_id,
        generated_by_name,
        created_at,
        updated_at,
        generated_at,
        file_path,
        file_name,
        mime_type,
        file_size_bytes,
        checksum
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6::jsonb,
        'GENERATED',
        $7,
        $8,
        $9,
        NOW(),
        NOW(),
        NOW(),
        $10,
        $11,
        $12,
        $13,
        $14
      )
      RETURNING *
    `,
    [
      reportId,
      reportCode,
      filters.report_title,
      domain,
      JSON.stringify(filters.sections),
      JSON.stringify(filters),
      format,
      userId || null,
      generatedByName || null,
      filePath,
      fileName,
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      stats.size,
      checksum,
    ]
  );

  return insert.rows[0];
}

async function generateReport(req, res) {
  try {
    const domain = normalizeDomain(req.body?.domain || req.body?.filters?.module);
    const filters = validateFilters(domain, req.body.filters || {});
    const format = normalizeFormat(req.body.format);
    const generatedByName = (await getUserDisplayName(req.user?.user_id)) || null;

    const datasets = await buildDatasets(domain, filters);
    const rendered = await renderReport({
      filters: { ...filters, module: domain },
      format,
      datasets,
      generated_by_user_id: req.user?.user_id || null,
      generated_by_name: generatedByName,
    });

    const row = await persistGeneratedReport({
      report: null,
      domain,
      filters,
      format,
      buffer: rendered.buffer,
      userId: req.user?.user_id,
      generatedByName,
    });

    return res.status(201).json({ success: true, data: mapReportRow(row) });
  } catch (error) {
    console.error("[reports.generate]", error);
    return res.status(400).json({ success: false, error: error.message || "Failed to generate report" });
  }
}

async function finalizeDraft(req, res) {
  try {
    const report = await getReportRow(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    if (report.status !== "DRAFT") {
      return res.status(400).json({ success: false, error: "Only draft reports can be generated" });
    }

    const domain = normalizeDomain(report.domain);
    const filters = validateFilters(domain, report.filters_json || {});
    const format = normalizeFormat(report.format);
    const generatedByName = (await getUserDisplayName(req.user?.user_id)) || report.generated_by_name || null;

    const datasets = await buildDatasets(domain, filters);
    const rendered = await renderReport({
      filters: { ...filters, module: domain },
      format,
      datasets,
      generated_by_user_id: req.user?.user_id || null,
      generated_by_name: generatedByName,
    });

    const row = await persistGeneratedReport({
      report,
      domain,
      filters,
      format,
      buffer: rendered.buffer,
      userId: req.user?.user_id,
      generatedByName,
    });

    return res.json({ success: true, data: mapReportRow(row) });
  } catch (error) {
    console.error("[reports.finalizeDraft]", error);
    return res.status(400).json({ success: false, error: error.message || "Failed to generate draft" });
  }
}

async function sendReportFile(req, res, inline) {
  try {
    const report = await getReportRow(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    if (report.status !== "GENERATED") {
      return res.status(400).json({ success: false, error: "Report is not generated yet" });
    }
    if (!report.file_path || !fs.existsSync(report.file_path)) {
      return res.status(404).json({ success: false, error: "Report file not found" });
    }

    res.setHeader("Content-Type", report.mime_type || "application/octet-stream");
    const disposition = `${inline ? "inline" : "attachment"}; filename=\"${report.file_name || path.basename(report.file_path)}\"`;
    res.setHeader("Content-Disposition", disposition);
    return res.sendFile(path.resolve(report.file_path));
  } catch (error) {
    console.error("[reports.file]", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to open report file" });
  }
}

async function viewReport(req, res) {
  return sendReportFile(req, res, true);
}

async function downloadReport(req, res) {
  return sendReportFile(req, res, false);
}

module.exports = {
  getOptions,
  listReports,
  getReport,
  createDraft,
  updateDraft,
  generateReport,
  finalizeDraft,
  viewReport,
  downloadReport,
};
